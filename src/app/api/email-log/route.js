// src/app/api/email-log/route.js — read-only email attempts (models/EmailLog.js).
// Superadmin: every type. offsite_hr holders: off-site types only.
// ?status=sent|failed|skipped ; latest 200 rows.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import EmailLog from "@/models/EmailLog";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const gate = await requirePageApi("offsite_hr"); // superadmin passes too
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    const status = new URL(req.url).searchParams.get("status");
    const query = {};
    if (["sent", "failed", "skipped"].includes(status)) query.status = status;
    if (gate.session.user.isSuperadmin !== true) query.type = /^offsite_/;
    const rows = await EmailLog.find(query).sort({ at: -1 }).limit(200).lean();
    return NextResponse.json(
      { items: rows.map((r) => ({ ...r, _id: String(r._id), requestId: r.requestId ? String(r.requestId) : null })) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[email-log]", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในระบบ" }, { status: 500 });
  }
}
