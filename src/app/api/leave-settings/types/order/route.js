// PUT /api/leave-settings/types/order { ids: [typeId, …] } — every type, in the new order.
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import LeaveType from "@/models/LeaveType";
import { listLeaveTypes } from "@/lib/leaveSettings";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function PUT(req) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  try {
    const ids = (await req.json().catch(() => null))?.ids;
    if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id)) || new Set(ids).size !== ids.length) {
      return json({ ok: false, message: "ลำดับไม่ถูกต้อง" }, 400);
    }
    await dbConnect();
    const all = (await LeaveType.find({}).select("_id").lean()).map((t) => String(t._id));
    const sent = new Set(ids);
    if (all.length !== ids.length || all.some((id) => !sent.has(id))) return json({ ok: false, message: "รายการไม่ตรงกับข้อมูลปัจจุบัน — โหลดหน้าใหม่" }, 409);
    await LeaveType.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder: (i + 1) * 10 } } } })));
    return json({ ok: true, types: await listLeaveTypes() });
  } catch (e) {
    console.error("[leave-settings/types/order][PUT] error:", e?.message);
    return json({ ok: false, message: "บันทึกลำดับไม่สำเร็จ" }, 500);
  }
}
