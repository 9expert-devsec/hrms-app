// src/app/api/leave/requests/bulk/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireSuperadminApi } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import LeaveRequest from "@/models/LeaveRequest";
import LeaveType from "@/models/LeaveType";
import mongoose from "mongoose";

async function hodDeptIds(session) {
  if (!session.user?.employeeId) return [];
  const hods = await Department.find({ headOfDepartment: session.user.employeeId }).select("_id").lean();
  return hods.map(d => d._id.toString());
}

export async function POST(req) {
  try {
    // Legacy LeaveRequest flow with no caller: superadmin only.
    const gate = await requireSuperadminApi();
    if (gate.res) return gate.res;
    const { session } = gate;

    await dbConnect();

    const body = await req.json();
    const action = body?.action; // approve | reject
    const remark = String(body?.remark || "");
    const ids = (body?.ids || []).filter(id => mongoose.isValidObjectId(id));

    if (!ids.length) return NextResponse.json({ message:"No ids" }, { status:400 });
    if (!["approve","reject"].includes(action)) {
      return NextResponse.json({ message:"Invalid action" }, { status:400 });
    }

    const docs = await LeaveRequest.find({ _id: { $in: ids }, status: "pending" }).lean();
    if (!docs.length) return NextResponse.json({ message:"No pending requests" }, { status:400 });

    const allEmpIds = [...new Set(docs.map(d=>d.employeeId.toString()))];
    const employees = await Employee.find({ _id: { $in: allEmpIds } })
      .select("_id departmentId")
      .lean();

    const empMap = new Map(employees.map(e => [e._id.toString(), e]));
    const canAll = canAccess(session.user, "scope_leave_hr_step");
    const hodIds = canAll ? [] : await hodDeptIds(session);

    // ตรวจสิทธิ์รายใบ
    const okIds = [];
    for (const d of docs) {
      if (canAll) { okIds.push(d._id); continue; }
      const e = empMap.get(d.employeeId.toString());
      if (e?.departmentId && hodIds.includes(e.departmentId.toString())) {
        okIds.push(d._id);
      }
    }

    if (!okIds.length) return NextResponse.json({ message:"Forbidden" }, { status:403 });

    await LeaveRequest.updateMany(
      { _id: { $in: okIds } },
      { $set: {
          status: action==="approve" ? "approved":"rejected",
          approverRemark: remark,
          approvedAt: new Date()
        }
      }
    );

    return NextResponse.json({ ok:true, updated: okIds.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: e.message || "Server error" }, { status:500 });
  }
}
