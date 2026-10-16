import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import User from "@/models/User";
import { requireAnyPageApi, requirePageApi } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import cloudinary from "@/lib/cloudinary";

export async function PUT(req, { params }) {
  // Own profile (self_profile, self fields) or any employee (employees).
  const gate = await requireAnyPageApi(["self_profile", "employees"]);
  if (gate.res) return gate.res;
  const { session } = gate;

  await dbConnect();

  const id = params.id;
  const emp = await Employee.findById(id).lean();
  if (!emp) return new Response("Not found", { status: 404 });

  const canManage = canAccess(session.user, "employees");
  // Self = the employee linked to this account (Employee.userId), never an
  // email match — an unlinked account must not edit whoever shares its email.
  const isSelf = !!emp.userId && String(emp.userId) === String(session.user.id || "");

  if (!(isSelf || canManage)) {
    return new Response("Forbidden", { status: 403 });
  }

  const payload = await req.json();

  // สิทธิ์การแก้ไข
  const selfFields = [
    "firstName",
    "lastName",
    "nickName",
    "phone",
    "address",
    "photoUrl",
    "photoPublicId",
    "emergency",
  ];
  const adminExtra = [
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

  const allowed = canManage
    ? [...selfFields, ...adminExtra]
    : selfFields;

  const update = {};
  for (const k of allowed) {
    if (payload[k] !== undefined) update[k] = payload[k];
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

  await Employee.findByIdAndUpdate(id, update);
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
