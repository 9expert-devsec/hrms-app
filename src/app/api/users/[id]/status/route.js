// src/app/api/users/[id]/status/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import { setAccountStatus, AccountError } from "@/lib/accounts";

/**
 * Suspend or reactivate an account: { status: "suspended" | "active" }.
 * A suspended user's open sessions end at the next permission refresh
 * (≤ 5 min) and sign-in is refused.
 */
export async function PATCH(req, { params }) {
  try {
    const gate = await requirePageApi("users_manage");
    if (gate.res) return gate.res;

    const { id } = await params;
    const { status } = await req.json().catch(() => ({}));
    await dbConnect();
    const item = await setAccountStatus(id, status, { actor: gate.session.user });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    if (err instanceof AccountError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: err.status });
    }
    console.error("PATCH /api/users/[id]/status error:", err?.message);
    return NextResponse.json({ ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, { status: 500 });
  }
}
