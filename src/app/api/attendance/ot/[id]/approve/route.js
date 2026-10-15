import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import { otScope } from "@/lib/rbac/scopes";
import { isEmployeeInScope } from "@/lib/rbac/scopeQueries";
import OTRequest from "@/lib/models/OTRequest";
import AttendanceRecord from "@/lib/models/AttendanceRecord";

export async function POST(req, { params }) {
  try {
    const gate = await requirePageApi("ot_approve");
    if (gate.res) return gate.res;
    const { session } = gate;

    await dbConnect();

    const { id } = await params;
    const body = await req.json();
    const { action, note } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ ok: false, message: "action ต้องเป็น 'approve' หรือ 'reject'" }, { status: 400 });
    }

    const ot = await OTRequest.findById(id);
    if (!ot) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

    // Departments the approver heads, or everyone with scope_ot_all.
    if (!(await isEmployeeInScope(otScope(session.user), ot.employeeId))) {
      return NextResponse.json({ ok: false, message: "ไม่มีสิทธิ์อนุมัติ OT ของพนักงานคนนี้" }, { status: 403 });
    }

    if (ot.status !== "pending") {
      return NextResponse.json({ ok: false, message: "คำขอนี้ดำเนินการไปแล้ว" }, { status: 400 });
    }

    const approverId = session.user.id || session.user._id || session.user.sub;

    if (action === "approve") {
      ot.status = "approved";
      ot.approverId = approverId;
      ot.approverNote = note || "";
      ot.approvedAt = new Date();
      await ot.save();

      // Update AttendanceRecord with OT hours
      const otDate = new Date(ot.date);
      otDate.setUTCHours(0, 0, 0, 0);
      await AttendanceRecord.findOneAndUpdate(
        { employeeId: ot.employeeId, date: otDate },
        { $inc: { otHours: ot.hours } },
      );
    } else {
      ot.status = "rejected";
      ot.approverId = approverId;
      ot.approverNote = note || "";
      ot.approvedAt = new Date();
      await ot.save();
    }

    return NextResponse.json({ ok: true, data: ot });
  } catch (err) {
    console.error("POST /api/attendance/ot/[id]/approve error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}
