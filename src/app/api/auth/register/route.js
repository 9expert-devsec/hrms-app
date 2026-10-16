import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import Employee from "@/models/Employee";
import bcrypt from "bcryptjs";
import { requireSuperadminApi } from "@/lib/rbac/guard";
import { assertAssignableRole, RoleError } from "@/lib/rbac/roles";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwordRules";

export const runtime = "nodejs";

// Creates a login with any role, so it is superadmin-only — the same as its
// only caller, /dashboard/admin/register. It used to have no auth check.
export async function POST(req) {
  try {
    const gate = await requireSuperadminApi();
    if (gate.res) return gate.res;

    const { name, email, password, role: rawRole = "employee" } = await req.json();
    if (!email || !password) {
      return Response.json({ error: "email/password required" }, { status: 400 });
    }
    if (String(password).length < PASSWORD_MIN_LENGTH) {
      return Response.json({ error: `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร` }, { status: 400 });
    }
    const role = String(rawRole || "employee").trim().toLowerCase();

    await dbConnect();

    // The role must be a known key (roles collection or seed) — never stored blindly.
    try {
      await assertAssignableRole(role, { actor: gate.session.user });
    } catch (e) {
      if (e instanceof RoleError) return Response.json({ error: e.message }, { status: e.status });
      throw e;
    }

    const existed = await User.findOne({ email });
    if (existed) return Response.json({ error: "Email already in use" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name || email, email, passwordHash, role });

    // ผูก userId กลับไปที่ employee (ถ้ามีพนักงานอีเมลนี้อยู่)
    await Employee.updateOne({ email }, { $set: { userId: user._id } }).exec();

    return Response.json({ ok: true, id: user._id, email: user.email, role: user.role }, { status: 201 });
  } catch (e) {
    console.error("[REGISTER]", e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
