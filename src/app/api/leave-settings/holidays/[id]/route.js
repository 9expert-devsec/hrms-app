// /api/leave-settings/holidays/[id] — edit (PATCH { date, name, kind }) or
// delete one holiday (ตั้งค่าการลา › วันหยุด). Leaves already submitted keep
// the count they were submitted with (Leave.excludedDates is a snapshot).
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import Holiday from "@/lib/models/Holiday";
import { validateHoliday } from "@/lib/leaveRules";
import { keyToDate } from "@/lib/leave/countLeave";
import { thaiDateShort } from "@/lib/leave/format";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
const duplicateMessage = (date) => `มีวันหยุดวันที่ ${thaiDateShort(date)} อยู่แล้ว`;

export async function PATCH(req, { params }) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return json({ ok: false, message: "ไม่พบวันหยุดนี้" }, 404);
  const checked = validateHoliday(await req.json().catch(() => null));
  if (checked.error) return json({ ok: false, message: checked.error, field: checked.field }, 400);
  const { date, name, kind } = checked.value;
  try {
    await dbConnect();
    if (await Holiday.exists({ _id: { $ne: id }, date: keyToDate(date) })) return json({ ok: false, message: duplicateMessage(date), field: "date" }, 409);
    const h = await Holiday.findByIdAndUpdate(id, { $set: { date: keyToDate(date), name, type: kind } }, { new: true }).lean();
    if (!h) return json({ ok: false, message: "ไม่พบวันหยุดนี้" }, 404);
    return json({ ok: true, holiday: { _id: String(h._id), date, name: h.name, kind } });
  } catch (e) {
    if (e?.code === 11000) return json({ ok: false, message: duplicateMessage(date), field: "date" }, 409);
    console.error("[leave-settings/holidays][PATCH] error:", e?.message);
    return json({ ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
}

export async function DELETE(_req, { params }) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return json({ ok: false, message: "ไม่พบวันหยุดนี้" }, 404);
  try {
    await dbConnect();
    const deleted = await Holiday.findByIdAndDelete(id).lean();
    if (!deleted) return json({ ok: false, message: "ไม่พบวันหยุดนี้" }, 404);
    return json({ ok: true });
  } catch (e) {
    console.error("[leave-settings/holidays][DELETE] error:", e?.message);
    return json({ ok: false, message: "ลบไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
}
