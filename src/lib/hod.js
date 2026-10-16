import "server-only";
import mongoose from "mongoose";
import Department from "@/models/Department";
import Employee from "@/models/Employee";

/**
 * Head of department — single store: Department.headOfDepartment (→ Employee).
 * Both Settings › กำหนด HOD and the department edit form write through
 * setDepartmentHead. A head needs no login account (headHasAccount says
 * whether they can approve in the system), may head several departments,
 * and need not belong to the department they head.
 * Callers must have called dbConnect() first.
 */

export const HEAD_FIELDS = "_id firstName lastName empAutoId userId";

/** Thrown for bad input; `status` is the HTTP status to answer with. */
export class HodError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function toItem(dept) {
  const head = dept.headOfDepartment && typeof dept.headOfDepartment === "object" ? dept.headOfDepartment : null;
  return {
    _id: String(dept._id),
    code: dept.code,
    name: dept.name,
    color: dept.color ?? null,
    head: head
      ? {
          _id: String(head._id),
          firstName: head.firstName ?? "",
          lastName: head.lastName ?? "",
          empAutoId: head.empAutoId ?? null,
          userId: head.userId ? String(head.userId) : null,
        }
      : null,
    headHasAccount: !!head?.userId,
  };
}

/**
 * Set (or, with null, clear) a department's head. Validates that the
 * department exists and, when given, that the employee exists.
 * Returns { _id, code, name, head, headHasAccount }.
 */
export async function setDepartmentHead(departmentId, employeeId) {
  if (!mongoose.isValidObjectId(departmentId)) throw new HodError("Invalid department id", 400);
  const exists = await Department.exists({ _id: departmentId });
  if (!exists) throw new HodError("ไม่พบแผนก", 404);

  let headId = null;
  if (employeeId != null && employeeId !== "") {
    if (!mongoose.isValidObjectId(employeeId)) throw new HodError("Invalid employee id", 400);
    const emp = await Employee.exists({ _id: employeeId });
    if (!emp) throw new HodError("ไม่พบพนักงาน", 404);
    headId = emp._id;
  }

  const updated = await Department.findByIdAndUpdate(
    departmentId,
    { $set: { headOfDepartment: headId } },
    { new: true }
  )
    .select("_id code name color headOfDepartment")
    .populate("headOfDepartment", HEAD_FIELDS)
    .lean();
  return toItem(updated);
}

/** Every department with its head: [{ _id, code, name, head, headHasAccount }]. */
export async function listDepartmentHeads() {
  const depts = await Department.find({})
    .select("_id code name color headOfDepartment")
    .populate("headOfDepartment", HEAD_FIELDS)
    .sort({ code: 1 })
    .lean();
  return depts.map(toItem);
}
