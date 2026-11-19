// /api/leave-settings — ตั้งค่าการลา › ทั่วไป (and the page's initial data).
import { NextResponse } from "next/server";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import LeaveSettings from "@/models/LeaveSettings";
import { validateGeneralSettings } from "@/lib/leaveRules";
import { existingEmployeeIds, getLeaveSettings, listLeaveTypes, serializeSettings } from "@/lib/leaveSettings";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function GET() {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  await dbConnect();
  const [settings, types] = await Promise.all([getLeaveSettings(), listLeaveTypes()]);
  return json({ ok: true, settings: serializeSettings(settings), types });
}

/**
 * PUT { fiscalYearStartMonth, hoursPerDay, workdayStart, workdayEnd,
 *       halfDayMorning, halfDayAfternoon, hrSigners: [employeeId, …] }
 * The whole ทั่วไป tab at once; hrSigners keep their order.
 */
export async function PUT(req) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  try {
    const body = await req.json().catch(() => null);
    const checked = validateGeneralSettings(body);
    if (checked.error) return json({ ok: false, message: checked.error, field: checked.field }, 400);

    const signers = body.hrSigners;
    if (!Array.isArray(signers) || signers.some((id) => typeof id !== "string")) {
      return json({ ok: false, message: "รายชื่อผู้ลงนามฝ่ายบุคคลไม่ถูกต้อง", field: "hrSigners" }, 400);
    }
    if (new Set(signers).size !== signers.length) return json({ ok: false, message: "ผู้ลงนามฝ่ายบุคคลซ้ำกัน", field: "hrSigners" }, 400);
    await dbConnect();
    const exist = await existingEmployeeIds(signers);
    if (signers.some((id) => !exist.has(id))) return json({ ok: false, message: "ไม่พบพนักงานบางคนในรายชื่อผู้ลงนาม", field: "hrSigners" }, 400);

    await getLeaveSettings(); // make sure the singleton exists
    const updated = await LeaveSettings.findOneAndUpdate(
      { key: "default" },
      { $set: { ...checked.value, hrSigners: signers } },
      { new: true, runValidators: true }
    ).lean();
    return json({ ok: true, settings: serializeSettings(updated) });
  } catch (e) {
    console.error("[leave-settings][PUT] error:", e?.message);
    return json({ ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
}
