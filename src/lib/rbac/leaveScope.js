import "server-only";
import { canAccess } from "@/lib/rbac/access";
import { leaveHodScope, canViewLeaveDocument } from "@/lib/rbac/scopes";
import { departmentIdOf, employeeIdsForScope, isEmployeeInScope } from "@/lib/rbac/scopeQueries";

/**
 * Which employees' leave a user may act on at the HOD step.
 * Callers must have called dbConnect() first.
 *
 *   - superadmin, or `scope_leave_all_depts` → every department
 *   - otherwise → the departments in session.user.headOfDepartmentIds
 *
 * @returns {Promise<{ all: true } | { all: false, employeeIds: string[] }>}
 */
export async function hodStepScope(user) {
  const ids = await employeeIdsForScope(leaveHodScope(user));
  return ids === null ? { all: true } : { all: false, employeeIds: ids };
}

/** May `user` act on the HOD step for this leave's employee? */
export function canActOnHodStep(user, employeeId) {
  return isEmployeeInScope(leaveHodScope(user), employeeId);
}

/** May `user` act on the HR (final) step? */
export function canActOnHrStep(user) {
  return canAccess(user, "scope_leave_hr_step");
}

/**
 * Leaves a user may list beyond their own (the approve page's history tabs,
 * the leave-document page). Returns null for "everyone", or employee ids.
 *   - scope_leave_documents_all or scope_leave_hr_step (HR acts company-wide)
 *     → everyone
 *   - otherwise the HOD-step scope
 */
export async function leaveListEmployeeIds(user) {
  if (canAccess(user, "scope_leave_documents_all") || canActOnHrStep(user)) return null;
  const scope = await hodStepScope(user);
  return scope.all ? null : scope.employeeIds;
}

/**
 * May the caller see this leave document (signatures included)?
 * Owner (by user or employee id), a head of the owner's department,
 * scope_leave_hr_step / scope_leave_documents_all / scope_leave_all_depts,
 * or the superadmin — see canViewLeaveDocument. Callers answer 404 when
 * this is false, so the endpoint never confirms the document exists.
 * `employee` needs _id plus departmentId and/or department (code).
 */
export async function canSeeLeaveDocument(session, { ownerUserId, employee }) {
  const user = session?.user;
  if (!user) return false;
  if (ownerUserId && user.id && String(ownerUserId) === String(user.id)) return true;
  return canViewLeaveDocument(user, {
    ownerEmployeeId: employee?._id,
    ownerDepartmentId: await departmentIdOf(employee),
  });
}
