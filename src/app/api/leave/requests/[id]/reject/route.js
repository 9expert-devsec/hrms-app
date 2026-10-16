// POST /api/leave/requests/:id/reject
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireSuperadminApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import LeaveRequest from "@/models/LeaveRequest";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";

// The linked employee only (lib/accountLinks.js).
const resolveEmployeeFromSession = (session) => getOwnEmployee(session, null);

export async function POST(req, ctx) {
  // Orphan page (/dashboard/leave/approval): superadmin only. It used to
  // let any signed-in user reject any request.
  const gate = await requireSuperadminApi();
  if (gate.res) return gate.res;
  const { session } = gate;

  await dbConnect();

  const actor = await resolveEmployeeFromSession(session);

  const { id } = (await ctx.params) || {}; // ⬅️ รอ params ก่อน
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  const { reason = "" } = await req.json().catch(() => ({}));

  const doc = await LeaveRequest.findById(id);
  if (!doc) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const now = new Date();
  const set = {
    status: "rejected",
    updatedAt: now,
    "flow.rejected": { by: actor?._id || null, at: now, reason },
  };

  await LeaveRequest.updateOne({ _id: id }, { $set: set });
  const item = await LeaveRequest.findById(id).lean();
  return NextResponse.json({ ok: true, item });
}
