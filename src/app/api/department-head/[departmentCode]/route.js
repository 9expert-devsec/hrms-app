// src/app/api/department-head/[departmentCode]/route.js
import { NextResponse } from "next/server";
import { requirePageApi, requireSuperadminApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import DepartmentHead from "@/models/DepartmentHead";

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const gate = await requirePageApi("hod_settings");
    if (gate.res) return gate.res;
    const { session } = gate;

    const { departmentCode } = await params;

    const item = await DepartmentHead.findOne({ departmentCode })
      .populate("userId", "email role")
      .populate("assignedBy", "email")
      .lean();

    if (!item) {
      return NextResponse.json({ ok: false, message: "ไม่พบหัวหน้าแผนกนี้" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (err) {
    console.error("GET /api/department-head/[departmentCode] error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    // DELETE stays superadmin-only, as before.
    const gate = await requireSuperadminApi();
    if (gate.res) return gate.res;
    const { session } = gate;


    const { departmentCode } = await params;

    const deleted = await DepartmentHead.findOneAndDelete({ departmentCode });
    if (!deleted) {
      return NextResponse.json({ ok: false, message: "ไม่พบหัวหน้าแผนกนี้" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: "ลบสำเร็จ" });
  } catch (err) {
    console.error("DELETE /api/department-head/[departmentCode] error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
