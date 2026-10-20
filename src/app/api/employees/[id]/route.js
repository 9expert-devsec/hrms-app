import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import User from "@/models/User";
import mongoose from "mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import cloudinary from "@/lib/cloudinary";
import { thaiNameError } from "@/lib/employeeName";
import {
  FIELD_LABELS,
  LEVEL_ERROR,
  fieldFromServerError,
  firstFormError,
  isValidLevel,
  validateEmployeeForm,
} from "@/lib/employeeFormRules";

const bad = (message, field = null) =>
  new Response(JSON.stringify({ ok: false, message, ...(field ? { field } : {}) }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });

/** "YYYY-MM-DD" for a stored or sent date; "" when missing or invalid. */
function dateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/**
 * An employee record in the form's terms (lib/employeeFormRules.js keys).
 * Department needs both the code and the id; the position's name stands in
 * for the form's positionId — so clearing either reads as a cleared field.
 */
function formValuesOf(e) {
  const s = (v) => (v == null ? "" : String(v).trim());
  return {
    titleTh: s(e.titleTh),
    firstNameTh: s(e.firstNameTh),
    lastNameTh: s(e.lastNameTh),
    firstName: s(e.firstName),
    lastName: s(e.lastName),
    departmentId: s(e.department) && s(e.departmentId) ? s(e.departmentId) : "",
    positionId: s(e.position),
    dateOfJoin: dateInput(e.dateOfJoin),
    phone: s(e.phone),
    email: s(e.email),
    birthday: dateInput(e.birthday),
    address: s(e.address),
  };
}

// Schema paths → the form field a validation error is shown on.
const PATH_FIELD = { department: "departmentId", position: "positionId", level: "positionId" };

// Fields HR may edit. An employee's own changes (photo, nickname, phone only)
// go through PATCH /api/employees/me.
const EDITABLE_FIELDS = [
  "firstName",
  "lastName",
  "titleTh",
  "firstNameTh",
  "lastNameTh",
  "nickName",
  "phone",
  "address",
  "photoUrl",
  "photoPublicId",
  "emergency",
  "department",
  "departmentId",
  "position",
  "level",
  "dateOfJoin",
  "email",
  "privateInfo",
  "gender",
  "birthday",
];

export async function PUT(req, { params }) {
  // HR only (`employees` holders and the superadmin) — own record included:
  // names and private data are not self-service (round 16).
  const gate = await requirePageApi("employees");
  if (gate.res) return gate.res;

  await dbConnect();

  const id = params.id;
  const emp = await Employee.findById(id).lean();
  if (!emp) return new Response("Not found", { status: 404 });

  const payload = await req.json();
  const allowed = EDITABLE_FIELDS;

  const update = {};
  for (const k of allowed) {
    if (payload[k] !== undefined) update[k] = payload[k];
  }

  // The form's rules on the record as it would be saved (stored + changes):
  // required fields may not be cleared; phone / email format only for a value
  // that CHANGED (a stored 9-digit phone stays saveable on unrelated edits).
  const formError = firstFormError(
    validateEmployeeForm(formValuesOf({ ...emp, ...update }), { mode: "edit", stored: formValuesOf(emp) })
  );
  if (formError) return bad(formError.message, formError.field);
  if ("level" in update && Number(update.level) !== Number(emp.level) && !isValidLevel(update.level)) {
    return bad(LEVEL_ERROR, "positionId");
  }

  // Thai name: optional on edit (existing staff are filled in over time), but
  // a stored value may not be cleared and the title must be one of the three.
  const thaiSent = Object.fromEntries(
    ["titleTh", "firstNameTh", "lastNameTh"].filter((k) => k in update).map((k) => [k, update[k]])
  );
  const thaiError = thaiNameError(thaiSent, { mode: "edit", current: emp });
  if (thaiError) return bad(thaiError, fieldFromServerError({ message: thaiError }));
  for (const k of Object.keys(thaiSent)) {
    const v = typeof update[k] === "string" ? update[k].trim() : "";
    if (v) update[k] = v;
    else delete update[k]; // empty on a record that never had one: leave it unset
  }
  update.updatedAt = new Date();

  if (
    update.photoPublicId &&
    update.photoPublicId !== emp.photoPublicId &&
    emp.photoPublicId
  ) {
    try {
      await cloudinary.uploader.destroy(emp.photoPublicId);
    } catch (e) {
      console.warn("Cloudinary destroy failed:", e?.message);
    }
  }

  // Schema validators too (required, level 1–6, enums): they did not run here before.
  try {
    await Employee.findByIdAndUpdate(id, update, { runValidators: true });
  } catch (e) {
    if (e instanceof mongoose.Error.ValidationError || e instanceof mongoose.Error.CastError) {
      const path = e.errors ? Object.keys(e.errors)[0] : e.path;
      const field = PATH_FIELD[path] || (FIELD_LABELS[path] ? path : null);
      return bad(`ข้อมูลไม่ถูกต้อง: ${FIELD_LABELS[field] || path}`, field);
    }
    throw e;
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

/**
 * DELETE /api/employees/[id]
 * ลบพนักงาน — the linked account is NOT deleted: deleting accounts is
 * superadmin-only (DELETE /api/users/[id]). It used to delete every user
 * whose email matched, which could remove an unrelated (even superadmin)
 * account. The account is left unlinked; suspend or delete it on the users page.
 * กันไม่ให้ลบตัวเอง
 */
export async function DELETE(req, { params }) {
  const gate = await requirePageApi("employees");
  if (gate.res) return gate.res;
  const { session } = gate;

  await dbConnect();

  const id = params.id;
  const emp = await Employee.findById(id);
  if (!emp) return new Response("Not found", { status: 404 });

  // กันลบตัวเอง (ลดความเสี่ยงล็อกตัวเองออกจากระบบ)
  const isSelf = !!emp.userId && String(emp.userId) === String(session.user.id || "");
  if (isSelf) {
    return new Response(
      JSON.stringify({ ok: false, message: "You cannot delete yourself." }),
      { status: 400 }
    );
  }

  // ลบรูปเดิมใน Cloudinary ถ้ามี
  if (emp.photoPublicId) {
    try {
      await cloudinary.uploader.destroy(emp.photoPublicId);
    } catch (e) {
      console.warn("Cloudinary destroy failed:", e?.message);
    }
  }

  // The linked account stays (unlinked) — clear its mirror of this employee.
  const unlinkedUserId = emp.userId ? String(emp.userId) : null;
  if (emp.userId) {
    await User.updateOne({ _id: emp.userId, employeeId: emp._id }, { $set: { employeeId: null } });
  }

  await Employee.findByIdAndDelete(id);

  return new Response(
    JSON.stringify({ ok: true, deletedUsers: 0, unlinkedUserId }),
    { status: 200 }
  );
}
