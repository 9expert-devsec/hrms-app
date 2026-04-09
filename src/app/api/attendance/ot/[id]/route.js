import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireSessionAPI } from "@/lib/authz";
import OTRequest from "@/lib/models/OTRequest";
import Employee from "@/models/Employee";

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const { session, res } = await requireSessionAPI();
    if (res) return res;

    const { id } = await params;
    const ot = await OTRequest.findById(id)
      .populate("employeeId", "firstName lastName empAutoId department")
      .lean();

    if (!ot) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

    // Employee role: own only
    const role = session.user?.role;
    if (!["superadmin", "hr", "manager", "hod"].includes(role)) {
      const emp = await Employee.findOne({ email: session.user.email }).select("_id").lean();
      if (!emp || String(ot.employeeId?._id || ot.employeeId) !== String(emp._id)) {
        return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ ok: true, data: ot });
  } catch (err) {
    console.error("GET /api/attendance/ot/[id] error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await dbConnect();
    const { session, res } = await requireSessionAPI();
    if (res) return res;

    const { id } = await params;
    const ot = await OTRequest.findById(id);
    if (!ot) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

    // Must be own request
    const emp = await Employee.findOne({ email: session.user.email }).select("_id").lean();
    if (!emp || String(ot.employeeId) !== String(emp._id)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    // Must be pending
    if (ot.status !== "pending") {
      return NextResponse.json({ ok: false, message: "ไม่สามารถแก้ไขคำขอที่ดำเนินการแล้ว" }, { status: 400 });
    }

    const body = await req.json();
    if (body.date) ot.date = new Date(body.date);
    if (body.hours) ot.hours = parseFloat(body.hours);
    if (body.reason) ot.reason = body.reason.trim();
    await ot.save();

    return NextResponse.json({ ok: true, data: ot });
  } catch (err) {
    console.error("PATCH /api/attendance/ot/[id] error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const { session, res } = await requireSessionAPI();
    if (res) return res;

    const { id } = await params;
    const ot = await OTRequest.findById(id);
    if (!ot) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

    // Must be own request
    const emp = await Employee.findOne({ email: session.user.email }).select("_id").lean();
    if (!emp || String(ot.employeeId) !== String(emp._id)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    // Must be pending
    if (ot.status !== "pending") {
      return NextResponse.json({ ok: false, message: "ไม่สามารถยกเลิกคำขอที่ดำเนินการแล้ว" }, { status: 400 });
    }

    await OTRequest.findByIdAndDelete(id);
    return NextResponse.json({ ok: true, message: "ยกเลิกคำขอ OT เรียบร้อย" });
  } catch (err) {
    console.error("DELETE /api/attendance/ot/[id] error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}
