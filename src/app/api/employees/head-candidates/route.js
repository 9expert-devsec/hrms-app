import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import { NextResponse } from "next/server";
import { requirePageApi } from "@/lib/rbac/guard";

export async function GET(req) {
  try {
    // Only the HOD settings page picks heads (the department edit form
    // loads its candidates server-side).
    const gate = await requirePageApi("hod_settings");
    if (gate.res) return gate.res;

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
