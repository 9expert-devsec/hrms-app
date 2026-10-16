import "server-only";
import mongoose from "mongoose";
import Department from "@/models/Department";
import Employee from "@/models/Employee";

/**
 * DB side of the data scopes (pure rules: scopes.js). Callers must have
 * called dbConnect() first.
 */

/**
 * The employee linked to an account. Employee.userId is THE link (one-to-one,
 * lib/accountLinks.js); there is no email or token fallback, so an unlinked
 * account never resolves to somebody else's record. `select` null = all fields.
 */
export async function employeeOfUser(userId, select = null) {
  if (!userId || !mongoose.isValidObjectId(userId)) return null;
  const q = Employee.findOne({ userId });
  if (select) q.select(select);
  return q.lean();
}

/**
 * The caller's own Employee, or null for an account with no linked employee.
 * Never reads ids from the request.
 */
export function getOwnEmployee(session, select = "_id departmentId department email") {
  return employeeOfUser(session?.user?.id, select);
}

/** Employee _ids (strings) in these departments, matched by departmentId or code. */
export async function employeeIdsInDepartments(departmentIds) {
  const ids = (departmentIds || []).filter((id) => mongoose.isValidObjectId(id));
  if (!ids.length) return [];
  const depts = await Department.find({ _id: { $in: ids } }).select("_id code").lean();
  if (!depts.length) return [];
  const emps = await Employee.find({
    $or: [
      { departmentId: { $in: depts.map((d) => d._id) } },
      { department: { $in: depts.map((d) => d.code).filter(Boolean) } },
    ],
  })
    .select("_id")
    .lean();
  return emps.map((e) => String(e._id));
}

/** A department scope → null (everyone) or the employee ids it covers. */
export async function employeeIdsForScope(scope) {
  if (scope?.all) return null;
  return employeeIdsInDepartments(scope?.departmentIds);
}

/** Is this employee inside the scope? */
export async function isEmployeeInScope(scope, employeeId) {
  if (scope?.all) return true;
  if (!employeeId) return false;
  const ids = await employeeIdsForScope(scope);
  return ids.includes(String(employeeId));
}

/**
 * An employee's Department _id (string): departmentId, else looked up by
 * the department code older documents carry.
 */
export async function departmentIdOf(employee) {
  if (!employee) return null;
  if (employee.departmentId) return String(employee.departmentId);
  if (!employee.department) return null;
  const dept = await Department.findOne({ code: employee.department }).select("_id").lean();
  return dept ? String(dept._id) : null;
}
