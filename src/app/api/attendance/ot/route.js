import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongoose";
import { requireSessionAPI } from "@/lib/authz";
import OTRequest from "@/lib/models/OTRequest";
import Employee from "@/models/Employee";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const { session, res } = await requireSessionAPI();
    if (res) return res;

    const role = session.user?.role;
    const url = new URL(req.url);
    const statusQ = url.searchParams.get("status");
    const employeeIdQ = url.searchParams.get("employeeId");

    const filter = {};
    if (statusQ) filter.status = statusQ;

    // Employee role: own records only
    if (!["superadmin", "hr", "manager", "hod"].includes(role)) {
      const emp = await Employee.findOne({ email: session.user.email }).select("_id").lean();
      if (!emp) return NextResponse.json({ ok: true, data: [] });
      filter.employeeId = emp._id;
    } else if (employeeIdQ) {
      filter.employeeId = employeeIdQ;
    }

    const data = await OTRequest.find(filter)
      .populate("employeeId", "firstName lastName empAutoId department position photoUrl")
      .sort({ date: -1 })
      .lean();

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("GET /api/attendance/ot error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const { session, res } = await requireSessionAPI();
    if (res) return res;

    const body = await req.json();
    const { date, hours: rawHours, reason } = body;

    // Find employee
    const email = session.user.email;
    const userId = session.user.id;
    const orQuery = [];
    if (email) orQuery.push({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } });
    if (userId) {
      orQuery.push({ userId });
      if (mongoose.isValidObjectId(userId)) orQuery.push({ userId: new mongoose.Types.ObjectId(userId) });
    }

    const employee = await Employee.findOne(orQuery.length ? { $or: orQuery } : {}).lean();
    if (!employee) {
      return NextResponse.json({ ok: false, message: "ไม่พบข้อมูลพนักงาน กรุณาติดต่อ HR" }, { status: 404 });
    }

    // Validate hours
    const hours = parseFloat(rawHours);
    if (!hours || hours < 0.5 || hours > 12) {
      return NextResponse.json({ ok: false, message: "จำนวนชั่วโมงไม่ถูกต้อง (0.5 - 12)" }, { status: 400 });
    }
    if ((hours * 2) % 1 !== 0) {
      return NextResponse.json({ ok: false, message: "จำนวนชั่วโมงต้องเป็นทวีคูณของ 0.5" }, { status: 400 });
    }

    // Validate date
    const d = new Date(date);
    if (!date || isNaN(d)) {
      return NextResponse.json({ ok: false, message: "วันที่ไม่ถูกต้อง" }, { status: 400 });
    }

    // Validate reason
    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ ok: false, message: "กรุณากรอกเหตุผลอย่างน้อย 5 ตัวอักษร" }, { status: 400 });
    }

    // Normalize date to midnight
    const dateStart = new Date(d);
    dateStart.setUTCHours(0, 0, 0, 0);

    // Check duplicate
    const dateEnd = new Date(dateStart);
    dateEnd.setUTCHours(23, 59, 59, 999);
    const existing = await OTRequest.findOne({
      employeeId: employee._id,
      date: { $gte: dateStart, $lte: dateEnd },
      status: { $ne: "rejected" },
    });
    if (existing) {
      return NextResponse.json({ ok: false, message: "คุณมีคำขอ OT วันนี้แล้ว" }, { status: 400 });
    }

    // Get userId for the OTRequest
    const sessionUserId = session.user.id || session.user._id || session.user.sub;
    if (!sessionUserId) {
      return NextResponse.json({ ok: false, message: "Session missing userId" }, { status: 401 });
    }

    const ot = await OTRequest.create({
      employeeId: employee._id,
      userId: sessionUserId,
      date: dateStart,
      hours,
      reason: reason.trim(),
      status: "pending",
    });

    return NextResponse.json({ ok: true, data: ot }, { status: 201 });
  } catch (err) {
    console.error("POST /api/attendance/ot error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
