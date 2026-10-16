// src/app/api/account/password/route.js — change one's OWN password.
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import { requirePasswordChangeApi } from "@/lib/rbac/guard";
import { validateNewPassword } from "@/lib/passwordRules";
import { BCRYPT_COST } from "@/lib/accounts";
import { forgetCachedPermissions } from "@/lib/rbac/sessionPerms";

/**
 * { currentPassword, newPassword, confirmPassword }. The only API that works
 * while mustChangePassword is set. Needs the current (or temporary) password;
 * clears mustChangePassword and stamps passwordChangedAt. The client then
 * calls useSession().update() so the JWT is re-read without a new sign-in.
 */
export async function POST(req) {
  try {
    const gate = await requirePasswordChangeApi();
    if (gate.res) return gate.res;
    const uid = gate.session.user.id;

    const { currentPassword, newPassword, confirmPassword } = await req.json().catch(() => ({}));
    if (typeof currentPassword !== "string" || !currentPassword) {
      return NextResponse.json({ ok: false, message: "กรุณากรอกรหัสผ่านปัจจุบัน" }, { status: 400 });
    }
    const invalid = validateNewPassword({ newPassword, confirmPassword, currentPassword });
    if (invalid) return NextResponse.json({ ok: false, message: invalid }, { status: 400 });

    await dbConnect();
    const user = mongoose.isValidObjectId(uid)
      ? await User.findById(uid).select("passwordHash status").lean()
      : null;
    if (!user || (user.status && user.status !== "active")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash || "");
    if (!ok) {
      return NextResponse.json({ ok: false, message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 400 });
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST),
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
        },
      }
    );
    forgetCachedPermissions(uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/account/password error:", err?.message);
    return NextResponse.json({ ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, { status: 500 });
  }
}
