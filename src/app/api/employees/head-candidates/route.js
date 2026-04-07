import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const levels = [5, 6];

    const match = { level: { $in: levels } };

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      Object.assign(match, {
        $or: [
          { firstName: regex },
          { lastName: regex },
          { nickName: regex },
          { position: regex },
        ],
      });
    }

    const items = await Employee.find(match)
      .select("_id firstName lastName nickName position level department userId photoUrl")
      .sort({ level: -1, firstName: 1 })
      .lean();

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { message: e.message || "Failed to load head candidates" },
      { status: 500 }
    );
  }
}
