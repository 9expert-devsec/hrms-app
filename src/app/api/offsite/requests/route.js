// src/app/api/offsite/requests/route.js — off-site work requests (lib/offsite.js).
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import { createRequest, listRequests, listVersion, offsiteErrorResponse } from "@/lib/offsite";

export const dynamic = "force-dynamic";

/** ?box=mine (default) | invites | member | approvals | approved_by_me → { items, version } (version: GET /api/offsite/version). */
export async function GET(req) {
  const gate = await requirePageApi("offsite_self");
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    const box = new URL(req.url).searchParams.get("box") || "mine";
    const [items, { version }] = await Promise.all([listRequests(gate.session, box), listVersion(gate.session, box)]);
    return NextResponse.json({ items, version }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const { body, status } = offsiteErrorResponse(e, "requests GET");
    return NextResponse.json(body, { status });
  }
}

/** Create a draft. Body: the form fields, members [{ employee, duty }], leader. */
export async function POST(req) {
  const gate = await requirePageApi("offsite_self");
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    const input = await req.json().catch(() => ({}));
    const out = await createRequest(gate.session, input);
    return NextResponse.json(out, { status: 201 });
  } catch (e) {
    const { body, status } = offsiteErrorResponse(e, "requests POST");
    return NextResponse.json(body, { status });
  }
}
