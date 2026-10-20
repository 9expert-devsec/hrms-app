/**
 * Pure data-scope rules (no server imports; node-testable). The DB side —
 * turning a scope into employee ids — lives in scopeQueries.js.
 *
 * A department scope is `{ all: true }` or `{ all: false, departmentIds }`,
 * where departmentIds are the Department _ids the user heads.
 */
import { canAccess, isHeadOf } from "./access.js";

function headedDepartmentIds(user) {
  return Array.isArray(user?.headOfDepartmentIds) ? user.headOfDepartmentIds.map(String) : [];
}

/** Everything with `allKey` (or superadmin), else the departments the user heads. */
function departmentScope(user, allKey) {
  if (canAccess(user, allKey)) return { all: true };
  return { all: false, departmentIds: headedDepartmentIds(user) };
}

/** OT approval: scope_ot_all, else headed departments. */
export function otScope(user) {
  return departmentScope(user, "scope_ot_all");
}

/** Another employee's attendance: scope_attendance_all, else headed departments. */
export function attendanceScope(user) {
  return departmentScope(user, "scope_attendance_all");
}

/** Leave HOD step: scope_leave_all_depts, else headed departments. */
export function leaveHodScope(user) {
  return departmentScope(user, "scope_leave_all_depts");
}

/** Is a department (_id) inside a scope? */
export function inDepartmentScope(scope, departmentId) {
  if (scope?.all) return true;
  if (!departmentId || !Array.isArray(scope?.departmentIds)) return false;
  return scope.departmentIds.includes(String(departmentId));
}

function isOwnEmployee(user, employeeId) {
  return !!user?.employeeId && !!employeeId && String(user.employeeId) === String(employeeId);
}

/**
 * May `user` see a leave document (signatures included)?
 * The owner, a head of the owner's department, the HR step, the
 * all-documents scope, the all-departments HOD scope (they approve these
 * documents), or the superadmin. Callers answer 404 otherwise.
 */
export function canViewLeaveDocument(user, { ownerEmployeeId, ownerDepartmentId }) {
  if (!user) return false;
  if (isOwnEmployee(user, ownerEmployeeId)) return true;
  if (
    canAccess(user, "scope_leave_hr_step") ||
    canAccess(user, "scope_leave_documents_all") ||
    canAccess(user, "scope_leave_all_depts")
  ) {
    return true;
  }
  return isHeadOf(user, ownerDepartmentId);
}

/**
 * Another employee's profile.
 *   canView: `employees` holders, `users_manage` holders (IT — to find the
 *            person behind an account), the superadmin, a head of the target's
 *            department, or a member of the same department (ทีมของฉัน links).
 *   canSeePrivate (bank, emergency contact): the owner, `employees`, superadmin
 *            — never users_manage alone.
 * `viewerDepartmentCode` is session.user.department (the viewer's code).
 */
export function profileAccess(user, { targetEmployeeId, targetDepartmentId, targetDepartmentCode }) {
  if (!user) return { canView: false, canSeePrivate: false };
  const self = isOwnEmployee(user, targetEmployeeId);
  const manager = canAccess(user, "employees");
  const sameDepartment =
    !!user.department && !!targetDepartmentCode && String(user.department) === String(targetDepartmentCode);
  return {
    canView: self || manager || canAccess(user, "users_manage") || isHeadOf(user, targetDepartmentId) || sameDepartment,
    canSeePrivate: self || manager,
  };
}
