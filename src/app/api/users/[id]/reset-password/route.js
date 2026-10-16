// src/app/api/users/[id]/reset-password/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import { resetPassword, AccountError } from "@/lib/accounts";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/**
 * Reset another person's password; they must change it at next sign-in.
 *   body { password } → the admin typed it (min length, checked here too);
 *                       the response never contains it.
 *   no password       → a random temporary one, returned ONCE as tempPassword.
 * Never logs a password.
 */
export async function POST(req, { params }) {
  try {
    const gate = await requirePageApi("users_manage");
    if (gate.res) return gate.res;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === "string" ? body.password : undefined;
    if (body?.password !== undefined && password === undefined) {
      return NextResponse.json({ ok: false, message: "รหัสผ่านไม่ถูกต้อง" }, { status: 400, headers: NO_STORE });
    }

    await dbConnect();
    const result = await resetPassword(id, { actor: gate.session.user, password });
    return NextResponse.json(
      result.tempPassword
        ? { ok: true, mode: "random", email: result.email, tempPassword: result.tempPassword }
        : { ok: true, mode: "typed", email: result.email },
      { headers: NO_STORE }
    );
  } catch (err) {
    if (err instanceof AccountError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: err.status, headers: NO_STORE });
    }
    console.error("POST /api/users/[id]/reset-password error:", err?.message);
    return NextResponse.json({ ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, { status: 500, headers: NO_STORE });
  }
}
