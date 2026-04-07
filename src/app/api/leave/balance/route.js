// src/app/api/leave/balance/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import dbConnect from "@/lib/mongoose";
import LeaveBalance from "@/models/LeaveBalance";

export async function GET(req) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

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
