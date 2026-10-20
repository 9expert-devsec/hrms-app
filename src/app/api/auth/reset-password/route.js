// src/app/api/auth/reset-password/route.js — PUBLIC: set a new password with an emailed link.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { resetPasswordWithToken } from "@/lib/passwordReset";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST { token, newPassword, confirmPassword } → { ok: true } or 400
 * { ok: false, reason: invalid | expired | used | password, message (Thai) }.
 * The token is never logged.
 */
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  try {
    await dbConnect();
    const result = await resetPasswordWithToken({
      token: body?.token,
      newPassword: body?.newPassword,
      confirmPassword: body?.confirmPassword,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: NO_STORE });
  } catch (e) {
    console.error("[password-reset] reset failed:", e?.message);
    return NextResponse.json({ ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, { status: 500, headers: NO_STORE });
  }
}
