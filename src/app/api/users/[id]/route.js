// src/app/api/users/[id]/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import mongoose from "mongoose";

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  if (!["superadmin", "hr", "it"].includes(session.user.role || "")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = params; // userId
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ ok: false, message: "invalid user id" }, { status: 400 });
  }

  await dbConnect();
  const body = await req.json().catch(() => ({}));
  const update = {};

  if (body.role) update.role = body.role;
  // (ถ้าจะให้เปลี่ยนอีเมลที่นี่ด้วยก็เพิ่ม validate และ assign ได้)

  const doc = await User.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!doc) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({ ok: true, user: { _id: String(doc._id), role: doc.role } });
}
