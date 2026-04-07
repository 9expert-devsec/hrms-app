// POST /api/leave/requests/:id/reject
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import dbConnect from "@/lib/mongoose";
import LeaveRequest from "@/models/LeaveRequest";
import Employee from "@/models/Employee";

async function resolveEmployeeFromSession(session) {
  const me = session?.user || session || {};
  const ids = [me.employeeId, me._id, me.id, session?.employeeId].filter(
    Boolean
  );
  const links = [me.userId, me.user, session?.userId].filter(Boolean);
  const emails = [
    me.email,
    session?.user?.email,
    me.workEmail,
    me.personalEmail,
  ].filter(Boolean);
  const or = [];
  ids.forEach((v) => or.push({ _id: v }));
  links.forEach((v) => {
    or.push({ userId: v });
    or.push({ user: v });
  });
  emails.forEach((v) => {
    or.push({ workEmail: v });
    or.push({ personalEmail: v });
  });
  if (!or.length) return null;
  return await Employee.findOne({ $or: or }).lean();
}

export async function POST(req, ctx) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

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
