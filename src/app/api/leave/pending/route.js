// src/app/api/leave/pending/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Leave from "@/models/Leave";
import { requirePageApi } from "@/lib/rbac/guard";
import { hodStepScope, canActOnHrStep } from "@/lib/rbac/leaveScope";

const POPULATE_FIELDS = "firstName lastName department position empId photoUrl";

/**
 * Leaves waiting at one approval step.
 *   ?step=hod → status "pending", scoped by hodStepScope (headed departments,
 *               or every department with scope_leave_all_depts)
 *   ?step=hr  → status "hod_approved"; requires scope_leave_hr_step
 * Opening the page at all: canOpenLeaveApproval (role key OR department head).
 */
export async function GET(req) {
  try {
    // leave_approve resolves through canOpenPage → canOpenLeaveApproval.
    const gate = await requirePageApi("leave_approve");
    if (gate.res) return gate.res;
    const user = gate.session.user;

    await dbConnect();
    const step = new URL(req.url).searchParams.get("step");

    if (step === "hr") {
      if (!canActOnHrStep(user)) {
        return NextResponse.json({ ok: false, message: "ไม่มีสิทธิ์อนุมัติขั้น HR" }, { status: 403 });
      }
      const items = await Leave.find({ status: "hod_approved" })
        .populate("employeeId", POPULATE_FIELDS)
        .sort({ createdAt: -1 })
        .lean();
      return NextResponse.json({ ok: true, items });
    }

    if (step === "hod") {
      const scope = await hodStepScope(user);
      const filter = scope.all
        ? { status: "pending" }
        : { status: "pending", employeeId: { $in: scope.employeeIds } };
      const items = await Leave.find(filter)
        .populate("employeeId", POPULATE_FIELDS)
        .sort({ createdAt: -1 })
        .lean();
      return NextResponse.json({ ok: true, items });
    }

    return NextResponse.json({ ok: false, message: "step ต้องเป็น hod หรือ hr" }, { status: 400 });
  } catch (err) {
    console.error("GET /api/leave/pending error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
