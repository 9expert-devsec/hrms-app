// PUT /api/leave-settings/weekly-days-off { weeklyDaysOff: [0, 6] } —
// ตั้งค่าการลา › วันหยุด › วันหยุดประจำสัปดาห์ (A1). Stored on the leave
// settings document; leave counting skips these weekdays.
import { NextResponse } from "next/server";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import LeaveSettings from "@/models/LeaveSettings";
import { validateWeeklyDaysOff } from "@/lib/leaveRules";
import { ensureLeaveSetup, weeklyDaysOffOf } from "@/lib/leaveSettings";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function PUT(req) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  const checked = validateWeeklyDaysOff((await req.json().catch(() => null))?.weeklyDaysOff);
  if (checked.error) return json({ ok: false, message: checked.error }, 400);
  try {
    await dbConnect();
    await ensureLeaveSetup();
    const updated = await LeaveSettings.findOneAndUpdate({ key: "default" }, { $set: { weeklyDaysOff: checked.value } }, { new: true }).lean();
    return json({ ok: true, weeklyDaysOff: weeklyDaysOffOf(updated) });
  } catch (e) {
    console.error("[leave-settings/weekly-days-off][PUT] error:", e?.message);
    return json({ ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
}
