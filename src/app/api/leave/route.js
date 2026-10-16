// src/app/api/leave/route.js
import { NextResponse } from "next/server";
import { requireAnyPageApi, requirePageApi } from "@/lib/rbac/guard";
import { canOpenLeaveApproval, canAccess } from "@/lib/rbac/access";
import { leaveListEmployeeIds } from "@/lib/rbac/leaveScope";
import dbConnect from "@/lib/mongoose";
import Leave from "@/models/Leave";
import LeaveBalance from "@/models/LeaveBalance";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";

/* ---------- helpers ---------- */

// นับวันทำงาน (จันทร์–ศุกร์) ระหว่าง start ถึง end (รวมทั้งสองวัน)
function countWorkingDays(start, end) {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay(); // 0=Sun, 6=Sat
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/* ---------- GET ---------- */
export async function GET(req) {
  try {
    // Own leaves for the self-service pages; ?scope=all for approvers and
    // the all-documents scope (see below).
    const gate = await requireAnyPageApi([
      "self_leave_history",
      "self_leave_document",
      "self_leave_balance",
      "self_leave_request",
      "leave_approve",
    ]);
    if (gate.res) return gate.res;
    const { session } = gate;

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const year = searchParams.get("year");

    const scope = searchParams.get("scope");
    const filter = {};

    // scope=all: approvers (leave_approve or department heads) and holders
    // of scope_leave_documents_all, narrowed like the pending list — HR step
    // and all-documents see everyone, otherwise the HOD-step departments.
    // Anyone else, or no scope=all: the caller's own leaves.
    const user = session.user;
    const mayListOthers = canOpenLeaveApproval(user) || canAccess(user, "scope_leave_documents_all");
    if (scope === "all" && mayListOthers) {
      const ids = await leaveListEmployeeIds(user); // null = everyone
      if (ids) filter.employeeId = { $in: ids };
    } else {
      // Own leaves = the linked employee's, so history survives an account
      // being replaced; an unlinked account has none.
      const own = await getOwnEmployee(session, "_id");
      if (!own) return NextResponse.json({ ok: true, items: [] });
      filter.employeeId = own._id;
    }

    if (status && status !== "all") filter.status = status;

    if (year) {
      const y = Number(year);
      filter.startDate = {
        $gte: new Date(`${y}-01-01`),
        $lte: new Date(`${y}-12-31T23:59:59.999Z`),
      };
    }

    const items = await Leave.find(filter)
      .populate("employeeId", "firstName lastName department position empId photoUrl")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/leave error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

/* ---------- POST ---------- */
export async function POST(req) {
  try {
    const gate = await requirePageApi("self_leave_request");
    if (gate.res) return gate.res;
    const { session } = gate;

    await dbConnect();

    // TODO: remove this debug log once userId issue is confirmed fixed
    console.log("POST /api/leave session.user:", JSON.stringify(session.user));

    const userId = session.user.id || session.user._id || session.user.sub;
    if (!userId) {
      return NextResponse.json({ ok: false, message: "Session missing userId" }, { status: 401 });
    }

    // The linked employee only (lib/accountLinks.js) — never an email match.
    const employee = await getOwnEmployee(session, "_id");
    if (!employee) {
      return NextResponse.json({ ok: false, message: "บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน" }, { status: 400 });
    }
    const employeeId = employee._id;

    const body = await req.json();
    const { leaveType, startDate, endDate, reason, attachmentUrl, attachments, employeeSignature } = body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return NextResponse.json({ ok: false, message: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return NextResponse.json({ ok: false, message: "วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม" }, { status: 400 });
    }

    const totalDays = countWorkingDays(start, end);
    if (totalDays <= 0) {
      return NextResponse.json({ ok: false, message: "ไม่มีวันทำงานในช่วงที่เลือก" }, { status: 400 });
    }

    // ตรวจ LeaveBalance เฉพาะประเภทที่มี quota (sick, annual, personal)
    const countableTypes = ["sick", "annual", "personal"];
    if (countableTypes.includes(leaveType)) {
      const currentYear = start.getFullYear();
      let balance = await LeaveBalance.findOne({
        employeeId,
        year: currentYear,
      });

      // ถ้ายังไม่มี record → สร้าง default
      if (!balance) {
        balance = await LeaveBalance.create({
          employeeId,
          year: currentYear,
        });
      }

      const remaining = balance[leaveType].total - balance[leaveType].used;
      if (totalDays > remaining) {
        return NextResponse.json(
          { ok: false, message: `วันลา${leaveType}คงเหลือไม่เพียงพอ (เหลือ ${remaining} วัน)` },
          { status: 400 }
        );
      }
    }

    const leave = await Leave.create({
      employeeId,
      userId,
      leaveType,
      startDate: start,
      endDate: end,
      totalDays,
      reason,
      attachments: Array.isArray(attachments) && attachments.length > 0
        ? attachments
        : attachmentUrl
          ? [{ url: attachmentUrl, name: "attachment", type: "document", size: 0 }]
          : [],
      attachmentUrl: attachmentUrl || undefined,
      employeeSignature: employeeSignature || undefined,
      status: "pending",
    });

    return NextResponse.json({ ok: true, leave }, { status: 201 });
  } catch (err) {
    console.error("POST /api/leave error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
