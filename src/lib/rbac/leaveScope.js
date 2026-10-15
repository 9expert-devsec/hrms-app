import "server-only";
import Department from "@/models/Department";
import Employee from "@/models/Employee";
import { canAccess } from "@/lib/rbac/access";

/**
 * Which employees' leave a user may act on at the HOD step.
 * Callers must have called dbConnect() first.
 *
 *   - superadmin, or `scope_leave_all_depts` → every department
 *   - otherwise → the departments in session.user.headOfDepartmentIds
 *
 * Employees are matched on departmentId OR on the department code, since
 * older Employee documents are keyed by code.
 *
 * @returns {Promise<{ all: true } | { all: false, employeeIds: string[] }>}
 */
export async function hodStepScope(user) {
  if (canAccess(user, "scope_leave_all_depts")) return { all: true };

  const deptIds = Array.isArray(user?.headOfDepartmentIds) ? user.headOfDepartmentIds : [];
  if (!deptIds.length) return { all: false, employeeIds: [] };

  const depts = await Department.find({ _id: { $in: deptIds } }).select("_id code").lean();
  const codes = depts.map((d) => d.code).filter(Boolean);
  const emps = await Employee.find({
    $or: [{ departmentId: { $in: depts.map((d) => d._id) } }, { department: { $in: codes } }],
  })
    .select("_id")
    .lean();
  return { all: false, employeeIds: emps.map((e) => String(e._id)) };
}

/** May `user` act on the HOD step for this leave's employee? */
export async function canActOnHodStep(user, employeeId) {
  const scope = await hodStepScope(user);
  if (scope.all) return true;
  return scope.employeeIds.includes(String(employeeId));
}

/** May `user` act on the HR (final) step? */
export function canActOnHrStep(user) {
  return canAccess(user, "scope_leave_hr_step");
}
