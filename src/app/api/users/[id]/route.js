// src/app/api/users/[id]/route.js
import { NextResponse } from "next/server";
import { requirePageApi } from "@/lib/rbac/guard";
import { assertAssignableRole, RoleError } from "@/lib/rbac/roles";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import mongoose from "mongoose";

export async function PATCH(req, { params }) {
  // Called from the employee edit form.
  const gate = await requirePageApi("employees");
  if (gate.res) return gate.res;
  const { session } = gate;

  const { id } = params; // userId
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ ok: false, message: "invalid user id" }, { status: 400 });
  }

  await dbConnect();
  const body = await req.json().catch(() => ({}));
  const update = {};

  // Only a superadmin may CHANGE a role (privilege escalation otherwise).
  // The employee edit form always sends the current role along with the
  // email, so an unchanged value is ignored rather than refused.
  if (body.role !== undefined && body.role !== null && body.role !== "") {
    const current = await User.findById(id).select("role").lean();
    if (!current) return new NextResponse("Not found", { status: 404 });
    const nextRole = String(body.role).trim().toLowerCase();
    if (nextRole !== current.role) {
      if (session.user.isSuperadmin !== true) {
        return NextResponse.json(
          { ok: false, message: "เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่เปลี่ยนบทบาทได้" },
          { status: 403 }
        );
      }
      // Must be a known role key — an unknown key is a 400, never stored.
      try {
        await assertAssignableRole(nextRole, session.user);
      } catch (e) {
        if (e instanceof RoleError) return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
        throw e;
      }
      update.role = nextRole;
    }
  }
  // (ถ้าจะให้เปลี่ยนอีเมลที่นี่ด้วยก็เพิ่ม validate และ assign ได้)

  const doc = await User.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!doc) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({ ok: true, user: { _id: String(doc._id), role: doc.role } });
}
