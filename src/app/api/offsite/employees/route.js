// src/app/api/offsite/employees/route.js — the member picker: every employee's
// name (Thai/English/nickname), position and department code. No contact or
// private fields.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import { listPickableEmployees, offsiteErrorResponse } from "@/lib/offsite";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePageApi("offsite_self");
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    const items = (await listPickableEmployees()).map((e) => ({ ...e, _id: String(e._id) }));
    return NextResponse.json({ items });
  } catch (e) {
    const { body, status } = offsiteErrorResponse(e, "employees");
    return NextResponse.json(body, { status });
  }
}
