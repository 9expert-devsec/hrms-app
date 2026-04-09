import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireSessionAPI, requireRoleAPI } from "@/lib/authz";
import EmployeeShift from "@/lib/models/EmployeeShift";
import WorkShift from "@/lib/models/WorkShift";
import Employee from "@/models/Employee";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const { session, res } = await requireSessionAPI();
    if (res) return res;

    const url = new URL(req.url);
    const employeeId = url.searchParams.get("employeeId");
    const role = session.user?.role;

    let targetId = employeeId;

    // Employee role: own only
    if (!["superadmin", "hr", "manager"].includes(role) || !targetId) {
      const emp = await Employee.findOne({ email: session.user.email }).select("_id").lean();
      if (!emp) return NextResponse.json({ ok: true, data: [] });
      targetId = String(emp._id);
    }

    const data = await EmployeeShift.find({ employeeId: targetId, endDate: null })
      .populate("shiftId")
      .sort({ effectiveDate: -1 })
      .lean();

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("GET /api/attendance/employee-shift error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const { session, res } = await requireRoleAPI(["superadmin", "hr"]);
    if (res) return res;

    const { employeeId, shiftId, effectiveDate } = await req.json();

    if (!employeeId || !shiftId || !effectiveDate) {
      return NextResponse.json({ ok: false, message: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    const emp = await Employee.findById(employeeId).select("_id").lean();
    if (!emp) return NextResponse.json({ ok: false, message: "ไม่พบพนักงาน" }, { status: 404 });

    const shift = await WorkShift.findById(shiftId).lean();
    if (!shift || !shift.isActive) {
      return NextResponse.json({ ok: false, message: "ไม่พบเวลาทำงานที่เลือก" }, { status: 404 });
    }

    // Close previous assignments
    await EmployeeShift.updateMany(
      { employeeId, endDate: null },
      { endDate: new Date(effectiveDate) },
    );

    const assignment = await EmployeeShift.create({
      employeeId,
      shiftId,
      effectiveDate: new Date(effectiveDate),
      assignedBy: session.user.id,
    });

    return NextResponse.json({ ok: true, data: assignment }, { status: 201 });
  } catch (err) {
    console.error("POST /api/attendance/employee-shift error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}
