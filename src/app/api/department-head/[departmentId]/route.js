// src/app/api/department-head/[departmentId]/route.js
import { NextResponse } from "next/server";
import { requireSuperadminApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import { setDepartmentHead, HodError } from "@/lib/hod";

/** Clear a department's head. Superadmin-only, as before. */
export async function DELETE(_req, { params }) {
  try {
    const gate = await requireSuperadminApi();
    if (gate.res) return gate.res;

    const { departmentId } = await params;
    await dbConnect();
    const item = await setDepartmentHead(departmentId, null, { actor: gate.session.user });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    if (err instanceof HodError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: err.status });
    }
    console.error("DELETE /api/department-head/[departmentId] error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
