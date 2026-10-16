import dbConnect from "@/lib/mongoose";
import { NextResponse } from "next/server";
import { requirePageApi } from "@/lib/rbac/guard";
import { listHeadCandidates } from "@/lib/hod";

export async function GET(req) {
  try {
    // The HOD settings page's picker. (The department edit form loads the
    // same list server-side via listHeadCandidates.)
    const gate = await requirePageApi("hod_settings");
    if (gate.res) return gate.res;

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const items = await listHeadCandidates(searchParams.get("q") || "");

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { message: e.message || "Failed to load head candidates" },
      { status: 500 }
    );
  }
}
