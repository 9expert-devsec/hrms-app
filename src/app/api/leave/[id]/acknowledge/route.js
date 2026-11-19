// POST /api/leave/[id]/acknowledge { revision?, signature? } — the other
// approver's รับทราบ; never blocks HR (lib/leave/approval.js).
import { NextResponse } from "next/server";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import { acknowledgeLeave } from "@/lib/leave/approval";
import { leaveErrorResponse } from "@/lib/leave/requests";

export async function POST(req, { params }) {
  try {
    const gate = await requireAnyPageApi(["dashboard", "leave_approve"]);
    if (gate.res) return gate.res;
    await dbConnect();
    const { id } = await params;
    const leave = await acknowledgeLeave(gate.session, id, await req.json().catch(() => ({})));
    return NextResponse.json({ ok: true, leave: { _id: String(leave._id), status: leave.status } });
  } catch (err) {
    const { body, status } = leaveErrorResponse(err, "POST /api/leave/[id]/acknowledge");
    return NextResponse.json(body, { status });
  }
}
