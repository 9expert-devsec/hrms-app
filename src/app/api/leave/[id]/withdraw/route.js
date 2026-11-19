// POST /api/leave/[id]/withdraw — the owner cancels their own leave before
// final approval (ยกเลิกใบลา): pending_approval / returned / pending_hr →
// cancelled, no approval needed (lib/leave/requests.js). After approval,
// cancelling is a request HR decides (round 42).
import { NextResponse } from "next/server";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import { withdrawLeave, leaveErrorResponse } from "@/lib/leave/requests";

export async function POST(req, { params }) {
  try {
    const gate = await requireAnyPageApi(["self_leave_request", "self_leave_history"]);
    if (gate.res) return gate.res;
    await dbConnect();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const leave = await withdrawLeave(gate.session, id, { note: body?.note });
    return NextResponse.json({ ok: true, leave: { _id: String(leave._id), status: leave.status } });
  } catch (err) {
    const { body, status } = leaveErrorResponse(err, "POST /api/leave/[id]/withdraw");
    return NextResponse.json(body, { status });
  }
}
