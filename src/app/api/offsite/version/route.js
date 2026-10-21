// src/app/api/offsite/version/route.js — a list page's cheap change check:
// ?scope=mine|invites|approvals|member|approved_by_me|history (offsite_self)
// or ?scope=all (offsite_hr) → { version } (lib/offsite.js listVersion).
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import { listVersion, offsiteErrorResponse } from "@/lib/offsite";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req) {
  const scope = new URL(req.url).searchParams.get("scope") || "mine";
  const gate = await requirePageApi(scope === "all" ? "offsite_hr" : "offsite_self");
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    return NextResponse.json(await listVersion(gate.session, scope), { headers: NO_STORE });
  } catch (e) {
    const { body, status } = offsiteErrorResponse(e, "list version GET");
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
