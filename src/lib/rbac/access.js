/**
 * Pure RBAC predicates — no server imports, safe in the browser, the Edge
 * middleware and route handlers alike. `user` is session.user or the JWT;
 * both carry { isSuperadmin, pages, headOfDepartmentIds }.
 *
 * Superadmin is ONLY `isSuperadmin === true`. Unlike genesis-lab, a missing
 * `pages` is NOT treated as allow-all: tokens issued before RBAC have no
 * `pages`, and they must deny, not grant.
 */
import { isInDevelopment, resolvePageKey } from "./pages.js";

export { RBAC_VERSION } from "./version.js";

/** May `user` hold `pageKey`? A null/unknown or in-development key is superadmin-only. */
export function canAccess(user, pageKey) {
  if (!user) return false;
  if (user.isSuperadmin === true) return true;
  if (!pageKey || !Array.isArray(user.pages) || isInDevelopment(pageKey)) return false;
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
 * `leave_approve`, any department head, OR anyone the leave flow names —
 * approver (1)/(2) of some employee or an HR signer (`isLeaveApprover`, set
 * on the token by lib/rbac/sessionPerms.js). Sidebar, page and API all use this.
 */
export function canOpenLeaveApproval(user) {
  return canAccess(user, "leave_approve") || isAnyHead(user) || user?.isLeaveApprover === true;
}

/**
 * เอกสารการลา: holders of `self_leave_document`, OR anyone the leave flow
 * names (approver / HR signer — round 42). The API then decides per leave
 * (lib/rbac/leaveScope.js canSeeLeaveDocument), so a page opened this way
 * shows only the leaves that person is on, plus their own.
 */
export function canOpenLeaveDocument(user) {
  return canAccess(user, "self_leave_document") || user?.isLeaveApprover === true;
}

/** canAccess plus the leave-approval and leave-document exceptions. */
export function canOpenPage(user, pageKey) {
  if (pageKey === "leave_approve") return canOpenLeaveApproval(user);
  if (pageKey === "self_leave_document") return canOpenLeaveDocument(user);
  return canAccess(user, pageKey);
}

/**
 * บันทึกการส่งอีเมล (/dashboard/offsite/all/email-log): off-site HR
 * (`offsite_hr`, off-site rows), leave-settings holders and HR signers
 * (`isLeaveHrSigner`, leave rows — round 42). The API filters the types.
 */
export function canOpenEmailLog(user) {
  return canAccess(user, "offsite_hr") || canAccess(user, "leave_settings") || user?.isLeaveHrSigner === true;
}
const EMAIL_LOG_RE = /^\/dashboard\/offsite\/all\/email-log\/?$/;

/**
 * The printable off-site form (/dashboard/offsite/<id>/print) sits under the
 * offsite_self prefix but is also HR's: offsite_self OR offsite_hr may open
 * the page; lib/offsite.js getPrintable then decides per request.
 */
export const OFFSITE_PRINT_PAGES = ["offsite_self", "offsite_hr"];
const OFFSITE_PRINT_RE = /^\/dashboard\/offsite\/[^/]+\/print\/?$/;

/**
 * May `user` open this pathname? Unregistered paths resolve to null and are
 * therefore superadmin-only (deny by default).
 */
export function canAccessPath(user, pathname) {
  if (OFFSITE_PRINT_RE.test(pathname || "")) return OFFSITE_PRINT_PAGES.some((key) => canAccess(user, key));
  if (EMAIL_LOG_RE.test(pathname || "")) return canOpenEmailLog(user);
  return canOpenPage(user, resolvePageKey(pathname));
}
