// GET /api/leave/balance?fy=<Gregorian start year> — วันลาคงเหลือ on the
// round-39 quotas and the round-40 usage (lib/leave/balance.js). The old
// LeaveBalance collection is no longer read (nor written, nor deleted).
import { NextResponse } from "next/server";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import { leaveBalance } from "@/lib/leave/balance";
import { leaveErrorResponse } from "@/lib/leave/requests";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const gate = await requireAnyPageApi(["self_leave_balance", "self_leave_request"]);
    if (gate.res) return gate.res;
    await dbConnect();
    const fy = new URL(req.url).searchParams.get("fy");
    return NextResponse.json({ ok: true, ...(await leaveBalance(gate.session, { fiscalYear: fy })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const { body, status } = leaveErrorResponse(err, "GET /api/leave/balance");
    return NextResponse.json(body, { status });
  }
}
