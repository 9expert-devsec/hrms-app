export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireSuperadminApi } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import dbConnect from "@/lib/mongoose";
import mongoose from "mongoose";
import LeaveRequest from "@/models/LeaveRequest";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";

const O = (v) => (v ? new mongoose.Types.ObjectId(String(v)) : null);

/* resolve employee ของผู้ล็อกอิน — the linked employee only (lib/accountLinks.js) */
const resolveEmployeeFromSession = (session) => getOwnEmployee(session, null);

/* HR = the HR leave step in the RBAC registry. (This used to read
   session.user.roles, which is never set, and fell back to any department
   or position containing "hr".) */
function detectIsHR(session) {
  return canAccess(session?.user, "scope_leave_hr_step");
}

export async function GET(req) {
  // Orphan page (/dashboard/leave/approval): superadmin only.
  const gate = await requireSuperadminApi();
  if (gate.res) return gate.res;
  const { session } = gate;

  await dbConnect();

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
        firstNameTh: "$emp.firstNameTh",
        lastNameTh: "$emp.lastNameTh",
        position: "$emp.position",
        departmentId: "$emp.departmentId",
      },
    },
  });

  const items = await LeaveRequest.aggregate(pipeline);
  return NextResponse.json({ items });
}
