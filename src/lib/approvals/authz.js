// src/lib/approvals/authz.js
// Helpers for the legacy LeaveRequest approval flow.
// HR checks use the RBAC registry: canAccess(session.user, "scope_leave_hr_step").
import mongoose from "mongoose";
import Employee from "@/models/Employee";
import Department from "@/models/Department";

export async function resolveActorEmployee(session) {
  // พยายามให้ครบทุกเคส: มี employeeId ใน session / มี userId เดียว
  const empId = session?.user?.employeeId || session?.user?.employee?._id;
  if (empId) {
    const e = await Employee.findById(empId);
    if (e) return e;
  }
  const userId = session?.user?.id || session?.user?._id || session?.user?.userId;
  if (userId && mongoose.isValidObjectId(userId)) {
    const e = await Employee.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    if (e) return e;
  }
  return null;
}

export async function isHODForEmployee(actorEmpId, targetEmpId) {
  const target = await Employee.findById(targetEmpId).select("departmentId");
  if (!target?.departmentId) return false;
  const dept = await Department.findById(target.departmentId).select("headOfDepartment");
  return dept?.headOfDepartment?.toString() === actorEmpId?.toString();
}
