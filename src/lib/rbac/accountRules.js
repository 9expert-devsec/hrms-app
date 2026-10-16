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
