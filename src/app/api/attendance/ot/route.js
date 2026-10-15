import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAnyPageApi, requirePageApi } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import { otScope } from "@/lib/rbac/scopes";
import { employeeIdsForScope, getOwnEmployee } from "@/lib/rbac/scopeQueries";
import OTRequest from "@/lib/models/OTRequest";

export const dynamic = "force-dynamic";

/**
 * Two views:
 *   - own requests (self_ot): ?scope=mine, or any caller without ot_approve
 *   - approver view (ot_approve): departments the caller heads, or everyone
 *     with scope_ot_all; plain ot_approve with neither sees nothing.
 */
export async function GET(req) {
  try {
    const gate = await requireAnyPageApi(["self_ot", "ot_approve"]);
    if (gate.res) return gate.res;
    const { session } = gate;
    const user = session.user;

    await dbConnect();
    const url = new URL(req.url);
    const statusQ = url.searchParams.get("status");
    const employeeIdQ = url.searchParams.get("employeeId");
    const mine = url.searchParams.get("scope") === "mine" || !canAccess(user, "ot_approve");

    const filter = {};
    if (statusQ) filter.status = statusQ;

    if (mine) {
      if (!canAccess(user, "self_ot")) {
        return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
      }
      const emp = await getOwnEmployee(session, "_id");
      if (!emp) return NextResponse.json({ ok: true, data: [] });
      filter.employeeId = emp._id;
    } else {
      const allowedIds = await employeeIdsForScope(otScope(user)); // null = everyone
      if (employeeIdQ) {
        if (allowedIds && !allowedIds.includes(String(employeeIdQ))) {
          return NextResponse.json({ ok: true, data: [] });
        }
        filter.employeeId = employeeIdQ;
      } else if (allowedIds) {
        filter.employeeId = { $in: allowedIds };
      }
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
    const gate = await requirePageApi("self_ot");
    if (gate.res) return gate.res;
    const { session } = gate;

    await dbConnect();

    const body = await req.json();
    const { date, hours: rawHours, reason } = body;

    // The caller's own employee record (never one named in the request).
    const employee = await getOwnEmployee(session, "_id");
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
