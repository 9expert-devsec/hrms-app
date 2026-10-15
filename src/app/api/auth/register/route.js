import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import Employee from "@/models/Employee";
import bcrypt from "bcryptjs";
import { requireSuperadminApi } from "@/lib/rbac/guard";

export const runtime = "nodejs";

// Creates a login with any role, so it is superadmin-only — the same as its
// only caller, /dashboard/admin/register. It used to have no auth check.
export async function POST(req) {
  try {
    const gate = await requireSuperadminApi();
    if (gate.res) return gate.res;

    const { name, email, password, role = "employee" } = await req.json();
    if (!email || !password) {
      return Response.json({ error: "email/password required" }, { status: 400 });
    }

    await dbConnect();

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
