/**
 * Pure RBAC predicates — no server imports, safe in the browser, the Edge
 * middleware and route handlers alike. `user` is session.user or the JWT;
 * both carry { isSuperadmin, pages, headOfDepartmentIds }.
 *
 * Superadmin is ONLY `isSuperadmin === true`. Unlike genesis-lab, a missing
 * `pages` is NOT treated as allow-all: tokens issued before RBAC have no
 * `pages`, and they must deny, not grant.
 */
import { resolvePageKey } from "./pages.js";

export { RBAC_VERSION } from "./version.js";

/** May `user` hold `pageKey`? A null/unknown key is superadmin-only. */
export function canAccess(user, pageKey) {
  if (!user) return false;
  if (user.isSuperadmin === true) return true;
  if (!pageKey || !Array.isArray(user.pages)) return false;
  return user.pages.includes(pageKey);
}

function headIds(user) {
  return Array.isArray(user?.headOfDepartmentIds) ? user.headOfDepartmentIds.map(String) : [];
}

/** Is `user` the head of this department (_id)? A relationship, not a role. */
export function isHeadOf(user, departmentId) {
  if (!departmentId) return false;
  return headIds(user).includes(String(departmentId));
}

/** Does `user` head at least one department? */
export function isAnyHead(user) {
  return headIds(user).length > 0;
}

/**
 * Leave approval is the one page a relationship opens: holders of
 * `leave_approve` OR any department head (so a head with the plain employee
 * role can approve their own department). Sidebar, page and API all use this.
 */
export function canOpenLeaveApproval(user) {
  return canAccess(user, "leave_approve") || isAnyHead(user);
}

/** canAccess plus the leave-approval exception. */
export function canOpenPage(user, pageKey) {
  return pageKey === "leave_approve" ? canOpenLeaveApproval(user) : canAccess(user, pageKey);
}

/**
 * May `user` open this pathname? Unregistered paths resolve to null and are
 * therefore superadmin-only (deny by default).
 */
export function canAccessPath(user, pathname) {
  return canOpenPage(user, resolvePageKey(pathname));
}
