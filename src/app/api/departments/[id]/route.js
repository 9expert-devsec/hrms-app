import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Department from "@/models/Department";
import { requirePageApi } from "@/lib/rbac/guard";
import { setDepartmentHead, HodError } from "@/lib/hod";

export async function PUT(req, { params }) {
  try {
    // Had no auth check at all.
    const gate = await requirePageApi("departments");
    if (gate.res) return gate.res;

    await dbConnect();
    const body = await req.json();

    const update = {
      name: String(body.name || "").trim(),
      code: String(body.code || "").trim().toUpperCase(),
      color: body.color || "#6366f1",
      empIdPrefix: String(body.empIdPrefix || "").trim(),
      description: body.description || "",
      allowedLevels: Array.isArray(body.allowedLevels) ? body.allowedLevels : [],
      positions: Array.isArray(body.positions) ? body.positions : [],
    };

    // Head of department goes through the shared helper (same validation as
    // Settings › กำหนด HOD). Written first, so a bad head id leaves the
    // department untouched. ว่างได้ = clear the head.
    if ("headOfDepartment" in body) {
      let headId = body.headOfDepartment ?? null;
      if (typeof headId === "string" && headId.trim() === "") headId = null;
      try {
        await setDepartmentHead(params.id, headId);
      } catch (e) {
        if (e instanceof HodError) return NextResponse.json({ message: e.message }, { status: e.status });
        throw e;
      }
    }

    const doc = await Department.findByIdAndUpdate(params.id, update, {
      new: true,
    }).populate("headOfDepartment", "_id firstName lastName position level empAutoId userId");

    if (!doc) return NextResponse.json({ message: "Department not found" }, { status: 404 });
    return NextResponse.json(doc);
  } catch (err) {
    console.error("PUT /departments error:", err);
    return NextResponse.json({ message: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  try {
    // Had no auth check at all.
    const gate = await requirePageApi("departments");
    if (gate.res) return gate.res;

    await dbConnect();
    const doc = await Department.findByIdAndDelete(params.id);
    if (!doc) return NextResponse.json({ message: "Department not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /departments error:", err);
    return NextResponse.json({ message: err.message || "Internal Server Error" }, { status: 500 });
  }
}
