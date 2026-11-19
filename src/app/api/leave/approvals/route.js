// GET /api/leave/approvals?tab=approve|acknowledge|hr|done — the caller's
// lists on อนุมัติการลา (lib/leave/approval.js). Who sees what is decided by
// the leave itself (approver snapshot, รับทราบ task, HR signer), not a role,
// so any signed-in user may ask; an empty list is the answer for others.
import { NextResponse } from "next/server";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import { listApprovals, approvalTabs } from "@/lib/leave/approval";
import { leaveErrorResponse } from "@/lib/leave/requests";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const gate = await requireAnyPageApi(["dashboard", "leave_approve"]);
    if (gate.res) return gate.res;
    await dbConnect();
    const tab = new URL(req.url).searchParams.get("tab") || "approve";
    const [list, meta] = await Promise.all([listApprovals(gate.session, tab), approvalTabs(gate.session)]);
    return NextResponse.json({ ok: true, ...list, ...meta }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const { body, status } = leaveErrorResponse(err, "GET /api/leave/approvals");
    return NextResponse.json(body, { status });
  }
}
