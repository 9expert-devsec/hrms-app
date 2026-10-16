// src/app/api/leave/[id]/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import { canSeeLeaveDocument } from "@/lib/rbac/leaveScope";
import dbConnect from "@/lib/mongoose";
import Leave from "@/models/Leave";
import { deletedAccount } from "@/lib/deletedAccount";

/* ---------- GET ---------- */
export async function GET(_req, { params }) {
  try {
    const gate = await requireAnyPageApi(["self_leave_document", "self_leave_history", "leave_approve"]);
    if (gate.res) return gate.res;
    const { session } = gate;

    await dbConnect();

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });
    }

    const leave = await Leave.findById(id)
      .populate("employeeId", "firstName lastName department departmentId position empId photoUrl")
      .populate("hodApproverId", "email role")
      .populate("hrApproverId", "email role")
      .lean();

    // Owner, a head of the owner's department, the leave scopes, superadmin.
    // Anyone else gets the same 404 as a missing id.
    const visible =
      leave && (await canSeeLeaveDocument(session, { ownerUserId: leave.userId, employee: leave.employeeId }));
    if (!visible) return NextResponse.json({ ok: false, message: "ไม่พบรายการลา" }, { status: 404 });

    // An approver whose account was deleted (lib/accountLinks.js) populates
    // to null; keep the id and say so instead of dropping it. The stored
    // record is not changed.
    const raw = await Leave.findById(id).select("hodApproverId hrApproverId").lean();
    for (const field of ["hodApproverId", "hrApproverId"]) {
      if (!leave[field] && raw?.[field]) leave[field] = deletedAccount(raw[field]);
    }

    return NextResponse.json({ ok: true, leave });
  } catch (err) {
    console.error("GET /api/leave/[id] error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

/* ---------- PATCH ---------- */
export async function PATCH(req, { params }) {
  try {
    const gate = await requireAnyPageApi(["self_leave_request", "self_leave_history"]);
    if (gate.res) return gate.res;
    const { session } = gate;

    await dbConnect();

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
    const gate = await requireAnyPageApi(["self_leave_request", "self_leave_history"]);
    if (gate.res) return gate.res;
    const { session } = gate;

    await dbConnect();

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
