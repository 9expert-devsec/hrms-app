import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import LeaveRequest from "@/models/LeaveRequest";
import mongoose from "mongoose";

async function canApproveHOD(session, employee) {
  const role = session.user?.role || "employee";
  if (["superadmin","hr"].includes(role)) return false; // HR ไม่ใช่ HOD-phase
  if (!session.user?.employeeId) return false;
  const dep = await Department.findOne({ headOfDepartment: session.user.employeeId }).select("_id").lean();
  if (!dep) return false;
  return employee?.departmentId?.toString() === dep._id.toString();
}
function injectSign(html, label, name) {
  // ฉลากช่อง: "หัวหน้าแผนก (อนุมัติ)" หรือ "HR (อนุมัติ)" → เติมบรรทัดชื่อ/เวลา
  const stamp = `<div style="margin-top:4px;color:#334155;font-size:12px">ลงชื่อ: ${name} • ${new Date().toLocaleString()}</div>`;
  const rx = new RegExp(`(<div class="label">${label}<\\/div>[\\s\\S]*?<\\/div>)`,"i");
  return html.replace(rx, (m) => m.replace(/<\/div>\s*$/, `${stamp}</div>`));
}

export async function PATCH(req, { params }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message:"Unauthorized" }, { status:401 });

    const id = params.id;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ message:"Invalid id" }, { status:400 });
    const body = await req.json();
    const action = body?.action; // approve | reject
    const remark = String(body?.remark || "");

    const doc = await LeaveRequest.findById(id).lean();
    if (!doc) return NextResponse.json({ message:"Not found" }, { status:404 });
    if (!["pending_hod","pending_hr"].includes(doc.status)) {
      return NextResponse.json({ message:"Not in approvable state" }, { status:400 });
    }

    const emp = await Employee.findById(doc.employeeId).lean();
    const isHR = ["superadmin","hr"].includes(session.user?.role || "employee");

    // Phase ตรวจสิทธิ์
    if (doc.status === "pending_hod") {
      // ต้องเป็น HOD ของแผนกพนักงาน
      const ok = await canApproveHOD(session, emp);
      if (!ok) return NextResponse.json({ message:"Forbidden (HOD only)" }, { status:403 });

      if (action === "approve") {
        // เปลี่ยนเป็น pending_hr และ stamp ชื่อ HOD ลงเอกสาร
        const name = [session.user?.firstName, session.user?.lastName].filter(Boolean).join(" ") || "Head of Department";
        const newHtml = injectSign(doc.docHtml || "", "หัวหน้าแผนก (อนุมัติ)", name);
        await LeaveRequest.findByIdAndUpdate(id, {
          $set: { status: "pending_hr", docHtml: newHtml },
          $push: { signatures: { who:"hod", name, at:new Date() } }
        });
      } else {
        await LeaveRequest.findByIdAndUpdate(id, {
          $set: { status: "rejected", approverRemark: remark, approvedAt: new Date() }
        });
      }
    } else if (doc.status === "pending_hr") {
      // ต้องเป็น HR
      if (!isHR) return NextResponse.json({ message:"Forbidden (HR only)" }, { status:403 });

      if (action === "approve") {
        const name = session.user?.email || "HR";
        const newHtml = injectSign(doc.docHtml || "", "HR (อนุมัติ)", name);
        await LeaveRequest.findByIdAndUpdate(id, {
          $set: { status: "approved", docHtml: newHtml, approverRemark: remark, approvedAt: new Date() },
          $push: { signatures: { who:"hr", name, at:new Date() } }
        });
      } else {
        await LeaveRequest.findByIdAndUpdate(id, {
          $set: { status: "rejected", approverRemark: remark, approvedAt: new Date() }
        });
      }
    }

    return NextResponse.json({ ok:true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: e.message || "Server error" }, { status:500 });
  }
}
