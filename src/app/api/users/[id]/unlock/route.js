// src/app/api/users/[id]/unlock/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import { unlockAccount, AccountError } from "@/lib/accounts";

/**
 * Lift a sign-in lock (lib/loginLockout.js) before it expires. Same guard
 * rails as reset/suspend: not your own account, and a superadmin account
 * only by a superadmin.
 */
export async function POST(_req, { params }) {
  try {
    const gate = await requirePageApi("users_manage");
    if (gate.res) return gate.res;

    const { id } = await params;
    await dbConnect();
    const item = await unlockAccount(id, { actor: gate.session.user });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    if (err instanceof AccountError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: err.status });
    }
    console.error("POST /api/users/[id]/unlock error:", err?.message);
    return NextResponse.json({ ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, { status: 500 });
  }
}
