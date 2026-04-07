export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import dbConnect from "@/lib/mongoose";
import mongoose from "mongoose";
import LeaveRequest from "@/models/LeaveRequest";
import Employee from "@/models/Employee";

const O = (v) => (v ? new mongoose.Types.ObjectId(String(v)) : null);

/* resolve employee ของผู้ล็อกอิน */
async function resolveEmployeeFromSession(session) {
  const me = session?.user || session || {};
  const candidateIds = [me.employeeId, me._id, me.id, session?.employeeId].filter(Boolean);
  const userLinkIds  = [me.userId, me.user, session?.userId].filter(Boolean);
  const emails       = [me.email, session?.user?.email, me.workEmail, me.personalEmail].filter(Boolean);

  const or = [];
  candidateIds.forEach(v => or.push({ _id: v }));
  userLinkIds.forEach(v => { or.push({ userId: v }); or.push({ user: v }); });
  emails.forEach(v => { or.push({ workEmail: v }); or.push({ personalEmail: v }); });

  if (!or.length) return null;
  return await Employee.findOne({ $or: or }).lean();
}

/* ตรวจบทบาท HR แบบกันพลาด */
function detectIsHR(session, employee) {
  const rolesRaw = session?.user?.roles ?? session?.user?.role ?? [];
  const rolesArr = Array.isArray(rolesRaw) ? rolesRaw : (rolesRaw ? [rolesRaw] : []);
  const roles = rolesArr.map(r => String(r).toLowerCase());

  if (roles.some(r => r === "hr" || (r.includes("human") && r.includes("resource")))) return true;

  const deptName = String(employee?.departmentName || employee?.department || "").toLowerCase();
  const pos = String(employee?.position || "").toLowerCase();
  return deptName.includes("hr") || pos.includes("hr");
}

export async function GET(req) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const actor = await resolveEmployeeFromSession(session);
  if (!actor?._id) return NextResponse.json({ items: [] });

  const url = new URL(req.url);
  const statusQ = (url.searchParams.get("status") || "pending").toLowerCase();
  const isHR = detectIsHR(session, actor);

  // สถานะตามบทบาท
  let statuses;
  if (statusQ === "pending") {
    statuses = isHR ? ["pending_hr"] : ["pending_hod"];
  } else if (statusQ === "approved") {
    statuses = ["approved"];
  } else if (statusQ === "rejected") {
    statuses = ["rejected"];
  } else if (statusQ === "all") {
    statuses = isHR ? ["pending_hr","approved","rejected"] : ["pending_hod","approved","rejected"];
  } else {
    statuses = [statusQ];
  }

  const actorId = O(actor._id);
  const actorDeptId = O(actor.departmentId);

  // ---------- pipeline ----------
  const pipeline = [
    { $match: { status: { $in: statuses } } },
    {
      $lookup: {
        from: "employees",
        localField: "employeeId",
        foreignField: "_id",
        as: "emp",
      },
    },
    { $unwind: "$emp" },
  ];

  if (!isHR) {
    // เงื่อนไขสำหรับ HoD ให้ครอบคลุมหลายรูปแบบ
    const orConds = [];

    // (1) แผนกเดียวกัน
    if (actorDeptId) orConds.push({ "emp.departmentId": actorDeptId });

    // (2) โยงหัวหน้าจากฟิลด์ของ employee เอง (ถ้ามี)
    ["managerId","reportsTo","supervisorId","hodId","manager"].forEach(f => {
      orConds.push({ [`emp.${f}`]: actorId });
    });

    // (3) โยงหัวหน้าจากเอกสาร department — รวมฟิลด์จริงของคุณ: headOfDepartment
    pipeline.push(
      {
        $lookup: {
          from: "departments",
          localField: "emp.departmentId",
          foreignField: "_id",
          as: "dept",
        },
      },
      { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } }
    );

    // ✅ เพิ่ม "headOfDepartment" จากสคีมาของคุณ
    ["headOfDepartment","hodId","headId","managerId","leadId","supervisorId"].forEach(f => {
      orConds.push({ [`dept.${f}`]: actorId });
    });

    pipeline.push({ $match: { $or: orConds } });
  }

  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({
    $project: {
      _id: 1,
      typeCode: 1,
      startDate: 1,
      endDate: 1,
      durationDays: 1,
      status: 1,
      createdAt: 1,
      employee: {
        _id: "$emp._id",
        firstName: "$emp.firstName",
        lastName: "$emp.lastName",
        position: "$emp.position",
        departmentId: "$emp.departmentId",
      },
    },
  });

  const items = await LeaveRequest.aggregate(pipeline);
  return NextResponse.json({ items });
}
