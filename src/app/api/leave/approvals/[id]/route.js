// GET /api/leave/approvals/[id] — one leave for the อนุมัติการลา detail panel,
// with the caller's available actions (lib/leave/approval.js). Anyone who may
// not see it gets the same 404 as a missing id.
import { NextResponse } from "next/server";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import { approvalDetail } from "@/lib/leave/approval";
import { leaveErrorResponse } from "@/lib/leave/requests";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  try {
    const gate = await requireAnyPageApi(["dashboard", "leave_approve"]);
    if (gate.res) return gate.res;
    await dbConnect();
    const { id } = await params;
    return NextResponse.json({ ok: true, ...(await approvalDetail(gate.session, id)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const { body, status } = leaveErrorResponse(err, "GET /api/leave/approvals/[id]");
    return NextResponse.json(body, { status });
  }
}
