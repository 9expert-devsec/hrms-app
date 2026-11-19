// PUT /api/leave-settings/approvers/[employeeId] { approver1Id, approver2Id } — who approves this employee's leave.
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import { normalizeApprovers } from "@/lib/leaveRules";
import { existingEmployeeIds } from "@/lib/leaveSettings";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function PUT(req, { params }) {
  const gate = await requirePageApi("leave_settings");
  if (gate.res) return gate.res;
  try {
    const { employeeId } = await params;
    if (!mongoose.isValidObjectId(employeeId)) return json({ ok: false, message: "ไม่พบพนักงาน" }, 404);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ ok: false, message: "ข้อมูลไม่ถูกต้อง" }, 400);
    for (const k of ["approver1Id", "approver2Id"]) {
      const v = body[k];
      if (v !== null && v !== undefined && v !== "" && (typeof v !== "string" || !mongoose.isValidObjectId(v))) {
        return json({ ok: false, message: "ผู้อนุมัติไม่ถูกต้อง", field: k }, 400);
      }
    }
    // Only approver 2 → it becomes approver 1; the same person twice → approver 1 only.
    const { approver1Id, approver2Id } = normalizeApprovers(body.approver1Id, body.approver2Id);
    if ([approver1Id, approver2Id].includes(employeeId)) return json({ ok: false, message: "พนักงานเป็นผู้อนุมัติของตัวเองไม่ได้" }, 400);

    await dbConnect();
    if (!(await Employee.exists({ _id: employeeId }))) return json({ ok: false, message: "ไม่พบพนักงาน" }, 404);
    const chosen = [approver1Id, approver2Id].filter(Boolean);
    const exist = await existingEmployeeIds(chosen);
    if (chosen.some((id) => !exist.has(id))) return json({ ok: false, message: "ไม่พบผู้อนุมัติที่เลือก" }, 400);

    await Employee.updateOne({ _id: employeeId }, { $set: { leaveApprover1Id: approver1Id, leaveApprover2Id: approver2Id } });
    return json({ ok: true, approver1Id, approver2Id });
  } catch (e) {
    console.error("[leave-settings/approvers][PUT] error:", e?.message);
    return json({ ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
}
