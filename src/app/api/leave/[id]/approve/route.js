// RETIRED in round 41: the first leave flow's HOD / HR approve. Use
// POST /api/leave/[id]/step1, /acknowledge or /hr (lib/leave/approval.js).
import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json({ ok: false, message: "ใช้ /api/leave/[id]/step1, /acknowledge หรือ /hr แทน" }, { status: 410 });
}
