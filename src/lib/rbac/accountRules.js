/**
 * Pure account rules — shared by the server (roles.js / accounts.js) and the
 * users page (tooltips). No server imports.
 *
 * `actor`  = session.user ({ id, isSuperadmin })
 * `target` = { id, isSuperadmin (their role), status }
 * Each check returns null when allowed, or { status, error } (Thai).
 */

const block = (status, error) => ({ status, error });

function isOwn(actor, target) {
  return !!actor?.id && !!target?.id && String(actor.id) === String(target.id);
}

function isActive(target) {
  return (target?.status ?? "active") !== "suspended";
}

/**
 * Reset password / suspend / reactivate / unlock on the users page
 * (users_manage): never your own account (use the change-password page), a
 * non-superadmin never touches a superadmin account, and the last active
 * superadmin is never suspended.
 * `action` = "reset" | "suspend" | "activate" | "unlock".
 */
export function accountActionBlock({ actor, target, action, activeSuperadminCount }) {
  if (isOwn(actor, target)) {
    return block(403, "ดำเนินการกับบัญชีของตัวเองไม่ได้ — ใช้หน้าเปลี่ยนรหัสผ่านแทน");
  }
  if (target?.isSuperadmin && actor?.isSuperadmin !== true) {
    return block(403, "จัดการบัญชี superadmin ได้เฉพาะ superadmin เท่านั้น");
  }
  if (action === "suspend" && target?.isSuperadmin && isActive(target) && activeSuperadminCount <= 1) {
    return block(403, "ระงับ superadmin คนสุดท้ายที่ใช้งานอยู่ไม่ได้");
  }
  return null;
}

/**
 * Linking an account to an employee, or unlinking it (employees holders and
 * the superadmin): a non-superadmin never touches a superadmin account, and
 * nobody links or unlinks their own account (linking yourself to an employee
 * would hand you that person's self-service data and head-of-department
 * rights). `action` = "link" | "unlink".
 */
export function linkActionBlock({ actor, target, action }) {
  if (isOwn(actor, target)) {
    return block(403, action === "unlink" ? "ยกเลิกการผูกบัญชีของตัวเองไม่ได้" : "ผูกบัญชีของตัวเองไม่ได้");
  }
  if (target?.isSuperadmin && actor?.isSuperadmin !== true) {
    return block(403, "จัดการบัญชี superadmin ได้เฉพาะ superadmin เท่านั้น");
  }
  return null;
}

/**
 * Deleting an account: superadmin only, never your own account, never the
 * last active superadmin. (Suspending is preferred for people who left.)
 */
export function accountDeleteBlock({ actor, target, activeSuperadminCount }) {
  if (actor?.isSuperadmin !== true) return block(403, "ลบบัญชีได้เฉพาะ superadmin เท่านั้น");
  if (isOwn(actor, target)) return block(403, "ลบบัญชีของตัวเองไม่ได้");
  if (target?.isSuperadmin && isActive(target) && activeSuperadminCount <= 1) {
    return block(403, "ลบ superadmin คนสุดท้ายที่ใช้งานอยู่ไม่ได้");
  }
  return null;
}

/** The role for a NEW account: non-superadmins may only create "employee". */
export function newAccountRoleBlock({ actor, roleKey }) {
  if (actor?.isSuperadmin !== true && roleKey !== "employee") {
    return block(403, "เฉพาะ superadmin เท่านั้นที่กำหนดบทบาทได้ — บัญชีใหม่จะเป็น employee");
  }
  return null;
}

/**
 * Changing an existing user's role: superadmin only, never your own account,
 * never demoting the last active superadmin.
 */
export function roleChangeBlock({ actor, target, newRoleIsSuperadmin, activeSuperadminCount }) {
  if (actor?.isSuperadmin !== true) return block(403, "เฉพาะ superadmin เท่านั้นที่เปลี่ยนบทบาทได้");
  if (isOwn(actor, target)) return block(403, "เปลี่ยนบทบาทของบัญชีตัวเองไม่ได้");
  if (target?.isSuperadmin && isActive(target) && !newRoleIsSuperadmin && activeSuperadminCount <= 1) {
    return block(403, "ลดสิทธิ์ superadmin คนสุดท้ายที่ใช้งานอยู่ไม่ได้");
  }
  return null;
}
