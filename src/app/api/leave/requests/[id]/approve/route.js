export const dynamic = "force-dynamic";

import dbConnect from "@/lib/mongoose";
import LeaveRequest from "@/models/LeaveRequest";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import { NextResponse } from "next/server";
import { requireSuperadminApi } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import { resolveActorEmployee, isHODForEmployee } from "@/lib/approvals/authz";
import { employeeDisplayName, employeeFullNameTh } from "@/lib/employeeName";

// สร้าง/แทนที่ signature ของ role ที่กำหนด
function upsertSignature(arr = [], sig) {
  const i = arr.findIndex((x) => x.role === sig.role);
  if (i >= 0) arr[i] = { ...arr[i], ...sig };
  else arr.push(sig);
  return arr;
}

// เรนเดอร์เอกสาร (HTML) จากเอกสาร leave request ปัจจุบัน
function renderLeaveDoc(doc) {
  const sig = (role) => (doc.signatures || []).find((s) => s.role === role);
  const sigImg = (role) => {
    const s = sig(role);
    return s?.dataUrl
      ? `<img src="${s.dataUrl}" style="height:60px;">`
      : `<span style="color:#999">–</span>`;
    // ถ้าต้องการตัดคำ Base64 ยาวๆ ออก ให้ย่อ HTML ตามใจชอบได้
  };
  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "-");
  const pill = (st) => {
    const map = {
      approved: "#10b981",
      pending_hod: "#f59e0b",
      pending_hr: "#fbbc05",
      rejected: "#ef4444",
    };
    const bg = map[st] || "#64748b";
    return `<span style="background:${bg};color:white;padding:2px 8px;border-radius:9999px;font-size:12px;">${
      st || "-"
    }</span>`;
  };

  const emp = doc.employee || {};
  const hov = doc.hod || {};
  const hr = doc.hr || {};
  // Formal document: Thai name with title when complete (lib/employeeName.js).
  const formal = (e) => employeeFullNameTh(e) || employeeDisplayName(e) || "-";
  const hodName = formal(hov);
  const hrName = formal(hr);
  const empName = formal(emp);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Leave Request</title>
  <style>
    body{font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#0f172a;}
    .card{max-width:820px;margin:20px auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;}
    .head{padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
    .logo{font-weight:700;color:#1f2937}
    table{width:100%;border-collapse:collapse}
    th,td{border-bottom:1px solid #e5e7eb;padding:10px 14px;text-align:left;font-size:14px}
    .sec{padding:16px 20px}
    .sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .sign-box{border:1px dashed #cbd5e1;border-radius:10px;padding:12px;min-height:140px}
    .muted{color:#64748b;font-size:12px}
    .btnbar{display:flex;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid #e5e7eb}
    @media print {.btnbar{display:none}}
  </style>
</head>
<body>
  <div class="card">
    <div class="head">
      <div class="logo">9EXPERT • HRMS • Leave Request</div>
      <div class="muted">เลขที่เอกสาร: ${doc._id}</div>
    </div>

    <div class="sec">
      <table>
        <tr><th>พนักงาน</th><td>${empName}</td></tr>
        <tr><th>ประเภทลา</th><td>${doc.typeCode || "-"}</td></tr>
        <tr><th>ตำแหน่ง</th><td>${emp.position || "-"}</td></tr>
        <tr><th>แผนก</th><td>${
          doc.departmentName || doc.departmentCode || "-"
        }</td></tr>
        <tr><th>ช่วงวันลา</th><td>${fmt(doc.startDate)} – ${fmt(
    doc.endDate
  )}</td></tr>
        <tr><th>จำนวนวัน</th><td>${doc.durationDays || 0}</td></tr>
        <tr><th>เหตุผล</th><td>${doc.reason || "-"}</td></tr>
        <tr><th>บันทึกเพิ่มเติม</th><td>${doc.notes || "-"}</td></tr>
        <tr><th>สถานะ</th><td>${pill(doc.status)}</td></tr>
        <tr><th>สร้างเมื่อ</th><td>${fmt(doc.createdAt)}</td></tr>
        <tr><th>แก้ไขล่าสุด</th><td>${fmt(doc.updatedAt)}</td></tr>
      </table>
    </div>

    <div class="sec">
      <div class="muted" style="margin-bottom:8px;">สำหรับการอนุมัติ</div>
      <div class="sign-grid">
        <div class="sign-box">
          <div class="muted">หัวหน้า (HoD) — ${hodName}</div>
          <div style="margin:8px 0 12px 0">${sigImg("hod")}</div>
          <div class="muted">วันที่: ${fmt(sig("hod")?.when)}</div>
        </div>
        <div class="sign-box">
          <div class="muted">HR — ${hrName}</div>
          <div style="margin:8px 0 12px 0">${sigImg("hr")}</div>
          <div class="muted">วันที่: ${fmt(sig("hr")?.when)}</div>
        </div>
      </div>
      <div class="sign-box" style="margin-top:12px">
        <div class="muted">ผู้ยื่นคำขอ — ${empName}</div>
        <div style="margin:8px 0 12px 0">${sigImg("employee")}</div>
        <div class="muted">วันที่: ${fmt(sig("employee")?.when)}</div>
      </div>
    </div>

    <div class="btnbar">
      <a href="?format=pdf" style="text-decoration:none;background:#111827;color:white;padding:8px 12px;border-radius:8px;">พิมพ์/บันทึก PDF</a>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req, ctx) {
  // Orphan page (/dashboard/leave/approval): superadmin only. Before this,
  // the handler referenced helpers it never imported and always threw.
  const gate = await requireSuperadminApi();
  if (gate.res) return gate.res;

  await dbConnect();

  // รองรับ next 13/14 (params อาจเป็น promise)
  const { id } = (await ctx?.params) || ctx?.params || {};
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  const session = gate.session;
  const actorEmp = await resolveActorEmployee(session);
  if (!actorEmp) {
    return NextResponse.json(
      { message: "No employee bound to user" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({})); // { dataUrl, note, saveAsMySignature }
  const doc = await LeaveRequest.findById(id);
  if (!doc) return NextResponse.json({ message: "Not found" }, { status: 404 });

  // อนุมัติทีละชั้น
  if (doc.status?.startsWith("pending_hod")) {
    const ok = await isHODForEmployee(actorEmp._id, doc.employeeId);
    if (!ok)
      return NextResponse.json(
        { message: "Only HoD can approve at this step." },
        { status: 403 }
      );

    doc.signatures = upsertSignature(doc.signatures, {
      role: "hod",
      who: actorEmp._id,
      when: new Date(),
      image: body?.dataUrl || null,
    });
    doc.status = "pending_hr";
  } else if (doc.status === "pending_hr") {
    if (!canAccess(session.user, "scope_leave_hr_step")) {
      return NextResponse.json(
        { message: "Only HR can approve at this step." },
        { status: 403 }
      );
    }
    doc.signatures = upsertSignature(doc.signatures, {
      role: "hr",
      who: actorEmp._id,
      when: new Date(),
      image: body?.dataUrl || null,
    });
    doc.status = "approved";
  } else {
    return NextResponse.json({ message: "Invalid state" }, { status: 400 });
  }

  await doc.save();
  return NextResponse.json({ ok: true });
}
