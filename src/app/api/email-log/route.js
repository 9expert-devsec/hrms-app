// src/app/api/email-log/route.js — read-only email attempts (models/EmailLog.js).
// Superadmin: every type. offsite_hr holders: off-site types. leave_settings
// holders and HR signers (ตั้งค่าการลา): leave types (round 42). Someone with
// both sees both. ?status=sent|failed|skipped ; latest 200 rows.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";
import { isLeaveHrSignerEmployee } from "@/lib/rbac/resolveRole";
import EmailLog from "@/models/EmailLog";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const gate = await requireAnyPageApi(["dashboard", "offsite_hr", "leave_settings"]); // superadmin passes too
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    const user = gate.session.user;
    const status = new URL(req.url).searchParams.get("status");
    const query = {};
    if (["sent", "failed", "skipped"].includes(status)) query.status = status;
    if (user.isSuperadmin !== true) {
      const types = [];
      if (canAccess(user, "offsite_hr")) types.push(/^offsite_/);
      // HR signer read live (not from the token), so a removed signer loses it at once.
      let leaveRows = canAccess(user, "leave_settings");
      if (!leaveRows) {
        const emp = await getOwnEmployee(gate.session, "_id");
        leaveRows = !!emp && (await isLeaveHrSignerEmployee(emp._id));
      }
      if (leaveRows) types.push(/^leave_/);
      if (!types.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      query.type = { $in: types };
    }
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
