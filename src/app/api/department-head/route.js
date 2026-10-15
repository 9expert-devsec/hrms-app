// src/app/api/department-head/route.js
import { NextResponse } from "next/server";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import DepartmentHead from "@/models/DepartmentHead";

export async function GET() {
  try {
    await dbConnect();
    const gate = await requirePageApi("hod_settings");
    if (gate.res) return gate.res;
    const { session } = gate;

    const items = await DepartmentHead.find()
      .populate("userId", "email role")
      .populate("assignedBy", "email")
      .sort({ departmentCode: 1 })
      .lean();

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/department-head error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const gate = await requirePageApi("hod_settings");
    if (gate.res) return gate.res;
    const { session } = gate;


    const { departmentCode, userId } = await req.json();
    if (!departmentCode || !userId) {
      return NextResponse.json({ ok: false, message: "ต้องระบุ departmentCode และ userId" }, { status: 400 });
    }

    const assignedBy = session.user.id || session.user._id || session.user.sub;

    const item = await DepartmentHead.findOneAndUpdate(
      { departmentCode },
      { userId, assignedBy },
      { upsert: true, new: true, runValidators: true }
    );

    return NextResponse.json({ ok: true, item });
  } catch (err) {
    console.error("POST /api/department-head error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
