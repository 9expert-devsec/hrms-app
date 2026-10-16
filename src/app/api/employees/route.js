// src/app/api/employees/route.js
import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import dbConnect from "@/lib/mongoose";
import Department from "@/models/Department";
import Employee from "@/models/Employee";
import User from "@/models/User";
import Counter from "@/models/Counter";
import { hash } from "bcryptjs";
import { uploadFromBuffer } from "@/lib/cloudinary";
import { requireAnyPageApi, requirePageApi } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import { assertAssignableRole, RoleError } from "@/lib/rbac/roles";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwordRules";

// Without `employees`, callers (the shift-assign picker) get no contact data.
const FULL_FIELDS =
  "_id empId empAutoId firstName lastName nickName department position level email phone photoUrl departmentId userId";
const PICKER_FIELDS = "_id empAutoId firstName lastName nickName department position photoUrl";

export async function GET(req) {
  try {
    // Shared read: the employee screens and the shift-assign picker.
    const gate = await requireAnyPageApi(["employees", "shift_assign"]);
    if (gate.res) return gate.res;

    await dbConnect();

    const fields = canAccess(gate.session.user, "employees") ? FULL_FIELDS : PICKER_FIELDS;
    const items = await Employee.find({})
      .select(fields)
      .sort({ department: 1, firstName: 1 })
      .lean();

    return NextResponse.json({ ok: true, employees: items }, { status: 200 });
  } catch (err) {
    console.error("GET /api/employees error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const gate = await requirePageApi("employees");
    if (gate.res) return gate.res;
    const { session } = gate;

    await dbConnect();

    const form = await req.formData();
    const g = (k, d = "") => form.get(k)?.toString()?.trim?.() ?? d;

    // --- validate dep/pos ---
    const departmentId = g("departmentId");
    const positionId   = g("positionId");
    if (!mongoose.isValidObjectId(departmentId))
      return NextResponse.json({ ok:false, message:"departmentId invalid" }, { status:400 });
    if (!mongoose.isValidObjectId(positionId))
      return NextResponse.json({ ok:false, message:"positionId invalid" }, { status:400 });

    const dep = await Department.findById(departmentId).lean();
    if (!dep)  return NextResponse.json({ ok:false, message:"department not found" }, { status:404 });
    const pos = (dep.positions || []).find(p => String(p._id) === String(positionId));
    if (!pos)  return NextResponse.json({ ok:false, message:"position invalid" }, { status:400 });

    const department = dep.code || dep.name || "UNKNOWN";
    const position   = pos.name;
    const level      = Number(pos.level ?? 0);

    // --- fields ---
    const firstName  = g("firstName");
    const lastName   = g("lastName");
    const nickName   = g("nickName");
    const dateOfJoin = g("dateOfJoin");
    const phone      = g("phone");
    const email      = g("email");
    const birthday   = g("birthday");
    const address    = g("address");
    const genderMap  = { "ชาย":"male","หญิง":"female","อื่น ๆ":"other", male:"male", female:"female", other:"other" };
    const gender     = genderMap[g("gender")] || "other";

    if (!firstName || !lastName || !dateOfJoin || !phone || !email || !birthday || !address)
      return NextResponse.json({ ok:false, message:"ข้อมูลจำเป็นไม่ครบ" }, { status:400 });

    const emergency = {
      firstName: g("emergency.firstName"),
      lastName: g("emergency.lastName"),
      relationship: g("emergency.relationship"),
      phone: g("emergency.phone"),
      email: g("emergency.email"),
      address: g("emergency.address"),
    };

    const privateInfo = {
      bankAccountName: g("privateInfo.bankAccountName"),
      bankAccountNo:   g("privateInfo.bankAccountNo"),
      bankBranch:      g("privateInfo.bankBranch"),
      bankName:        g("privateInfo.bankName"),
      bankCode:        g("privateInfo.bankCode"),
    };

    // --- login role: validated before any write (counter, upload, user) ---
    // Must be a known key; only a superadmin may grant a superadmin role.
    const createLogin = g("createLogin").toLowerCase() === "true";
    const role        = (g("role") || "employee").toLowerCase();
    if (createLogin) {
      try {
        // Non-superadmins may only create "employee" accounts.
        await assertAssignableRole(role, { actor: session.user });
      } catch (e) {
        if (e instanceof RoleError) return NextResponse.json({ ok:false, message:e.message }, { status:e.status });
        throw e;
      }
      // Same minimum length as every other password that gets set.
      if (g("password").length < PASSWORD_MIN_LENGTH) {
        return NextResponse.json({ ok:false, message:`รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร` }, { status:400 });
      }
    }

    // --- upload photo (optional) ---
    const photoFile = form.get("photo");
    let photoUrl = "";
    let photoPublicId = "";
    if (photoFile && typeof photoFile === "object") {
      const buffer = Buffer.from(await photoFile.arrayBuffer());
      const uploaded = await uploadFromBuffer(buffer, {
        folder: "employees",
        filename_override: `${Date.now()}_${firstName}_${lastName}`,
      });
      photoUrl = uploaded.secure_url;
      photoPublicId = uploaded.public_id || "";
    }

    // --- running ids ---
    const counterDoc = await Counter.findByIdAndUpdate(
      "employee",
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    ).lean();
    const empAutoId = counterDoc.seq;

    const empIdPrefix = dep.empIdPrefix || dep.code || "EMP";
    const last = await Employee.findOne({ department }).sort({ createdAt: -1 }).lean();
    const lastRun = last?.empId?.split("-")?.[1] ? Number(last.empId.split("-")[1]) : 0;
    const empId = `${empIdPrefix}-${String(lastRun + 1).padStart(4, "0")}`;

    // --- create user? ---
    const accountEmail    = g("accountEmail");
    const password        = g("password");
    const passwordConfirm = g("passwordConfirm");

    let createdUser = null;
    if (createLogin) {
      if (!accountEmail || !password || password !== passwordConfirm) {
        return NextResponse.json({ ok:false, message:"ข้อมูลล็อกอินไม่ถูกต้อง" }, { status:400 });
      }
      createdUser = await User.create({
        email: accountEmail,
        passwordHash: await hash(password, 10),
        role,
        status: "active",
      });
    }

    // --- create employee (link userId ถ้ามี) ---
    const employee = await Employee.create({
      empId,
      empAutoId,
      firstName,
      lastName,
      nickName,
      departmentId: new Types.ObjectId(departmentId),
      department,
      position,
      level,
      dateOfJoin,
      phone,
      email: createLogin ? accountEmail : email,   // ให้ตรงบัญชีล็อกอิน
      birthday,
      address,
      gender,
      emergency,
      privateInfo,
      photoUrl,
      photoPublicId,
      userId: createdUser?._id || undefined,
    });

    if (createdUser) {
      await User.findByIdAndUpdate(createdUser._id, { employeeId: employee._id });
    }

    return NextResponse.json({ ok: true, employee }, { status: 201 });
  } catch (err) {
    console.error("POST /api/employees error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}
