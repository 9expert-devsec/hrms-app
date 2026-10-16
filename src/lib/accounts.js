import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "@/models/User";
import Employee from "@/models/Employee";
import { findRole } from "@/lib/rbac/resolveRole";
import { countActiveSuperadmins, listRoles } from "@/lib/rbac/roles";
import { accountActionBlock } from "@/lib/rbac/accountRules";
import { forgetCachedPermissions } from "@/lib/rbac/sessionPerms";
import { isLocked } from "@/lib/loginLockout";
import { employeeDisplayName, employeeNameSearchText } from "@/lib/employeeName";
import { validateNewPassword } from "@/lib/passwordRules";

/**
 * Account administration for the users page (registry key users_manage).
 * Guard rails live in lib/rbac/accountRules.js (accountActionBlock).
 * Callers must have called dbConnect() first.
 *
 * A reset (resetPassword) sets a password the admin typed, or a random
 * temporary one returned to the caller ONCE — either way only its hash is
 * stored, nothing is logged, and mustChangePassword makes the user choose a
 * new password at next sign-in. New accounts always get the random kind
 * (newAccountPassword). A suspended user's open sessions end at the
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
 * Password fields for a NEW account (POST /api/auth/register, POST
 * /api/employees): nobody chooses another person's password, so every new
 * account starts with a temporary one and must change it at first sign-in.
 * Spread `fields` into User.create; `tempPassword` goes back to the creator
 * ONCE (Cache-Control: no-store) and must never be logged or stored.
 */
export async function newAccountPassword() {
  const tempPassword = generateTemporaryPassword();
  return {
    tempPassword,
    fields: { passwordHash: await bcrypt.hash(tempPassword, BCRYPT_COST), mustChangePassword: true },
  };
}

/**
 * Reset another person's password (users page / employee edit form), in one
 * of two modes — both force a change at the user's next sign-in:
 *   - `password` given: the admin typed it (PASSWORD_MIN_LENGTH). Returns
 *     { email } only — the typed password is never echoed back.
 *   - no `password`: a random temporary one. Returns { tempPassword, email };
 *     the ONLY place it exists — callers must not log or store it.
 * Only the hash is stored. A reset also lifts a sign-in lock.
 */
export async function resetPassword(targetId, { actor, password } = {}) {
  const typed = password !== undefined && password !== null;
  if (typed) {
    const invalid = validateNewPassword({ newPassword: password });
    if (invalid) throw new AccountError(invalid, 400);
  }
  const target = await loadTarget(targetId);
  await assertAllowed(actor, target, "reset");

  const tempPassword = typed ? null : generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(typed ? password : tempPassword, BCRYPT_COST);
  await User.updateOne(
    { _id: target.user._id },
    {
      $set: {
        passwordHash,
        mustChangePassword: true,
        passwordResetAt: new Date(),
        passwordResetBy: actor?.id && mongoose.isValidObjectId(actor.id) ? actor.id : null,
        // A reset also lifts a sign-in lock (lib/loginLockout.js).
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }
  );
  forgetCachedPermissions(target.user._id);
  return typed ? { email: target.user.email } : { tempPassword, email: target.user.email };
}

/** The random-password reset (kept for callers that only need that mode). */
export function issueTemporaryPassword(targetId, { actor }) {
  return resetPassword(targetId, { actor });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed, lower-cased email — how every account email is stored and compared. */
export const normalizeEmail = (v) => String(v ?? "").trim().toLowerCase();

/**
 * Change an account's sign-in email (users page and the employee edit form —
 * both go through here, so validation is identical). Only User.email changes;
 * the linked Employee's email is not touched. Same guard rails as a reset.
 * The user signs in with the new email from now on; their open session keeps
 * working and picks the new email up at the next permission refresh.
 */
export async function changeAccountEmail(targetId, rawEmail, { actor }) {
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_RE.test(email)) throw new AccountError("อีเมลไม่ถูกต้อง", 400);
  const target = await loadTarget(targetId);
  await assertAllowed(actor, target, "email");

  if (email === normalizeEmail(target.user.email)) {
    if (email !== target.user.email) await User.updateOne({ _id: target.user._id }, { $set: { email } });
    return { _id: String(target.user._id), email };
  }
  if (await User.exists({ email, _id: { $ne: target.user._id } })) {
    throw new AccountError("อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว", 409);
  }
  try {
    await User.updateOne({ _id: target.user._id }, { $set: { email } });
  } catch (e) {
    if (e?.code === 11000) throw new AccountError("อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว", 409);
    throw e;
  }
  forgetCachedPermissions(target.user._id);
  return { _id: String(target.user._id), email };
}

/**
 * Everything the users page shows: users with their linked employee
 * (Employee.userId — lib/accountLinks.js; null = not linked), the role list
 * (names/colours) and the number of active superadmins (for the
 * last-superadmin rule).
 */
export async function listUsers() {
  const [users, roles, activeSuperadminCount] = await Promise.all([
    User.find({})
      .select("_id name email role status lastLoginAt mustChangePassword lockedUntil")
      .sort({ email: 1 })
      .lean(),
    listRoles(),
    countActiveSuperadmins(),
  ]);

  const emps = await Employee.find({ userId: { $in: users.map((u) => u._id) } })
    .select("_id firstName lastName firstNameTh lastNameTh nickName empAutoId userId email")
    .lean();
  const empByUser = new Map(emps.map((e) => [String(e.userId), e]));
  const roleByKey = new Map(roles.map((r) => [r.key, r]));

  return {
    activeSuperadminCount,
    roles: roles.map(({ key, name, color, isSuperadmin }) => ({ key, name, color, isSuperadmin })),
    users: users.map((u) => {
      const emp = empByUser.get(String(u._id)) || null;
      return {
        _id: String(u._id),
        name: u.name || "",
        email: u.email,
        role: u.role,
        isSuperadmin: !!roleByKey.get(u.role)?.isSuperadmin,
        status: u.status || "active",
        lastLoginAt: u.lastLoginAt || null,
        mustChangePassword: u.mustChangePassword === true,
        // Only a lock still in force; an expired one is not shown.
        lockedUntil: isLocked(u.lockedUntil) ? new Date(u.lockedUntil).toISOString() : null,
        employee: emp
          ? {
              _id: String(emp._id),
              empAutoId: emp.empAutoId ?? null,
              name: employeeDisplayName(emp),
              nameSearch: employeeNameSearchText(emp),
              // For "ใช้อีเมลเดียวกับพนักงาน"; the badge compares trimmed, case-insensitive.
              email: emp.email || "",
              emailMismatch: normalizeEmail(emp.email) !== normalizeEmail(u.email),
            }
          : null,
      };
    }),
  };
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

/** Lift a sign-in lock before it expires ("ปลดล็อก"); also clears the counter. */
export async function unlockAccount(targetId, { actor }) {
  const target = await loadTarget(targetId);
  await assertAllowed(actor, target, "unlock");

  await User.updateOne({ _id: target.user._id }, { $set: { failedLoginCount: 0, lockedUntil: null } });
  return { _id: String(target.user._id), lockedUntil: null };
}
