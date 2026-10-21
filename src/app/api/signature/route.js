// src/app/api/signature/route.js
//
// The caller's OWN saved signature (models/EmployeeSignature.js — the one
// signature store), used to sign off-site requests, leave requests and leave
// approvals. Never anyone else's, and never a public URL: a signature image
// must not be fetchable by link.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import { getSignature, saveSignature, viewerEmployee, offsiteErrorResponse } from "@/lib/offsite";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
// Off-site, profile, and the leave screens (request + approval).
const SIGNATURE_PAGES = ["offsite_self", "self_profile", "self_leave_request", "leave_approve"];

export async function GET() {
  const gate = await requireAnyPageApi(SIGNATURE_PAGES);
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    const emp = await viewerEmployee(gate.session);
    const sig = await getSignature(emp._id);
    return NextResponse.json({ png: sig?.png || null, updatedAt: sig?.updatedAt || null }, { headers: NO_STORE });
  } catch (e) {
    const { body, status } = offsiteErrorResponse(e, "signature GET");
    return NextResponse.json(body, { status });
  }
}

/** Body: { png: "data:image/png;base64,…" } — a 400×160 PNG, ≤ 300 KB (lib/signaturePng.js). */
export async function PUT(req) {
  const gate = await requireAnyPageApi(SIGNATURE_PAGES);
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    const emp = await viewerEmployee(gate.session);
    const { png } = await req.json().catch(() => ({}));
    const sig = await saveSignature(emp._id, png);
    return NextResponse.json({ png: sig.png, updatedAt: sig.updatedAt }, { headers: NO_STORE });
  } catch (e) {
    const { body, status } = offsiteErrorResponse(e, "signature PUT");
    return NextResponse.json(body, { status });
  }
}
