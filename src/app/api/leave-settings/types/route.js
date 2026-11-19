// POST /api/leave-settings/types — add a leave type (ตั้งค่าการลา › ประเภทการลา).
import { NextResponse } from "next/server";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import LeaveType from "@/models/LeaveType";
import { leaveTypeNameKey, validateLeaveType } from "@/lib/leaveRules";
import { ensureLeaveSetup, serializeType } from "@/lib/leaveSettings";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function POST(req) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  try {
    const checked = validateLeaveType(await req.json().catch(() => null));
    if (checked.error) return json({ ok: false, message: checked.error, field: checked.field }, 400);
    await dbConnect();
    await ensureLeaveSetup();
    const nameKey = leaveTypeNameKey(checked.value.nameTh);
    if (await LeaveType.exists({ nameKey })) return json({ ok: false, message: "มีประเภทการลาชื่อนี้แล้ว", field: "nameTh" }, 409);
    const last = await LeaveType.findOne({}).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const created = await LeaveType.create({ ...checked.value, nameKey, isSystem: false, sortOrder: (last?.sortOrder || 0) + 10 });
    return json({ ok: true, type: serializeType(created.toObject()) }, 201);
  } catch (e) {
    if (e?.code === 11000) return json({ ok: false, message: "มีประเภทการลาชื่อนี้แล้ว", field: "nameTh" }, 409);
    console.error("[leave-settings/types][POST] error:", e?.message);
    return json({ ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
}
