// src/app/api/users/[id]/password/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import { hash } from "bcryptjs";
import mongoose from "mongoose";
import { requireSessionAPI } from "@/lib/authz";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwordRules";
import { canAccess } from "@/lib/rbac/access";
import { getRoleByKey } from "@/lib/rbac/resolveRole";

/**
 * Who may set a password:
 *   - anyone, for their own account
 *   - the superadmin, for anyone
 *   - holders of `employees`, for anyone EXCEPT a superadmin-role account
 * (The `it` role could reset any password before; it no longer can.)
 */
// AUTH-ONLY: own password for any signed-in user; resetting others is checked below.
export async function PUT(req, { params }) {
  const gate = await requireSessionAPI();
  if (gate.res) return gate.res;
  const { session } = gate;

  const { id } = await params; // <-- ต้องเป็น userId
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ ok: false, message: "invalid user id" }, { status: 400 });
  }

  await dbConnect();
  const { password } = await req.json().catch(() => ({}));
  if (!password || String(password).length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json({ ok: false, message: "password too short" }, { status: 400 });
  }

  const isSelf = !!session.user.id && String(session.user.id) === String(id);
  if (!isSelf) {
    const target = await User.findById(id).select("role").lean();
    if (!target) return new NextResponse("Not found", { status: 404 });

    if (session.user.isSuperadmin !== true) {
      if (!canAccess(session.user, "employees")) {
        return new NextResponse("Forbidden", { status: 403 });
      }
      const targetRole = await getRoleByKey(target.role);
      if (targetRole.isSuperadmin) {
        return NextResponse.json(
          { ok: false, message: "เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่ตั้งรหัสผ่านบัญชีนี้ได้" },
          { status: 403 }
        );
      }
    }
  }

  const newHash = await hash(String(password), 10);
  const upd = await User.findByIdAndUpdate(id, { passwordHash: newHash, updatedAt: new Date() });
  if (!upd) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({ ok: true });
}
