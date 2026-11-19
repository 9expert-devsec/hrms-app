// /api/leave-settings/holidays — ตั้งค่าการลา › วันหยุด.
//   GET  ?year=2026 (Gregorian calendar year) → { holidays, weeklyDaysOff }
//   POST { date: "YYYY-MM-DD", name, kind: "public" | "company" }
// Same collection as the attendance holidays page (lib/models/Holiday.js;
// its `type` field is the kind).
import { NextResponse } from "next/server";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import Holiday from "@/lib/models/Holiday";
import { validateHoliday } from "@/lib/leaveRules";
import { getLeaveSettings, weeklyDaysOffOf } from "@/lib/leaveSettings";
import { listHolidaysBetween } from "@/lib/leave/requests";
import { keyToDate, todayKey } from "@/lib/leave/countLeave";
import { thaiDateShort } from "@/lib/leave/format";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

const duplicateMessage =(date) => `มีวันหยุดวันที่ ${thaiDateShort(date)} อยู่แล้ว`;

export async function GET(req) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  try {
    const y = Number(new URL(req.url).searchParams.get("year")) || Number(todayKey().slice(0, 4));
    if (!Number.isInteger(y) || y < 2000 || y > 2200) return json({ ok: false, message: "ปีไม่ถูกต้อง" }, 400);
    await dbConnect();
    const [holidays, settings] = await Promise.all([listHolidaysBetween(`${y}-01-01`, `${y}-12-31`), getLeaveSettings()]);
    return json({ ok: true, year: y, holidays, weeklyDaysOff: weeklyDaysOffOf(settings) });
  } catch (e) {
    console.error("[leave-settings/holidays][GET] error:", e?.message);
    return json({ ok: false, message: "โหลดวันหยุดไม่สำเร็จ" }, 500);
  }
}

export async function POST(req) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  const checked = validateHoliday(await req.json().catch(() => null));
  if (checked.error) return json({ ok: false, message: checked.error, field: checked.field }, 400);
  const { date, name, kind } = checked.value;
  try {
    await dbConnect();
    if (await Holiday.exists({ date: keyToDate(date) })) return json({ ok: false, message: duplicateMessage(date), field: "date" }, 409);
    const h = await Holiday.create({ date: keyToDate(date), name, type: kind, createdBy: gate.session.user.id || null });
    return json({ ok: true, holiday: { _id: String(h._id), date, name: h.name, kind } }, 201);
  } catch (e) {
    if (e?.code === 11000) return json({ ok: false, message: duplicateMessage(date), field: "date" }, 409);
    console.error("[leave-settings/holidays][POST] error:", e?.message);
    return json({ ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
}
