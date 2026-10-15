import { NextResponse } from "next/server";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import LeaveRequest from "@/models/LeaveRequest";

/** หา employee ของผู้ล็อกอิน (อิงแนวเดียวกับ page.jsx ที่คุณใช้) */
async function resolveEmployeeFromSession(session) {
  const me = session?.user || session || {};

  const candidateIds = [me.employeeId, me._id, me.id, session?.employeeId].filter(Boolean);
  const userLinkIds  = [me.userId, me.user, session?.userId].filter(Boolean);
  const emails       = [me.email, session?.user?.email, me.workEmail, me.personalEmail].filter(Boolean);

  const or = [];
  for (const v of candidateIds) or.push({ _id: v });
  for (const v of userLinkIds) { or.push({ userId: v }); or.push({ user: v }); }
  for (const v of emails) { or.push({ workEmail: v }); or.push({ personalEmail: v }); }

  if (or.length === 0) return null;
  const emp = await Employee.findOne({ $or: or }).lean();
  return emp || null;
}

export async function GET(req) {
  const gate = await requireAnyPageApi(["self_leave_request", "self_leave_history"]);
  if (gate.res) return gate.res;
  const { session } = gate;

  await dbConnect();

  const emp = await resolveEmployeeFromSession(session);
  if (!emp?._id) return NextResponse.json({ items: [] });

  const url = new URL(req.url);
  const statusQ = (url.searchParams.get("status") || "pending").toLowerCase();
  const year = Number(url.searchParams.get("year")) || null;

  // map สถานะให้อ่านง่าย
  const pendingSet = ["pending", "pending_hod", "pending_hr"];
  const historySet = ["history"]; // จะ map เป็น approved|rejected ด้านล่าง

  const match = { employeeId: emp._id };

  if (pendingSet.includes(statusQ)) {
    match.status = { $in: ["pending_hod", "pending_hr", "pending"] };
  } else if (historySet.includes(statusQ)) {
    match.status = { $in: ["approved", "rejected"] };
  } else if (statusQ !== "all") {
    match.status = statusQ; // กรณีระบุสถานะตรง ๆ
  }

  if (year) {
    // จำกัดปีแบบง่าย: อยู่ภายในปีที่ขอ
    match.startDate = { $gte: new Date(`${year}-01-01T00:00:00.000Z`) };
    match.endDate   = { $lte: new Date(`${year}-12-31T23:59:59.999Z`) };
  }

  // เลือกฟิลด์เท่าที่ UI ใช้
  const items = await LeaveRequest.find(match, {
    typeCode: 1,
    startDate: 1,
    endDate: 1,
    durationDays: 1,
    status: 1,
    createdAt: 1,
    employeeId: 1,   // เผื่อ client อยากกรองซ้ำ
  })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ items });
}
