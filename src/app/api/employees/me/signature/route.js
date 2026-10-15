// src/app/api/employees/me/signature/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";

export async function GET() {
  try {
    // The caller's OWN signature: requesters and approvers sign with it.
    // (This used to treat the guard's return value as the user, so the
    // lookup matched an arbitrary employee for anyone.)
    const gate = await requireAnyPageApi(["self_leave_request", "leave_approve"]);
    if (gate.res) return gate.res;

    await dbConnect();
    const emp = await getOwnEmployee(gate.session, "_id signatureDataUrl signature");

    // รองรับได้ทั้ง signatureDataUrl และ signature
    const dataUrl = emp?.signatureDataUrl || emp?.signature || "";
    return NextResponse.json({ dataUrl });
  } catch (e) {
    console.error("[employees/me/signature][GET] error:", e);
    const status = e instanceof Response ? e.status : 500;
    return NextResponse.json({ message: e.message || "failed" }, { status });
  }
}
