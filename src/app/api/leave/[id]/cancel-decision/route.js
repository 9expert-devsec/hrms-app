// POST /api/leave/[id]/cancel-decision { decision: approved|rejected, note, revision? }
// HR signers only; approved → cancelled (days come back), rejected → approved
// (lib/leave/cancel.js).
import { NextResponse } from "next/server";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import { decideCancel } from "@/lib/leave/cancel";
import { leaveErrorResponse } from "@/lib/leave/requests";

export async function POST(req, { params }) {
  try {
    const gate = await requireAnyPageApi(["dashboard", "leave_approve"]);
    if (gate.res) return gate.res;
    await dbConnect();
    const { id } = await params;
    const leave = await decideCancel(gate.session, id, await req.json().catch(() => ({})));
    return NextResponse.json({ ok: true, leave: { _id: String(leave._id), status: leave.status } });
  } catch (err) {
    const { body, status } = leaveErrorResponse(err, "POST /api/leave/[id]/cancel-decision");
    return NextResponse.json(body, { status });
  }
}
