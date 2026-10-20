/**
 * Password rules for every password a user SETS (the change-password form and
 * POST /api/account/password). Pure — safe in the browser.
 *
 * Applies only when a new password is set; existing passwords (including
 * shorter ones set before this rule) keep working.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** Where a user with mustChangePassword is sent (outside /dashboard). */
export const CHANGE_PASSWORD_PATH = "/account/password";

/* ── ลืมรหัสผ่าน (lib/passwordReset.js) ─────────────────────────────── */

/**
 * Reset emails go ONLY to company addresses: several accounts use placeholder
 * addresses elsewhere that may belong to strangers.
 */
export const COMPANY_EMAIL_DOMAIN = "9expert.co.th";
export const RESET_LINK_TTL_MINUTES = 30;

export function isCompanyEmail(email) {
  return String(email ?? "").trim().toLowerCase().endsWith(`@${COMPANY_EMAIL_DOMAIN}`);
}

/** The one answer to every forgot-password request (no account enumeration). */
export const FORGOT_PASSWORD_GENERIC_MESSAGE =
  "ถ้าอีเมลนี้เป็นบัญชีในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว (ใช้ได้กับอีเมล @9expert.co.th เท่านั้น — อีเมลอื่นกรุณาติดต่อฝ่ายไอที)";

/**
 * Validate a new password. Returns a Thai error message, or null when valid.
 * `currentPassword` (optional) must differ from the new one.
 */
export function validateNewPassword({ newPassword, confirmPassword, currentPassword } = {}) {
  if (typeof newPassword !== "string" || newPassword.length < PASSWORD_MIN_LENGTH) {
    return `รหัสผ่านใหม่ต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`;
  }
  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    return "ยืนยันรหัสผ่านใหม่ไม่ตรงกัน";
  }
  if (currentPassword !== undefined && newPassword === currentPassword) {
    return "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน";
  }
  return null;
}
