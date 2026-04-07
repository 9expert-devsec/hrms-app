// src/app/api/employees/me/signature/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireSessionApi } from "@/lib/authz";
import Employee from "@/models/Employee";

async function resolveEmployee(me) {
  if (!me) return null;
  return (
    (await Employee.findOne({
      $or: [
        { _id: me.employeeId },
        { _id: me._id },
        { userId: me._id },
        { user: me._id },
      ],
    }).lean()) || null
  );
}

export async function GET() {
  try {
    await dbConnect();
    const me = await requireSessionApi();
    const emp = await resolveEmployee(me);

    // รองรับได้ทั้ง signatureDataUrl และ signature
    const dataUrl = emp?.signatureDataUrl || emp?.signature || "";
    return NextResponse.json({ dataUrl });
  } catch (e) {
    console.error("[employees/me/signature][GET] error:", e);
    const status = e instanceof Response ? e.status : 500;
    return NextResponse.json({ message: e.message || "failed" }, { status });
  }
}
