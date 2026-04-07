// src/app/api/leave/entitlements/route.js
import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import LeaveType from "@/models/LeaveType";
import LeaveQuota from "@/models/LeaveQuota";
import LeaveRequest from "@/models/LeaveRequest";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

async function ensureDefaultTypes() {
  const count = await LeaveType.countDocuments();
  if (count === 0) {
    await LeaveType.insertMany([
      { code: "AL", name: "ลาพักร้อน", color: "#22c55e", countable: true },
      { code: "SL", name: "ลาป่วย", color: "#ef4444", countable: true },
      { code: "PL", name: "ลากิจ", color: "#f59e0b", countable: true },
      { code: "WFH", name: "Work from Home", color: "#3b82f6", countable: false },
      { code: "ERR", name: "ทำธุระให้ Office", color: "#8b5cf6", countable: false },
      { code: "OFFSITE", name: "ทำงานนอกสถานที่", color: "#06b6d4", countable: false },
    ]);
  }
}

export async function GET(req) {
  try {
    await dbConnect();
    await ensureDefaultTypes();

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const year = Number(searchParams.get("year") || new Date().getFullYear());

    if (!employeeId || !mongoose.isValidObjectId(employeeId)) {
      return NextResponse.json({ message: "invalid employeeId" }, { status: 400 });
    }

    const types = await LeaveType.find({}).lean();

    // โควตาที่กำหนดไว้
    const quotas = await LeaveQuota.find({ employeeId, year }).lean();

    // ใช้ใบลาที่อนุมัติในปีนั้นคำนวณ used (เฉพาะ countable)
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const usedAgg = await LeaveRequest.aggregate([
      {
        $match: {
          employeeId: new mongoose.Types.ObjectId(employeeId),
          status: "approved",
          startDate: { $lt: end },
          endDate: { $gte: start },
        },
      },
      { $group: { _id: "$typeCode", used: { $sum: "$durationDays" } } },
    ]);

    const usedMap = new Map(usedAgg.map((r) => [r._id, r.used]));

    // special counts (ไม่หักโควตา)
    const special = ["WFH", "ERR", "OFFSITE"];
    const specialAgg = await LeaveRequest.aggregate([
      {
        $match: {
          employeeId: new mongoose.Types.ObjectId(employeeId),
          status: "approved",
          typeCode: { $in: special },
          startDate: { $lt: end },
          endDate: { $gte: start },
        },
      },
      { $group: { _id: "$typeCode", count: { $sum: 1 } } },
    ]);
    const specialMap = new Map(specialAgg.map((r) => [r._id, r.count]));

    const rows = types.map((t) => {
      const q = quotas.find((q) => q.typeCode === t.code);
      const allocated = q?.allocated || 0;
      const carryForward = q?.carryForward || 0;
      const used = Number(usedMap.get(t.code) || 0);
      const balance = t.countable ? Math.max(allocated + carryForward - used, 0) : null;
      const count = !t.countable ? Number(specialMap.get(t.code) || 0) : null;
      return {
        typeCode: t.code,
        typeName: t.name,
        color: t.color,
        countable: t.countable,
        allocated,
        carryForward,
        used,
        balance,
        count,
      };
    });

    return NextResponse.json({ year, employeeId, rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: e.message || "Server error" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await dbConnect();
    const body = await req.json();
    const { employeeId, year, rows } = body || {};
    if (!employeeId || !mongoose.isValidObjectId(employeeId)) {
      return NextResponse.json({ message: "invalid employeeId" }, { status: 400 });
    }

    await Promise.all(
      (rows || [])
        .filter((r) => r.countable) // อัพเดตเฉพาะประเภทที่หักโควตา
        .map((r) =>
          LeaveQuota.updateOne(
            { employeeId, year, typeCode: r.typeCode },
            {
              $set: {
                allocated: Number(r.allocated || 0),
                carryForward: Number(r.carryForward || 0),
              },
            },
            { upsert: true }
          )
        )
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: e.message || "Server error" }, { status: 500 });
  }
}
