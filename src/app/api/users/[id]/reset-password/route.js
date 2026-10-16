// src/app/api/users/[id]/reset-password/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import { issueTemporaryPassword, AccountError } from "@/lib/accounts";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/**
 * Issue a temporary password (shown ONCE to the operator) and force a
 * password change at the user's next sign-in. Never logs the password.
 */
export async function POST(_req, { params }) {
  try {
    const gate = await requirePageApi("users_manage");
    if (gate.res) return gate.res;

    const { id } = await params;
    await dbConnect();
    const { tempPassword, email } = await issueTemporaryPassword(id, { actor: gate.session.user });
    return NextResponse.json({ ok: true, email, tempPassword }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AccountError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: err.status, headers: NO_STORE });
    }
    console.error("POST /api/users/[id]/reset-password error:", err?.message);
    return NextResponse.json({ ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, { status: 500, headers: NO_STORE });
  }
}
