// /api/leave-settings/types/[id] — edit or delete one leave type.
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import LeaveType from "@/models/LeaveType";
import LeaveEntitlement from "@/models/LeaveEntitlement";
import { leaveTypeNameKey, validateLeaveType } from "@/lib/leaveRules";
import { leaveTypeUsage, serializeType } from "@/lib/leaveSettings";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

/** PUT — every field of the form (name, category, units, quotas, isActive). System types may be renamed and edited. */
export async function PUT(req, { params }) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  try {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return json({ ok: false, message: "ไม่พบประเภทการลา" }, 404);
    const checked = validateLeaveType(await req.json().catch(() => null));
    if (checked.error) return json({ ok: false, message: checked.error, field: checked.field }, 400);
    await dbConnect();
    const nameKey = leaveTypeNameKey(checked.value.nameTh);
    if (await LeaveType.exists({ nameKey, _id: { $ne: id } })) return json({ ok: false, message: "มีประเภทการลาชื่อนี้แล้ว", field: "nameTh" }, 409);
    const updated = await LeaveType.findByIdAndUpdate(id, { $set: { ...checked.value, nameKey } }, { new: true, runValidators: true }).lean();
    if (!updated) return json({ ok: false, message: "ไม่พบประเภทการลา" }, 404);
    return json({ ok: true, type: serializeType(updated) });
  } catch (e) {
    if (e?.code === 11000) return json({ ok: false, message: "มีประเภทการลาชื่อนี้แล้ว", field: "nameTh" }, 409);
    console.error("[leave-settings/types/[id]][PUT] error:", e?.message);
    return json({ ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
}

/** DELETE — non-system types no leave uses (otherwise deactivate). Its quota records go too. */
export async function DELETE(_req, { params }) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  try {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return json({ ok: false, message: "ไม่พบประเภทการลา" }, 404);
    await dbConnect();
    const type = await LeaveType.findById(id).lean();
    if (!type) return json({ ok: false, message: "ไม่พบประเภทการลา" }, 404);
    if (type.isSystem) return json({ ok: false, message: "ประเภทการลาของระบบลบไม่ได้ — ปิดใช้งานแทนได้" }, 400);
    if (await leaveTypeUsage(id)) return json({ ok: false, message: "มีใบลาที่ใช้ประเภทนี้แล้ว — ปิดใช้งานแทนการลบ" }, 409);
    await LeaveEntitlement.deleteMany({ leaveTypeId: id });
    await LeaveType.deleteOne({ _id: id });
    return json({ ok: true });
  } catch (e) {
    console.error("[leave-settings/types/[id]][DELETE] error:", e?.message);
    return json({ ok: false, message: "ลบไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
}
