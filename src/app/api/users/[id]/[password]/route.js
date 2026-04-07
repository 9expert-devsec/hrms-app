// src/app/api/users/[id]/password/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import { hash } from "bcryptjs";
import mongoose from "mongoose";

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = params; // <-- ต้องเป็น userId
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ ok: false, message: "invalid user id" }, { status: 400 });
  }

  await dbConnect();

  const { password } = await req.json().catch(() => ({}));
  if (!password || String(password).length < 6) {
    return NextResponse.json({ ok: false, message: "password too short" }, { status: 400 });
  }

  // อนุญาต: ตัวเอง หรือ superadmin/hr/it
  const caller = { email: session.user.email, role: session.user.role || "employee" };
  const me = await User.findOne({ email: caller.email }).select("_id role").lean();
  const isSelf = me?._id && String(me._id) === String(id);
  const allowed = isSelf || ["superadmin", "hr", "it"].includes(caller.role);
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const newHash = await hash(String(password), 10);
  const upd = await User.findByIdAndUpdate(id, { passwordHash: newHash, updatedAt: new Date() });
  if (!upd) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({ ok: true });
}
