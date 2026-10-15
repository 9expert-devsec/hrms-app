// src/app/api/leave/balance/route.js
import { NextResponse } from "next/server";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import LeaveBalance from "@/models/LeaveBalance";

export async function GET(req) {
  try {
    const gate = await requireAnyPageApi(["self_leave_balance", "self_leave_request"]);
    if (gate.res) return gate.res;
    const { session } = gate;

    await dbConnect();
    // Without a linked employee the default record below would be created
    // with employeeId null.
    if (!session.user.employeeId) {
      return NextResponse.json({ ok: false, message: "ไม่พบข้อมูลพนักงาน" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year")) || new Date().getFullYear();

    let balance = await LeaveBalance.findOne({
      employeeId: session.user.employeeId,
      year,
    }).lean();

    // ถ้ายังไม่มี record → สร้าง default
    if (!balance) {
      balance = await LeaveBalance.create({
        employeeId: session.user.employeeId,
        year,
      });
      balance = balance.toObject();
    }

    return NextResponse.json({
      ok: true,
      balance: {
        year: balance.year,
        sick: {
          total: balance.sick.total,
          used: balance.sick.used,
          remaining: balance.sick.total - balance.sick.used,
        },
        annual: {
          total: balance.annual.total,
          used: balance.annual.used,
          remaining: balance.annual.total - balance.annual.used,
        },
        personal: {
          total: balance.personal.total,
          used: balance.personal.used,
          remaining: balance.personal.total - balance.personal.used,
        },
      },
    });
  } catch (err) {
    console.error("GET /api/leave/balance error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
