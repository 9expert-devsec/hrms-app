import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireSessionAPI, requireRoleAPI } from "@/lib/authz";
import Holiday from "@/lib/models/Holiday";

export const dynamic = "force-dynamic";

function parseCSV(csvText) {
  const lines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  return lines
    .slice(1)
    .map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const obj = {};
      headers.forEach((h, i) => (obj[h] = values[i]));

      const d = new Date(obj.date);
      if (!obj.date || isNaN(d) || !obj.name) return null;

      d.setUTCHours(0, 0, 0, 0);
      return {
        date: d,
        name: obj.name,
        type: obj.type === "company" ? "company" : "public",
      };
    })
    .filter(Boolean);
}

export async function GET(req) {
  try {
    await dbConnect();
    const { res } = await requireSessionAPI();
    if (res) return res;

    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year")) || new Date().getFullYear();

    const data = await Holiday.find({
      date: {
        $gte: new Date(Date.UTC(year, 0, 1)),
        $lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
      },
    })
      .sort({ date: 1 })
      .lean();

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("GET /api/attendance/holidays error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const { session, res } = await requireRoleAPI(["superadmin", "hr"]);
    if (res) return res;

    const contentType = req.headers.get("content-type") || "";

    // ── CSV upload ──
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file) {
        return NextResponse.json({ ok: false, message: "ไม่พบไฟล์ CSV" }, { status: 400 });
      }

      const text = await file.text();
      const holidays = parseCSV(text);

      if (holidays.length === 0) {
        return NextResponse.json({ ok: false, message: "ไม่พบข้อมูลที่ถูกต้องใน CSV" }, { status: 400 });
      }

      const result = await Holiday.bulkWrite(
        holidays.map((h) => ({
          updateOne: {
            filter: { date: h.date },
            update: { $set: h },
            upsert: true,
          },
        })),
      );

      return NextResponse.json({
        ok: true,
        inserted: result.upsertedCount || 0,
        updated: result.modifiedCount || 0,
        total: holidays.length,
      });
    }

    // ── Single JSON holiday ──
    const body = await req.json();
    const { date, name, type } = body;

    if (!date || !name) {
      return NextResponse.json({ ok: false, message: "กรุณากรอกวันที่และชื่อวันหยุด" }, { status: 400 });
    }

    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    const existing = await Holiday.findOne({ date: d });
    if (existing) {
      return NextResponse.json({ ok: false, message: "วันหยุดนี้มีอยู่แล้ว" }, { status: 409 });
    }

    const holiday = await Holiday.create({
      date: d,
      name: name.trim(),
      type: type === "company" ? "company" : "public",
    });

    return NextResponse.json({ ok: true, data: holiday }, { status: 201 });
  } catch (err) {
    console.error("POST /api/attendance/holidays error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}
