import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import User from "@/models/User";
import PasswordResetToken from "@/models/PasswordResetToken";
import PasswordResetRequest from "@/models/PasswordResetRequest";
import { BCRYPT_COST, normalizeEmail } from "@/lib/accounts";
import { forgetCachedPermissions } from "@/lib/rbac/sessionPerms";
import { employeeOfUser } from "@/lib/rbac/scopeQueries";
import { employeeDisplayName } from "@/lib/employeeName";
import { appUrl, runAfterResponse, sendMail } from "@/lib/mail/postmark";
import { buildPasswordResetEmail } from "@/lib/mail/passwordResetTemplate";
import { RESET_LINK_TTL_MINUTES, isCompanyEmail, validateNewPassword } from "@/lib/passwordRules";

/**
 * ลืมรหัสผ่าน — request a link by email, then set a new password with it.
 *
 *   requestPasswordReset({ email, ip })  → nothing the caller may show; the
 *     route always answers FORGOT_PASSWORD_GENERIC_MESSAGE. A link is issued
 *     ONLY for an active account whose login email is @9expert.co.th, within
 *     the limits (3 emails per account and 10 requests per IP per hour).
 *     Every request does the same lookups and one log write
 *     (PasswordResetRequest); the token and the email happen after the
 *     response (runAfterResponse).
 *   verifyResetToken(token)              → { ok, reason? }
 *   resetPasswordWithToken({ token, newPassword, confirmPassword })
 *
 * Tokens: 32 random bytes (base64url, 43 chars) in the email only; the DB
 * keeps their SHA-256. Single use; a new request deletes older unused ones.
 * Token values are never logged. Callers must have called dbConnect() first.
 */

export const RESET_ACCOUNT_LIMIT_PER_HOUR = 3;
export const RESET_IP_LIMIT_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

/** Thai messages for a link that cannot be used (the reset page and API). */
export const RESET_LINK_ERRORS = {
  invalid: "ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง",
  expired: `ลิงก์ตั้งรหัสผ่านหมดอายุแล้ว (ใช้ได้ ${RESET_LINK_TTL_MINUTES} นาที)`,
  used: "ลิงก์นี้ถูกใช้ตั้งรหัสผ่านไปแล้ว",
};

export async function requestPasswordReset({ email, ip = "" }) {
  const raw = normalizeEmail(email);
  const address = raw.length <= 254 ? raw : "";
  const since = new Date(Date.now() - HOUR_MS);

  const [ipCount, user] = await Promise.all([
    PasswordResetRequest.countDocuments({ ip, at: { $gte: since } }),
    address ? User.findOne({ email: address }).select("_id email name status").lean() : null,
  ]);
  const accountCount = await PasswordResetRequest.countDocuments({ user: user?._id ?? null, outcome: "issued", at: { $gte: since } });

  let outcome;
  if (ipCount >= RESET_IP_LIMIT_PER_HOUR) outcome = "rate_limited_ip";
  else if (!user) outcome = "unknown";
  else if (!isCompanyEmail(user.email)) outcome = "not_company";
  else if (user.status && user.status !== "active") outcome = "suspended";
  else if (accountCount >= RESET_ACCOUNT_LIMIT_PER_HOUR) outcome = "rate_limited_account";
  else outcome = "issued";

  await PasswordResetRequest.create({ ip, user: user?._id ?? null, emailHash: address ? sha256(address) : "", outcome });
  if (outcome.startsWith("rate_limited")) console.warn(`[password-reset] ${outcome} (nothing sent)`);
  if (outcome === "issued") await runAfterResponse(() => issueAndSend(user, ip));
  return { outcome }; // for tests and logs only — never shown to the requester
}

/** New token (older unused ones deleted) and the email. Never throws to the caller. */
async function issueAndSend(user, ip) {
  await PasswordResetToken.deleteMany({ user: user._id, usedAt: null });
  const token = crypto.randomBytes(32).toString("base64url");
  await PasswordResetToken.create({
    user: user._id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + RESET_LINK_TTL_MINUTES * 60 * 1000),
    requestedIp: ip,
  });
  const emp = await employeeOfUser(user._id, "firstName lastName firstNameTh lastNameTh");
  const { subject, html, text } = buildPasswordResetEmail({
    recipientName: employeeDisplayName(emp) || user.name || user.email,
    url: appUrl(`/reset-password?token=${encodeURIComponent(token)}`),
    minutes: RESET_LINK_TTL_MINUTES,
  });
  await sendMail({ to: user.email, subject, html, text, tag: "password_reset", metadata: {} });
}

/** Why a token cannot be used, or null. Reads only. */
async function tokenProblem(token) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return { reason: "invalid" };
  const row = await PasswordResetToken.findOne({ tokenHash: sha256(token) }).select("user expiresAt usedAt").lean();
  if (!row) return { reason: "invalid" }; // never issued, or already purged by the TTL
  if (row.usedAt) return { reason: "used" };
  if (row.expiresAt.getTime() <= Date.now()) return { reason: "expired" };
  const user = await User.findById(row.user).select("_id status").lean();
  if (!user || (user.status && user.status !== "active")) return { reason: "invalid" };
  return null;
}

export async function verifyResetToken(token) {
  const problem = await tokenProblem(token);
  return problem ? { ok: false, ...problem, message: RESET_LINK_ERRORS[problem.reason] } : { ok: true };
}

/**
 * Set the new password: the hash, mustChangePassword false, the lockout
 * cleared, passwordChangedAt stamped, the token used (claimed atomically, so
 * a link works once even under a double submit).
 */
export async function resetPasswordWithToken({ token, newPassword, confirmPassword }) {
  const problem = await tokenProblem(token);
  if (problem) return { ok: false, ...problem, message: RESET_LINK_ERRORS[problem.reason] };
  const invalid = validateNewPassword({ newPassword, confirmPassword });
  if (invalid) return { ok: false, reason: "password", message: invalid };

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  const now = new Date();
  const claimed = await PasswordResetToken.findOneAndUpdate(
    { tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { new: true }
  ).lean();
  if (!claimed) {
    const again = (await tokenProblem(token)) || { reason: "used" };
    return { ok: false, ...again, message: RESET_LINK_ERRORS[again.reason] };
  }

  const updated = await User.updateOne(
    { _id: claimed.user, $or: [{ status: "active" }, { status: { $exists: false } }] },
    { $set: { passwordHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null, passwordChangedAt: now } }
  );
  if (!updated.matchedCount) return { ok: false, reason: "invalid", message: RESET_LINK_ERRORS.invalid };

  await PasswordResetToken.deleteMany({ user: claimed.user, usedAt: null });
  forgetCachedPermissions(claimed.user);
  return { ok: true };
}
