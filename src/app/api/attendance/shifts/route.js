import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireSessionAPI, requireRoleAPI } from "@/lib/authz";
import WorkShift from "@/lib/models/WorkShift";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const { session, res } = await requireSessionAPI();
    if (res) return res;

    const url = new URL(req.url);
    const showAll = url.searchParams.get("all") === "true";
    const role = session.user?.role;

    const filter =
      showAll && ["superadmin", "hr"].includes(role)
        ? {}
        : { isActive: true };

    const data = await WorkShift.find(filter).sort({ name: 1 }).lean();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("GET /api/attendance/shifts error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const { session, res } = await requireRoleAPI(["superadmin", "hr"]);
    if (res) return res;

    const body = await req.json();
    const { name, startTime, endTime, lateThresholdMinutes, breakMinutes, isDefault } = body;

    if (!name || !startTime || !endTime) {
      return NextResponse.json({ ok: false, message: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    // If setting as default, unset existing defaults
    if (isDefault) {
      await WorkShift.updateMany({ isDefault: true }, { isDefault: false });
    }

    const shift = await WorkShift.create({
      name: name.trim(),
      startTime,
      endTime,
      lateThresholdMinutes: Number(lateThresholdMinutes) || 15,
      breakMinutes: Number(breakMinutes) || 60,
      isDefault: !!isDefault,
      createdBy: session.user.id,
    });

    return NextResponse.json({ ok: true, data: shift }, { status: 201 });
  } catch (err) {
    console.error("POST /api/attendance/shifts error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}
