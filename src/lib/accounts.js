import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "@/models/User";
import { findRole } from "@/lib/rbac/resolveRole";
import { countActiveSuperadmins } from "@/lib/rbac/roles";
import { accountActionBlock } from "@/lib/rbac/accountRules";
import { forgetCachedPermissions } from "@/lib/rbac/sessionPerms";

/**
 * Account administration for the users page (registry key users_manage).
 * Guard rails live in lib/rbac/accountRules.js (accountActionBlock).
 * Callers must have called dbConnect() first.
 *
 * A reset never reveals or sets the user's real password: the server makes
 * a random temporary one, returns it to the caller ONCE (never logged, only
 * its hash is stored) and sets mustChangePassword so the user must choose a
 * new password at next sign-in. A suspended user's open sessions end at the
 * next permission refresh (lib/rbac/sessionPerms.js, ≤ ROLE_REFRESH_MS) and
 * authorize() refuses them at sign-in.
 */

/** Same hashing as every other password write (bcryptjs, cost 10). */
export const BCRYPT_COST = 10;

/** No 0/O/o or 1/l/I — easy to read out to someone. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const TEMP_PASSWORD_LENGTH = 14;

/** Thrown for a refused request; `status` is the HTTP status to answer with. */
export class AccountError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** Cryptographically random, with at least one upper, one lower, one digit. */
export function generateTemporaryPassword(length = TEMP_PASSWORD_LENGTH) {
  for (;;) {
    let out = "";
    for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
    if (/[A-Z]/.test(out) && /[a-z]/.test(out) && /[0-9]/.test(out)) return out;
  }
}

async function loadTarget(targetId) {
  if (!mongoose.isValidObjectId(targetId)) throw new AccountError("ไม่พบผู้ใช้", 404);
  const user = await User.findById(targetId).select("_id email role status").lean();
  if (!user) throw new AccountError("ไม่พบผู้ใช้", 404);
  const role = await findRole(user.role);
  return { user, isSuperadmin: !!role?.isSuperadmin };
}

async function assertAllowed(actor, { user, isSuperadmin }, action) {
  const denied = accountActionBlock({
    actor,
    target: { id: user._id, isSuperadmin, status: user.status },
    action,
    activeSuperadminCount: isSuperadmin ? await countActiveSuperadmins() : Infinity,
  });
  if (denied) throw new AccountError(denied.error, denied.status);
}

/**
 * Issue a temporary password. Returns { tempPassword, email } — the ONLY
 * place the plain password exists; callers must not log or store it.
 */
export async function issueTemporaryPassword(targetId, { actor }) {
  const target = await loadTarget(targetId);
  await assertAllowed(actor, target, "reset");

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);
  await User.updateOne(
    { _id: target.user._id },
    {
      $set: {
        passwordHash,
        mustChangePassword: true,
        passwordResetAt: new Date(),
        passwordResetBy: actor?.id && mongoose.isValidObjectId(actor.id) ? actor.id : null,
        failedLoginCount: 0,
      },
    }
  );
  forgetCachedPermissions(target.user._id);
  return { tempPassword, email: target.user.email };
}

/** Suspend or reactivate an account ("suspended" | "active"). */
export async function setAccountStatus(targetId, status, { actor }) {
  if (status !== "active" && status !== "suspended") {
    throw new AccountError('สถานะต้องเป็น "active" หรือ "suspended"', 400);
  }
  const target = await loadTarget(targetId);
  await assertAllowed(actor, target, status === "suspended" ? "suspend" : "activate");

  await User.updateOne({ _id: target.user._id }, { $set: { status } });
  forgetCachedPermissions(target.user._id);
  return { _id: String(target.user._id), status };
}
