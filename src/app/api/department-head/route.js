// src/app/api/department-head/route.js
// Heads of department live in Department.headOfDepartment (see lib/hod.js).
import { NextResponse } from "next/server";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import { listDepartmentHeads, setDepartmentHead, HodError } from "@/lib/hod";

export async function GET() {
  try {
    const gate = await requirePageApi("hod_settings");
    if (gate.res) return gate.res;

    await dbConnect();
    const items = await listDepartmentHeads();
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/department-head error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

/**
 * Assign a head: { departmentId, employeeId }. Any employee may be picked
 * (no login account needed). Clearing (employeeId null/empty) is
 * superadmin-only, like DELETE /api/department-head/[departmentId].
 */
export async function POST(req) {
  try {
    const gate = await requirePageApi("hod_settings");
    if (gate.res) return gate.res;
    const { session } = gate;

    const { departmentId, employeeId } = await req.json().catch(() => ({}));
    if (!departmentId) {
      return NextResponse.json({ ok: false, message: "ต้องระบุ departmentId" }, { status: 400 });
    }
    const clearing = employeeId == null || employeeId === "";
    if (clearing && session.user.isSuperadmin !== true) {
      return NextResponse.json({ ok: false, message: "เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่ล้างหัวหน้าแผนกได้" }, { status: 403 });
    }

    await dbConnect();
    const item = await setDepartmentHead(departmentId, clearing ? null : employeeId);
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    if (err instanceof HodError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: err.status });
    }
    console.error("POST /api/department-head error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
