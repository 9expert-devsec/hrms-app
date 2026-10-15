import { NextResponse } from "next/server";
import { requireAnyPageApi, requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import Department from "@/models/Department";

const LEVEL_SET = new Set([1, 2, 3, 4, 5, 6]);

export async function GET() {
  // Shared read: department screens, the employee form, the HOD settings.
  const gate = await requireAnyPageApi(["departments", "employees", "hod_settings"]);
  if (gate.res) return gate.res;

  await dbConnect();

  // ดึงข้อมูลเฉพาะที่เกี่ยวกับการสร้างพนักงาน
  const items = await Department.find(
    {},
    "code name empIdPrefix color allowedLevels positions"
  )
    .sort({ code: 1 })
    .lean();

  return NextResponse.json({ ok: true, items });
}

export async function POST(req) {
  try {
    const gate = await requirePageApi("departments");
    if (gate.res) return gate.res;

    await dbConnect();
    const body = await req.json();
    let { name, code, color, description, allowLevels, positions } = body || {};

    // Validate พื้นฐาน
    if (!name?.trim() || !code?.trim()) {
      return new Response(JSON.stringify({ message: "Missing name/code" }), {
        status: 400,
      });
    }

    code = code.trim().toUpperCase();
    if (!/^[A-Z]{2,8}$/.test(code)) {
      return new Response(JSON.stringify({ message: "Invalid code format" }), {
        status: 400,
      });
    }

    // allowLevels
    if (!Array.isArray(allowLevels) || allowLevels.length === 0) {
      return new Response(
        JSON.stringify({ message: "Allow levels is required" }),
        { status: 400 }
      );
    }
    // ตรวจว่ามีเฉพาะ 1..6
    allowLevels = [...new Set(allowLevels.map((n) => Number(n)))].filter((n) =>
      LEVEL_SET.has(n)
    );
    if (allowLevels.length === 0) {
      return new Response(JSON.stringify({ message: "Allow levels invalid" }), {
        status: 400,
      });
    }

    // positions (อาจเป็นว่างก็ได้ แต่ถ้ามีต้องถูกเงื่อนไข)
    if (!Array.isArray(positions)) positions = [];
    if (positions.length > 10) {
      return new Response(
        JSON.stringify({ message: "Positions must be <= 10" }),
        { status: 400 }
      );
    }

    // ตรวจ positions ทุกแถว
    const usedNames = new Set();
    const cleanedPositions = [];
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i] || {};
      const name = (p.name || "").trim();
      const level = Number(p.level);

      if (!name) {
        return new Response(
          JSON.stringify({ message: `Position #${i + 1}: name is required` }),
          { status: 400 }
        );
      }
      if (usedNames.has(name.toLowerCase())) {
        return new Response(
          JSON.stringify({
            message: `Position #${i + 1}: duplicate name "${name}"`,
          }),
          { status: 400 }
        );
      }
      usedNames.add(name.toLowerCase());

      if (!LEVEL_SET.has(level)) {
        return new Response(
          JSON.stringify({
            message: `Position #${i + 1}: invalid level`,
          }),
          { status: 400 }
        );
      }
      if (!allowLevels.includes(level)) {
        return new Response(
          JSON.stringify({
            message: `Position #${i + 1}: level not in allow levels`,
          }),
          { status: 400 }
        );
      }

      cleanedPositions.push({
        name,
        level,
        order: i,
      });
    }

    // สร้าง Department
    const created = await Department.create({
      name: name.trim(),
      code,
      color: color || "#6366f1",
      description: description || "",
      allowLevels,
      positions: cleanedPositions,
    });

    return new Response(JSON.stringify({ ok: true, id: created._id }), {
      status: 201,
    });
  } catch (err) {
    // duplicate key (code ซ้ำ)
    if (err?.code === 11000) {
      return new Response(JSON.stringify({ message: "Code already exists" }), {
        status: 409,
      });
    }
    console.error("Create department error:", err);
    const payload = {
      message: err?.message || "Create failed",
      code: err?.code ?? null,
      name: err?.name ?? null,
      errors: err?.errors ?? null,
    };
    // ถ้าเป็น duplicate code
    const status = err?.code === 11000 ? 409 : 500;
    return new Response(JSON.stringify(payload), { status });
  }
}
