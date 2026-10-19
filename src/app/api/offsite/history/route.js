// src/app/api/offsite/history/route.js — approved off-site work of one employee.
//   ?year=2026             → my own history (offsite_self)
//   ?employee=<id>&year=   → anyone's history (offsite_hr / superadmin only)
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";
import { hasHrView, listHistory, offsiteErrorResponse, OffsiteError } from "@/lib/offsite";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const gate = await requireAnyPageApi(["offsite_self", "offsite_hr"]);
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    const sp = new URL(req.url).searchParams;
    const own = await getOwnEmployee(gate.session, "_id");
    const wanted = sp.get("employee");
    let employeeId = own?._id ? String(own._id) : null;
    if (wanted && wanted !== employeeId) {
      if (!hasHrView(gate.session.user)) throw new OffsiteError("ไม่มีสิทธิ์ดูประวัติของพนักงานคนอื่น", 403);
      employeeId = wanted;
    }
    if (!employeeId) throw new OffsiteError("บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน", 403);
    const out = await listHistory(employeeId, sp.get("year"));
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const { body, status } = offsiteErrorResponse(e, "history");
    return NextResponse.json(body, { status });
  }
}
