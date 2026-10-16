// src/app/api/leave/calendar/route.js
import { NextResponse } from "next/server";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import Leave from "@/models/Leave";

export async function GET(req) {
  try {
    const gate = await requirePageApi("leave_calendar");
    if (gate.res) return gate.res;
    const { session } = gate;

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const month = Number(searchParams.get("month"));
    const year = Number(searchParams.get("year"));

    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json({ ok: false, message: "ต้องระบุ month (1-12) และ year" }, { status: 400 });
    }

    // First and last day of the given month
    const monthStart = new Date(`${year}-${String(month).padStart(2, "0")}-01`);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999); // last day of month

    // Leaves that overlap the month: startDate <= monthEnd AND endDate >= monthStart
    const items = await Leave.find({
      status: { $in: ["approved", "hod_approved"] },
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
    })
      .populate("employeeId", "firstName lastName firstNameTh lastNameTh department photoUrl")
      .sort({ startDate: 1 })
      .lean();

    const result = items.map((item) => ({
      employeeId: item.employeeId?._id,
      employeeName: item.employeeId ? employeeDisplayName(item.employeeId) : "Unknown",
      department: item.employeeId?.department,
      leaveType: item.leaveType,
      startDate: item.startDate,
      endDate: item.endDate,
      totalDays: item.totalDays,
      status: item.status,
    }));

    return NextResponse.json({ ok: true, items: result });
  } catch (err) {
    console.error("GET /api/leave/calendar error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
