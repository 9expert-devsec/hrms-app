// src/lib/approvals/authz.js
// Helpers for the legacy LeaveRequest approval flow.
// HR checks use the RBAC registry: canAccess(session.user, "scope_leave_hr_step").
import mongoose from "mongoose";
import Employee from "@/models/Employee";
import Department from "@/models/Department";

/** The approver's linked employee (Employee.userId — lib/accountLinks.js), or null. */
export async function resolveActorEmployee(session) {
  const userId = session?.user?.id;
  if (!userId || !mongoose.isValidObjectId(userId)) return null;
  return Employee.findOne({ userId: new mongoose.Types.ObjectId(userId) });
}

export async function isHODForEmployee(actorEmpId, targetEmpId) {
  const target = await Employee.findById(targetEmpId).select("departmentId");
  if (!target?.departmentId) return false;
  const dept = await Department.findById(target.departmentId).select("headOfDepartment");
  return dept?.headOfDepartment?.toString() === actorEmpId?.toString();
}
