// src/app/api/leave/route.js
import { NextResponse } from "next/server";
import { requireAnyPageApi, requirePageApi } from "@/lib/rbac/guard";
import { canOpenLeaveApproval, canAccess } from "@/lib/rbac/access";
import { leaveListEmployeeIds } from "@/lib/rbac/leaveScope";
import dbConnect from "@/lib/mongoose";
import Leave from "@/models/Leave";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";
import { submitLeave, leaveErrorResponse } from "@/lib/leave/requests";

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
      .populate("employeeId", "firstName lastName firstNameTh lastNameTh department position empId photoUrl photoCrop")
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

    // QF-HRD-001 request (lib/leave/requests.js): the server recomputes the
    // count, checks type, quota (A3), approvers (A4) and signature, and
    // stores the snapshots. Status: pending_approval, or pending_hr for an
    // auto-approve employee. No email yet (round 41).
    const body = await req.json().catch(() => ({}));
    const leave = await submitLeave(session, body);
    return NextResponse.json({ ok: true, leave: { _id: String(leave._id), status: leave.status } }, { status: 201 });
  } catch (err) {
    const { body, status } = leaveErrorResponse(err, "POST /api/leave");
    return NextResponse.json(body, { status });
  }
}
