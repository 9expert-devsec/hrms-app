import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import cloudinary from "@/lib/cloudinary";

function escapeReg(s = "") {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  await dbConnect();

  const id = params.id;
  const emp = await Employee.findById(id).lean();
  if (!emp) return new Response("Not found", { status: 404 });

  const role = session.user.role;
  const isSelf =
    String(emp._id) === String(session.user.employeeId || "") ||
    emp.email?.toLowerCase() === session.user.email?.toLowerCase();

  if (!(isSelf || ["superadmin", "hr"].includes(role))) {
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

  const allowed = ["superadmin", "hr"].includes(role)
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
 * ลบพนักงาน + ลบบัญชีผู้ใช้ที่เชื่อมอยู่ทั้งหมด (employeeId หรือ email ตรงกันแบบ case-insensitive)
 * กันไม่ให้ลบตัวเอง
 */
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const role = session.user.role;
  if (!["superadmin", "hr"].includes(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  await dbConnect();

  const id = params.id;
  const emp = await Employee.findById(id);
  if (!emp) return new Response("Not found", { status: 404 });

  // กันลบตัวเอง (ลดความเสี่ยงล็อกตัวเองออกจากระบบ)
  const isSelf =
    String(emp._id) === String(session.user.employeeId || "") ||
    (emp.email &&
      emp.email.toLowerCase() === (session.user.email || "").toLowerCase());
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

  // หา user ที่เชื่อมกับ employee คนนี้ (ทั้งแบบ employeeId และอีเมล)
  const userQuery = {
    $or: [{ employeeId: emp._id }],
  };
  if (emp.email) {
    userQuery.$or.push({
      email: new RegExp(`^${escapeReg(emp.email)}$`, "i"),
    });
  }

  const users = await User.find(userQuery).select("_id");
  if (users.length) {
    await User.deleteMany({ _id: { $in: users.map((u) => u._id) } });
  }

  await Employee.findByIdAndDelete(id);

  return new Response(
    JSON.stringify({ ok: true, deletedUsers: users.length }),
    { status: 200 }
  );
}
