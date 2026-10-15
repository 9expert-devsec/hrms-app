import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import Holiday from "@/lib/models/Holiday";

export async function DELETE(req, { params }) {
  try {
    const gate = await requirePageApi("holidays");
    if (gate.res) return gate.res;

    await dbConnect();

    const { id } = await params;
    const deleted = await Holiday.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/attendance/holidays/[id] error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}
