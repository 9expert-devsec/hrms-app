/**
 * Sign-in lockout rules — the ONE place for the numbers. Pure — safe in the
 * browser (the login page and the users page read it too).
 *
 * LOGIN_MAX_FAILURES consecutive wrong passwords lock the account for
 * LOGIN_LOCK_MS; it unlocks by itself when the time passes, or early via the
 * users page ("ปลดล็อก", POST /api/users/[id]/unlock) or a temporary-password
 * reset. A successful sign-in clears User.failedLoginCount and lockedUntil.
 * The counter update is atomic (lib/authOptions.js recordFailedSignIn).
 */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

/**
 * The error code authorize() throws for a locked account; next-auth hands it
 * to the login page as `error`. Unknown emails and wrong passwords keep the
 * generic CredentialsSignin.
 */
export const ACCOUNT_LOCKED_ERROR = "AccountLocked";
export const ACCOUNT_LOCKED_MESSAGE =
  "บัญชีถูกล็อกชั่วคราวเนื่องจากใส่รหัสผ่านผิดหลายครั้ง กรุณาลองใหม่ในอีก 15 นาที หรือติดต่อฝ่ายไอที";

/** True while `lockedUntil` (Date | string | null) is in the future. */
export function isLocked(lockedUntil, now = Date.now()) {
  if (!lockedUntil) return false;
  const t = new Date(lockedUntil).getTime();
  return Number.isFinite(t) && t > now;
}
