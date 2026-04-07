// src/app/api/leave/[id]/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import dbConnect from "@/lib/mongoose";
import Leave from "@/models/Leave";

/* ---------- GET ---------- */
export async function GET(_req, { params }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });
    }

    const leave = await Leave.findById(id)
      .populate("employeeId", "firstName lastName department position empId photoUrl")
      .populate("hodApproverId", "email role")
      .populate("hrApproverId", "email role")
      .lean();

    if (!leave) return NextResponse.json({ ok: false, message: "ไม่พบรายการลา" }, { status: 404 });

    return NextResponse.json({ ok: true, leave });
  } catch (err) {
    console.error("GET /api/leave/[id] error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

/* ---------- PATCH ---------- */
export async function PATCH(req, { params }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });
    }

    const leave = await Leave.findById(id);
    if (!leave) return NextResponse.json({ ok: false, message: "ไม่พบรายการลา" }, { status: 404 });

    // เฉพาะเจ้าของ + status pending เท่านั้น
    if (String(leave.userId) !== String(session.user.id)) {
      return NextResponse.json({ ok: false, message: "ไม่มีสิทธิ์แก้ไข" }, { status: 403 });
    }
    if (leave.status !== "pending") {
      return NextResponse.json({ ok: false, message: "แก้ไขได้เฉพาะรายการที่ยังรออนุมัติ" }, { status: 400 });
    }

    const body = await req.json();
    const allowed = ["leaveType", "startDate", "endDate", "reason", "attachmentUrl"];
    for (const key of allowed) {
      if (body[key] !== undefined) leave[key] = body[key];
    }

    // คำนวณ totalDays ใหม่ถ้ามีการเปลี่ยนวันที่
    if (body.startDate || body.endDate) {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      let count = 0;
      const cur = new Date(start);
      while (cur <= end) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) count++;
        cur.setDate(cur.getDate() + 1);
      }
      leave.totalDays = count;
    }

    await leave.save();
    return NextResponse.json({ ok: true, leave });
  } catch (err) {
    console.error("PATCH /api/leave/[id] error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

/* ---------- DELETE ---------- */
export async function DELETE(_req, { params }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });
    }

    const leave = await Leave.findById(id);
    if (!leave) return NextResponse.json({ ok: false, message: "ไม่พบรายการลา" }, { status: 404 });

    // เฉพาะเจ้าของ + status pending เท่านั้น
    if (String(leave.userId) !== String(session.user.id)) {
      return NextResponse.json({ ok: false, message: "ไม่มีสิทธิ์ยกเลิก" }, { status: 403 });
    }
    if (leave.status !== "pending") {
      return NextResponse.json({ ok: false, message: "ยกเลิกได้เฉพาะรายการที่ยังรออนุมัติ" }, { status: 400 });
    }

    leave.status = "cancelled";
    await leave.save();

    return NextResponse.json({ ok: true, leave });
  } catch (err) {
    console.error("DELETE /api/leave/[id] error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
