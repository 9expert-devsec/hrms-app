import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Department from "@/models/Department";
import mongoose from "mongoose"; // ✅ ใช้ mongoose.isValidObjectId

export async function PUT(req, { params }) {
  try {
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

    // ✅ validate headOfDepartment (ว่างได้, ผิดรูปแบบให้ 400)
    let headId = body.headOfDepartment ?? null;
    if (typeof headId === "string" && headId.trim() === "") headId = null;
    if (headId && !mongoose.isValidObjectId(headId)) {
      return NextResponse.json({ message: "Invalid headOfDepartment id" }, { status: 400 });
    }
    update.headOfDepartment = headId;

    const doc = await Department.findByIdAndUpdate(params.id, update, {
      new: true,
    }).populate("headOfDepartment", "_id firstName lastName position level");

    if (!doc) return NextResponse.json({ message: "Department not found" }, { status: 404 });
    return NextResponse.json(doc);
  } catch (err) {
    console.error("PUT /departments error:", err);
    return NextResponse.json({ message: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  try {
    await dbConnect();
    const doc = await Department.findByIdAndDelete(params.id);
    if (!doc) return NextResponse.json({ message: "Department not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /departments error:", err);
    return NextResponse.json({ message: err.message || "Internal Server Error" }, { status: 500 });
  }
}
