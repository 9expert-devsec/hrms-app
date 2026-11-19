// RETIRED in round 41: the first leave flow's HOD / HR lists. The approval
// lists are GET /api/leave/approvals?tab=… (lib/leave/approval.js).
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: false, message: "ใช้ /api/leave/approvals แทน" }, { status: 410 });
}
