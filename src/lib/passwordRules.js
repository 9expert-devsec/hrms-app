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
