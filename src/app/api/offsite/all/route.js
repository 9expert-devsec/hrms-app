// src/app/api/offsite/all/route.js — HR-wide list of off-site requests (offsite_hr).
// ?status=&month=YYYY-MM&department=&q=&page= ; drafts never included.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import { listAllRequests, listVersion, offsiteErrorResponse } from "@/lib/offsite";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const gate = await requirePageApi("offsite_hr");
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    const sp = new URL(req.url).searchParams;
    const [out, { version }] = await Promise.all([
      listAllRequests({
        status: sp.get("status") || "",
        month: sp.get("month") || "",
        department: sp.get("department") || "",
        q: sp.get("q") || "",
        page: sp.get("page") || 1,
      }),
      listVersion(gate.session, "all"),
    ]);
    return NextResponse.json({ ...out, version }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const { body, status } = offsiteErrorResponse(e, "all");
    return NextResponse.json(body, { status });
  }
}
