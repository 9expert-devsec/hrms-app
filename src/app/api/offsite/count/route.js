// src/app/api/offsite/count/route.js — what waits for me (menu badge):
// { invites, approvals, total }.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import { badgeCounts, offsiteErrorResponse } from "@/lib/offsite";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePageApi("offsite_self");
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    const { invites, approvals } = await badgeCounts(gate.session);
    return NextResponse.json({ invites, approvals, total: invites + approvals }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const { body, status } = offsiteErrorResponse(e, "count");
    return NextResponse.json(body, { status });
  }
}
