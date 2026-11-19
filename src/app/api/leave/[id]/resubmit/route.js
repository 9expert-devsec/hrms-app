// POST /api/leave/[id]/resubmit — the owner sends a returned leave again
// (ส่งใหม่): same checks as POST /api/leave, approvals cleared, revision + 1,
// approval restarts at step 1 (lib/leave/requests.js).
import { NextResponse } from "next/server";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import { resubmitLeave, leaveErrorResponse } from "@/lib/leave/requests";

export async function POST(req, { params }) {
  try {
    const gate = await requirePageApi("self_leave_request");
    if (gate.res) return gate.res;
    await dbConnect();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const leave = await resubmitLeave(gate.session, id, body);
    return NextResponse.json({ ok: true, leave: { _id: String(leave._id), status: leave.status, revision: leave.revision } });
  } catch (err) {
    const { body, status } = leaveErrorResponse(err, "POST /api/leave/[id]/resubmit");
    return NextResponse.json(body, { status });
  }
}
