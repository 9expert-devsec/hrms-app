import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireSessionAPI, requireRoleAPI } from "@/lib/authz";
import WorkShift from "@/lib/models/WorkShift";

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const { res } = await requireSessionAPI();
    if (res) return res;

    const { id } = await params;
    const shift = await WorkShift.findById(id).lean();
    if (!shift) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, data: shift });
  } catch (err) {
    console.error("GET /api/attendance/shifts/[id] error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await dbConnect();
    const { session, res } = await requireRoleAPI(["superadmin", "hr"]);
    if (res) return res;

    const { id } = await params;
    const body = await req.json();

    const allowed = ["name", "startTime", "endTime", "lateThresholdMinutes", "breakMinutes", "isDefault", "isActive"];
    const update = {};
    for (const k of allowed) {
      if (body[k] !== undefined) update[k] = body[k];
    }

    if (update.isDefault) {
      await WorkShift.updateMany({ isDefault: true, _id: { $ne: id } }, { isDefault: false });
    }

    const updated = await WorkShift.findByIdAndUpdate(id, update, { new: true });
    if (!updated) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("PATCH /api/attendance/shifts/[id] error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const { res } = await requireRoleAPI(["superadmin", "hr"]);
    if (res) return res;

    const { id } = await params;
    const updated = await WorkShift.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!updated) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("DELETE /api/attendance/shifts/[id] error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}
