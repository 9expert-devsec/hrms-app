// src/app/api/leave/[id]/approve/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import dbConnect from "@/lib/mongoose";
import Leave from "@/models/Leave";
import LeaveBalance from "@/models/LeaveBalance";

export async function POST(req, { params }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const role = session.user.role || "employee";
    const approverId = session.user.id || session.user._id || session.user.sub;

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });
    }

    const leave = await Leave.findById(id);
    if (!leave) return NextResponse.json({ ok: false, message: "ไม่พบรายการลา" }, { status: 404 });

    const body = await req.json();
    const { action, note, signature } = body;

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ ok: false, message: "action ต้องเป็น approve หรือ reject" }, { status: 400 });
    }

    // CASE A — HOD/Manager approval (Step 1): pending → hod_approved or rejected
    if (leave.status === "pending") {
      if (!["hod", "manager"].includes(role)) {
        return NextResponse.json({ ok: false, message: "ขั้นตอนนี้ต้องอนุมัติโดยหัวหน้าแผนก" }, { status: 403 });
      }

      if (action === "approve") {
        leave.status = "hod_approved";
        leave.hodApproverId = approverId;
        leave.hodApproverNote = note || "";
        leave.hodApprovedAt = new Date();
        leave.hodSignature = signature || undefined;
      } else {
        leave.status = "rejected";
        leave.hodApproverNote = note || "";
        leave.hodApproverId = approverId;
        leave.rejectedBy = "hod";
        leave.rejectedAt = new Date();
      }

    // CASE B — HR/Superadmin approval (Step 2): hod_approved → approved or rejected
    } else if (leave.status === "hod_approved") {
      if (!["hr", "superadmin"].includes(role)) {
        return NextResponse.json({ ok: false, message: "ขั้นตอนนี้ต้องอนุมัติโดย HR" }, { status: 403 });
      }

      if (action === "approve") {
        leave.status = "approved";
        leave.hrApproverId = approverId;
        leave.hrApproverNote = note || "";
        leave.hrApprovedAt = new Date();
        leave.hrSignature = signature || undefined;

        // หักวัน LeaveBalance เฉพาะประเภทที่มี quota
        const countableTypes = ["sick", "annual", "personal"];
        if (countableTypes.includes(leave.leaveType)) {
          const year = new Date(leave.startDate).getFullYear();
          let balance = await LeaveBalance.findOne({
            employeeId: leave.employeeId,
            year,
          });

          if (!balance) {
            balance = await LeaveBalance.create({
              employeeId: leave.employeeId,
              year,
            });
          }

          const remaining = balance[leave.leaveType].total - balance[leave.leaveType].used;
          if (leave.totalDays > remaining) {
            return NextResponse.json(
              { ok: false, message: `วันลาคงเหลือไม่เพียงพอ (เหลือ ${remaining} วัน)` },
              { status: 400 }
            );
          }

          balance[leave.leaveType].used += leave.totalDays;
          await balance.save();
        }
      } else {
        leave.status = "rejected";
        leave.hrApproverNote = note || "";
        leave.hrApproverId = approverId;
        leave.rejectedBy = "hr";
        leave.rejectedAt = new Date();
      }

    } else {
      return NextResponse.json(
        { ok: false, message: `ไม่สามารถดำเนินการได้ สถานะปัจจุบัน: ${leave.status}` },
        { status: 400 }
      );
    }

    await leave.save();
    return NextResponse.json({ ok: true, leave });
  } catch (err) {
    console.error("POST /api/leave/[id]/approve error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
