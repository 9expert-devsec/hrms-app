// POST /api/leave/[id]/cancel-request { reason } — the owner asks to cancel an
// approved leave; an HR signer decides (lib/leave/cancel.js).
import { NextResponse } from "next/server";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import { requestCancel } from "@/lib/leave/cancel";
import { leaveErrorResponse } from "@/lib/leave/requests";

export async function POST(req, { params }) {
  try {
    const gate = await requireAnyPageApi(["dashboard", "self_leave_history", "self_leave_document"]);
    if (gate.res) return gate.res;
    await dbConnect();
    const { id } = await params;
    const leave = await requestCancel(gate.session, id, await req.json().catch(() => ({})));
    return NextResponse.json({ ok: true, leave: { _id: String(leave._id), status: leave.status } });
  } catch (err) {
    const { body, status } = leaveErrorResponse(err, "POST /api/leave/[id]/cancel-request");
    return NextResponse.json(body, { status });
  }
}
