// /api/leave-settings/entitlements — ตั้งค่าการลา › โควตาวันลา.
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import LeaveType from "@/models/LeaveType";
import LeaveEntitlement from "@/models/LeaveEntitlement";
import { validateQuota } from "@/lib/leaveRules";
import { currentFiscalYear, getLeaveSettings, listEntitlements } from "@/lib/leaveSettings";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

/** Editable: the current and the next fiscal year. Earlier years are read-only. */
async function checkYear(fy) {
  const settings = await getLeaveSettings();
  const current = currentFiscalYear(settings);
  if (!Number.isInteger(fy)) return { error: "ปีงบประมาณไม่ถูกต้อง", status: 400 };
  if (fy < current) return { error: "ปีงบประมาณที่ผ่านมาแก้ไขไม่ได้", status: 400 };
  if (fy > current + 1) return { error: "แก้ไขได้เฉพาะปีงบประมาณปัจจุบันและปีถัดไป", status: 400 };
  return {};
}

const validId = (v) => typeof v === "string" && mongoose.isValidObjectId(v);

/** GET ?fiscalYear=2026 → the records of that year. */
export async function GET(req) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  const fy = Number(new URL(req.url).searchParams.get("fiscalYear"));
  if (!Number.isInteger(fy) || fy < 2000 || fy > 2200) return json({ ok: false, message: "ปีงบประมาณไม่ถูกต้อง" }, 400);
  await dbConnect();
  return json({ ok: true, fiscalYear: fy, entitlements: await listEntitlements(fy) });
}

/** PUT { employeeId, leaveTypeId, fiscalYear, quotaDays } — set one cell (quotaDays null = no limit). */
export async function PUT(req) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  try {
    const body = (await req.json().catch(() => null)) || {};
    if (!validId(body.employeeId) || !validId(body.leaveTypeId)) return json({ ok: false, message: "ข้อมูลไม่ถูกต้อง" }, 400);
    if (!("quotaDays" in body)) return json({ ok: false, message: "กรุณาระบุโควตา" }, 400);
    const q = validateQuota(body.quotaDays);
    if (q.error) return json({ ok: false, message: q.error }, 400);
    await dbConnect();
    const y = await checkYear(Number(body.fiscalYear));
    if (y.error) return json({ ok: false, message: y.error }, y.status);
    const [emp, type] = await Promise.all([Employee.exists({ _id: body.employeeId }), LeaveType.exists({ _id: body.leaveTypeId })]);
    if (!emp || !type) return json({ ok: false, message: "ไม่พบพนักงานหรือประเภทการลา" }, 404);
    await LeaveEntitlement.updateOne(
      { employeeId: body.employeeId, fiscalYear: Number(body.fiscalYear), leaveTypeId: body.leaveTypeId },
      { $set: { quotaDays: q.value } },
      { upsert: true, runValidators: true }
    );
    return json({ ok: true, quotaDays: q.value });
  } catch (e) {
    console.error("[leave-settings/entitlements][PUT] error:", e?.message);
    return json({ ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
}

/** DELETE ?employeeId&leaveTypeId&fiscalYear — "รีเซ็ตเป็นค่าเริ่มต้น" (removes the record). */
export async function DELETE(req) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  try {
    const sp = new URL(req.url).searchParams;
    const employeeId = sp.get("employeeId");
    const leaveTypeId = sp.get("leaveTypeId");
    if (!validId(employeeId) || !validId(leaveTypeId)) return json({ ok: false, message: "ข้อมูลไม่ถูกต้อง" }, 400);
    await dbConnect();
    const fy = Number(sp.get("fiscalYear"));
    const y = await checkYear(fy);
    if (y.error) return json({ ok: false, message: y.error }, y.status);
    await LeaveEntitlement.deleteOne({ employeeId, fiscalYear: fy, leaveTypeId });
    return json({ ok: true });
  } catch (e) {
    console.error("[leave-settings/entitlements][DELETE] error:", e?.message);
    return json({ ok: false, message: "รีเซ็ตไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
}

/** POST { action: "reset-type", leaveTypeId, fiscalYear } — "ใช้ค่าเริ่มต้นกับทุกคน" for one type. */
export async function POST(req) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  try {
    const body = (await req.json().catch(() => null)) || {};
    if (body.action !== "reset-type" || !validId(body.leaveTypeId)) return json({ ok: false, message: "ข้อมูลไม่ถูกต้อง" }, 400);
    await dbConnect();
    const y = await checkYear(Number(body.fiscalYear));
    if (y.error) return json({ ok: false, message: y.error }, y.status);
    if (!(await LeaveType.exists({ _id: body.leaveTypeId }))) return json({ ok: false, message: "ไม่พบประเภทการลา" }, 404);
    const r = await LeaveEntitlement.deleteMany({ fiscalYear: Number(body.fiscalYear), leaveTypeId: body.leaveTypeId });
    return json({ ok: true, removed: r.deletedCount });
  } catch (e) {
    console.error("[leave-settings/entitlements][POST] error:", e?.message);
    return json({ ok: false, message: "ดำเนินการไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
}
