import dbConnect from "@/lib/mongoose";
import Counter from "@/models/Counter";
import { requirePageApi } from "@/lib/rbac/guard";

export const runtime = "nodejs";

export async function GET(req) {
  const gate = await requirePageApi("employees");
  if (gate.res) return gate.res;

  const { searchParams } = new URL(req.url);
  const prefix = searchParams.get("prefix"); // เช่น "IT"
  if (!prefix) return Response.json({ error: "prefix required" }, { status: 400 });

  await dbConnect();
  // แค่อ่านไม่เพิ่มจริง
  const counter = await Counter.findOne({ key: prefix });
  const next = (counter?.seq || 0) + 1;
  const empAutoId = `${prefix}-${String(next).padStart(4,"0")}`;
  return Response.json({ next, empAutoId });
}
