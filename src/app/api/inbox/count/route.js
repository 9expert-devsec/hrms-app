// src/app/api/inbox/count/route.js — "รอคุณดำเนินการ": what waits on the caller.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import { inboxCounts } from "@/lib/inbox";

export const dynamic = "force-dynamic";

/**
 * GET → { total, items: [{ key, label, count, href }] } (lib/inbox.js).
 * Every role has `dashboard`; each group checks its own permission.
 */
export async function GET() {
  const gate = await requireAnyPageApi(["dashboard", "offsite_self", "leave_approve", "ot_approve"]);
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    return NextResponse.json(await inboxCounts(gate.session), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[inbox] count failed:", e?.message);
    return NextResponse.json({ total: 0, items: [], error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
