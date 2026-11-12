// PUT /api/departments/order — save the display order chosen on แผนกและตำแหน่ง.
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import Department from "@/models/Department";
import { sortOrderAt } from "@/lib/departmentOrder";

const NO_STORE = { "Cache-Control": "no-store" };
const bad = (message, status = 400) => NextResponse.json({ ok: false, message }, { status, headers: NO_STORE });

/**
 * Body { ids: [departmentId, …] } — EVERY department, in the new order, each
 * once. Writes sortOrder 10, 20, 30… for all of them in one bulk write.
 * Same permission as editing departments (the `departments` page).
 */
export async function PUT(req) {
  const gate = await requirePageApi("departments");
  if (gate.res) return gate.res;
  try {
    const body = await req.json().catch(() => null);
    const ids = body?.ids;
    if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id))) {
      return bad("ลำดับแผนกไม่ถูกต้อง");
    }
    if (new Set(ids).size !== ids.length) return bad("ลำดับแผนกมีรายการซ้ำ");

    await dbConnect();
    const all = (await Department.find({}).select("_id").lean()).map((d) => String(d._id));
    const sent = new Set(ids);
    if (all.length !== ids.length || all.some((id) => !sent.has(id))) {
      return bad("รายการแผนกไม่ตรงกับข้อมูลปัจจุบัน — โหลดหน้าใหม่แล้วลองอีกครั้ง", 409);
    }

    await Department.bulkWrite(
      ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder: sortOrderAt(i) } } } }))
    );
    return NextResponse.json({ ok: true, order: ids.map((id, i) => ({ id, sortOrder: sortOrderAt(i) })) }, { headers: NO_STORE });
  } catch (e) {
    console.error("[departments/order][PUT] error:", e?.message);
    return NextResponse.json({ ok: false, message: "บันทึกลำดับไม่สำเร็จ กรุณาลองใหม่" }, { status: 500, headers: NO_STORE });
  }
}
