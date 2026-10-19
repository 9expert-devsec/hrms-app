// src/app/api/offsite/count/route.js — invitations waiting for my answer (menu badge).
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import { inviteCount, offsiteErrorResponse } from "@/lib/offsite";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePageApi("offsite_self");
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    return NextResponse.json({ invites: await inviteCount(gate.session) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const { body, status } = offsiteErrorResponse(e, "count");
    return NextResponse.json(body, { status });
  }
}
