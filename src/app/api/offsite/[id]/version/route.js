// src/app/api/offsite/[id]/version/route.js — the detail page's cheap change
// check: { version } only (lib/offsite.js getRequestVersion), with the same
// access answers as GET /api/offsite/requests/[id]. Polled every 15 s while
// the page is visible (components/useVisibilityPoll.js).
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import { getRequestVersion, offsiteErrorResponse } from "@/lib/offsite";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req, ctx) {
  const gate = await requireAnyPageApi(["offsite_self", "offsite_hr"]);
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    const { id } = await ctx.params;
    return NextResponse.json(await getRequestVersion(gate.session, id), { headers: NO_STORE });
  } catch (e) {
    const { body, status } = offsiteErrorResponse(e, "version GET");
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
