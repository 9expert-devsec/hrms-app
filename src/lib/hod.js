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

export const HEAD_FIELDS = "_id firstName lastName firstNameTh lastNameTh empAutoId userId";

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
          firstNameTh: head.firstNameTh ?? "",
          lastNameTh: head.lastNameTh ?? "",
          empAutoId: head.empAutoId ?? null,
          userId: head.userId ? String(head.userId) : null,
        }
      : null,
    headHasAccount: !!head?.userId,
  };
}

/**
 * Set (or, with null, clear) a department's head — the ONE write path for
 * headOfDepartment (settings page, HOD endpoints, department edit form).
 * Validates that the department exists and, when given, that the employee
 * exists.
 *
 * Clearing — the department HAS a head and `employeeId` is null/empty — is
 * superadmin-only: `actor` (session.user) must have isSuperadmin === true,
 * otherwise 403. A request that leaves the head as it is (same employee, or
 * null on a department with no head) is not a clear and always passes.
 *
 * Returns { _id, code, name, color, head, headHasAccount }.
 */
export async function setDepartmentHead(departmentId, employeeId, { actor } = {}) {
  if (!mongoose.isValidObjectId(departmentId)) throw new HodError("Invalid department id", 400);
  const current = await Department.findById(departmentId).select("headOfDepartment").lean();
  if (!current) throw new HodError("ไม่พบแผนก", 404);

  let headId = null;
  if (employeeId != null && employeeId !== "") {
    if (!mongoose.isValidObjectId(employeeId)) throw new HodError("Invalid employee id", 400);
    const emp = await Employee.exists({ _id: employeeId });
    if (!emp) throw new HodError("ไม่พบพนักงาน", 404);
    headId = emp._id;
  }

  if (headId === null && current.headOfDepartment && actor?.isSuperadmin !== true) {
    throw new HodError("เฉพาะ superadmin เท่านั้นที่ล้างหัวหน้าแผนกได้", 403);
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

/**
 * Employees who may be picked as a head: everyone (any level, any
 * department, with or without a login account — callers flag those without
 * one). Optional `q` searches name, nickname and position. Shared by
 * /api/employees/head-candidates and the department edit page.
 */
export async function listHeadCandidates(q = "") {
  const match = {};
  const query = String(q || "").trim();
  if (query) {
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    match.$or = [
      { firstName: regex },
      { lastName: regex },
      { firstNameTh: regex },
      { lastNameTh: regex },
      { nickName: regex },
      { position: regex },
    ];
  }
  return Employee.find(match)
    .select("_id firstName lastName firstNameTh lastNameTh nickName empAutoId position level department userId photoUrl")
    .sort({ level: -1, firstName: 1 })
    .lean();
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
