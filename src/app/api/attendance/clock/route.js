import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongoose";
import { requireSessionAPI } from "@/lib/authz";
import AttendanceRecord from "@/lib/models/AttendanceRecord";
import EmployeeShift from "@/lib/models/EmployeeShift";
import WorkShift from "@/lib/models/WorkShift";
import Employee from "@/models/Employee";

export async function POST(req) {
  try {
    await dbConnect();
    const { session, res } = await requireSessionAPI();
    if (res) return res;

    const body = await req.json();
    const { action, note, location } = body;

    if (!action || !["in", "out"].includes(action)) {
      return NextResponse.json({ ok: false, message: "action ต้องเป็น 'in' หรือ 'out'" }, { status: 400 });
    }

    // Find employee by email or userId
    const email = session.user.email;
    const userId = session.user.id;
    const orQuery = [];
    if (email) orQuery.push({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } });
    if (userId) {
      orQuery.push({ userId });
      if (mongoose.isValidObjectId(userId)) orQuery.push({ userId: new mongoose.Types.ObjectId(userId) });
    }

    if (!orQuery.length) {
      return NextResponse.json({ ok: false, message: "ไม่สามารถระบุตัวตนพนักงานได้" }, { status: 400 });
    }

    const employee = await Employee.findOne({ $or: orQuery }).lean();
    if (!employee) {
      return NextResponse.json({ ok: false, message: "ไม่พบข้อมูลพนักงาน กรุณาติดต่อ HR" }, { status: 404 });
    }

    // Normalize today to midnight (Bangkok UTC+7)
    const now = new Date();
    const bangkokMs = now.getTime() + (7 * 60 * 60 * 1000);
    const bangkokDate = new Date(bangkokMs);
    const todayStr = bangkokDate.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const today = new Date(todayStr + "T00:00:00.000Z");

    // Find existing record for today
    const existing = await AttendanceRecord.findOne({
      employeeId: employee._id,
      date: today,
    });

    // Get employee's current shift (with fallback)
    const empShift = await EmployeeShift.findOne({
      employeeId: employee._id,
      $or: [{ endDate: null }, { endDate: { $exists: false } }],
    })
      .populate("shiftId")
      .sort({ effectiveDate: -1 })
      .lean();

    const shift = empShift?.shiftId;
    // Fallback to default shift or hardcoded defaults
    let shiftStart = shift?.startTime || "09:00";
    let shiftEnd = shift?.endTime || "18:00";
    let shiftId = shift?._id || null;
    let lateThreshold = shift?.lateThresholdMinutes ?? 15;
    let breakMinutes = shift?.breakMinutes ?? 60;

    // If no assigned shift, try default
    if (!shift) {
      const defaultShift = await WorkShift.findOne({ isDefault: true, isActive: true }).lean();
      if (defaultShift) {
        shiftStart = defaultShift.startTime;
        shiftEnd = defaultShift.endTime;
        shiftId = defaultShift._id;
        lateThreshold = defaultShift.lateThresholdMinutes ?? 15;
        breakMinutes = defaultShift.breakMinutes ?? 60;
      }
    }

    // ── CLOCK IN ──
    if (action === "in") {
      if (existing && existing.clockIn) {
        return NextResponse.json({ ok: false, message: "คุณ Clock In ไปแล้วในวันนี้" }, { status: 400 });
      }

      // Calculate late minutes
      const [hh, mm] = shiftStart.split(":").map(Number);
      const shiftStartTime = new Date(today);
      shiftStartTime.setUTCHours(hh - 7, mm, 0, 0); // Convert Bangkok time to UTC
      let lateMinutes = Math.floor((now - shiftStartTime) / 60000) - lateThreshold;
      if (lateMinutes < 0) lateMinutes = 0;

      const status = lateMinutes > 0 ? "late" : "present";

      const record = await AttendanceRecord.findOneAndUpdate(
        { employeeId: employee._id, date: today },
        {
          clockIn: now,
          shiftId,
          shiftStart,
          shiftEnd,
          lateMinutes,
          status,
          source: "manual",
          ...(note ? { note } : {}),
          ...(location ? { location } : {}),
        },
        { upsert: true, new: true },
      );

      return NextResponse.json({ ok: true, data: record, action: "clock_in" });
    }

    // ── CLOCK OUT ──
    if (action === "out") {
      if (!existing || !existing.clockIn) {
        return NextResponse.json({ ok: false, message: "คุณยังไม่ได้ Clock In วันนี้" }, { status: 400 });
      }
      if (existing.clockOut) {
        return NextResponse.json({ ok: false, message: "คุณ Clock Out ไปแล้วในวันนี้" }, { status: 400 });
      }

      let workHours = (now - new Date(existing.clockIn)) / 3600000;
      if (workHours > 5) workHours -= breakMinutes / 60;
      workHours = Math.round(Math.max(0, workHours) * 100) / 100;

      existing.clockOut = now;
      existing.workHours = workHours;
      if (note) existing.note = note;
      if (location) existing.location = location;
      await existing.save();

      return NextResponse.json({ ok: true, data: existing, action: "clock_out" });
    }
  } catch (err) {
    console.error("POST /api/attendance/clock error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
