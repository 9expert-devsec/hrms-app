export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import LeaveRequest from "@/models/LeaveRequest";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import { canSeeLeaveDocument } from "@/lib/rbac/leaveScope";
import { employeeDisplayName, employeeFullNameTh } from "@/lib/employeeName";

// ---------- helpers ----------
const safe = (v, d = "-") =>
  v === null || v === undefined || v === "" ? d : v;

function fmtDate(d) {
  try {
    if (!d) return "-";
    const z = new Date(d);
    if (isNaN(z.getTime())) return "-";
    return z.toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

function findSig(arr = [], key) {
  // รองรับชื่อ who ได้หลายแบบ เช่น employee/requester, hod/head, hr
  const k = String(key || "").toLowerCase();
  return (
    arr.find((s) => new RegExp(`\\b${k}\\b`, "i").test(s?.who || "")) ||
    (k === "employee" || k === "requester"
      ? arr.find((s) => !/hod|head|hr/i.test(s?.who || ""))
      : null)
  );
}

function sigBox(title, sig) {
  const img = sig?.dataUrl
    ? `<img src="${sig.dataUrl}" style="max-height:80px;max-width:100%;object-fit:contain;" />`
    : "—";
  const by = sig?.byName || sig?.by || "";
  const at = fmtDate(sig?.at);
  return `
  <td style="width:33%;vertical-align:top;padding:12px;border:1px solid #e5e7eb;border-radius:8px;">
    <div style="font-weight:600;margin-bottom:8px;">${title}</div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;height:110px;display:flex;align-items:center;justify-content:center;">
      ${img}
    </div>
    <div style="color:#6b7280;font-size:12px;margin-top:6px;">${safe(by)}</div>
    <div style="color:#6b7280;font-size:12px;">${
      at !== "-" ? `ลงวันที่ ${at}` : "—"
    }</div>
  </td>`;
}

// ---------- route ----------
export async function GET(req, ctx) {
  try {
    const gate = await requireAnyPageApi(["self_leave_document", "self_leave_request", "leave_approve"]);
    if (gate.res) return gate.res;

    await dbConnect();

    // รองรับ Next 13/14: params บางเวอร์ชันเป็น promise
    const { id } = (await ctx?.params) || ctx?.params || {};
    if (!id) {
      return NextResponse.json({ message: "Missing id" }, { status: 400 });
    }

    const doc = await LeaveRequest.findById(id).lean();
    if (!doc) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    // ดึงข้อมูลพนักงาน + แผนก (กัน field ว่าง)
    const emp =
      (doc.employeeId && (await Employee.findById(doc.employeeId).lean())) ||
      {};

    // Signed leave document: owner, a head of the owner's department, the
    // leave scopes, superadmin. Anyone else gets the same 404 as a bad id.
    if (!(await canSeeLeaveDocument(gate.session, { employee: emp }))) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    const dept =
      (emp?.departmentId &&
        (await Department.findById(emp.departmentId).lean())) ||
      {};

    // เซ็นแต่ละขั้น
    const sigs = Array.isArray(doc.signatures) ? doc.signatures : [];
    const sigEmployee = findSig(sigs, "employee") || findSig(sigs, "requester");
    const sigHoD = findSig(sigs, "hod") || findSig(sigs, "head");
    const sigHR = findSig(sigs, "hr");

    const statusLabel =
      doc.status === "approved"
        ? `<span style="background:#10b98122;color:#059669;padding:2px 8px;border-radius:9999px;">Approved</span>`
        : doc.status === "rejected"
        ? `<span style="background:#ef444422;color:#dc2626;padding:2px 8px;border-radius:9999px;">Rejected</span>`
        : `<span style="background:#f59e0b22;color:#b45309;padding:2px 8px;border-radius:9999px;">${safe(
            doc.status
          )}</span>`;

    const rows = [
      [
        "พนักงาน",
        // Formal document: Thai name with title when complete.
        employeeFullNameTh(emp) || employeeDisplayName(emp) || "-",
      ],
      ["ประเภทลา", safe(doc.typeCode)],
      ["ตำแหน่ง", safe(emp.position)],
      ["แผนก", safe(dept.name)],
      ["ช่วงวันลา", `${fmtDate(doc.startDate)} – ${fmtDate(doc.endDate)}`],
      ["จำนวนวัน", safe(doc.durationDays, 0)],
      ["เหตุผล", safe(doc.reason)],
      ["บันทึกเพิ่มเติม", safe(doc.notes)],
      ["สถานะ", statusLabel],
      ["สร้างเมื่อ", fmtDate(doc.createdAt)],
      ["แก้ไขล่าสุด", fmtDate(doc.updatedAt)],
    ];

    const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>HRMS • Leave Request</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Thai", "Noto Sans", "Helvetica Neue", Arial, "Sukhumvit Set", "Tahoma", sans-serif; background:#f8fafc; color:#0f172a; padding:24px; }
    .card { max-width:880px; margin:0 auto; background:#fff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden; }
    .head { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid #e5e7eb; }
    .brand { display:flex; align-items:center; gap:10px; }
    .brand b { font-weight:700; }
    table.meta { width:100%; border-collapse:collapse; }
    table.meta tr td { padding:10px 14px; border-top:1px solid #f1f5f9; vertical-align:top; }
    table.meta tr td:first-child { width:180px; color:#475569; }
    .sec { padding:18px 20px; }
    .sig-wrap { width:100%; border-collapse:separate; border-spacing:12px; }
    @media (prefers-color-scheme: dark) {
      body { background:#0b1220; color:#e5e7eb; }
      .card { background:#0f172a; border-color:#334155; }
      .head { border-color:#334155; }
      table.meta tr td { border-color:#1f2937; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="head">
      <div class="brand">
        <img src="/brand/logo-blue-ink.png" width="73" height="24" alt="9Expert" style="height:24px;width:auto;" />
        <b>HRMS • Leave Request</b>
      </div>
      <div style="color:#64748b;font-size:12px;">เลขที่คำขอ: ${String(
        doc._id
      )}</div>
    </div>

    <div class="sec">
      <table class="meta">
        ${rows
          .map(
            ([k, v]) => `<tr>
              <td>${k}</td>
              <td>${typeof v === "string" ? v : v}</td>
            </tr>`
          )
          .join("")}
      </table>
    </div>

    <div class="sec">
      <div style="font-weight:600;margin-bottom:8px;">สำหรับการอนุมัติ</div>
      <table class="sig-wrap">
        <tr>
          ${sigBox(
            "ผู้ยื่นคำขอ",
            sigEmployee && {
              dataUrl: sigEmployee.signatureDataUrl || sigEmployee.dataUrl,
              byName:
                sigEmployee.byName ||
                employeeFullNameTh(emp) ||
                employeeDisplayName(emp),
              at: sigEmployee.signedAt || sigEmployee.at,
            }
          )}
          ${sigBox(
            "หัวหน้า (HoD)",
            sigHoD && {
              dataUrl: sigHoD.signatureDataUrl || sigHoD.dataUrl,
              byName: sigHoD.byName || sigHoD.by || "-",
              at: sigHoD.signedAt || sigHoD.at,
            }
          )}
          ${sigBox(
            "HR",
            sigHR && {
              dataUrl: sigHR.signatureDataUrl || sigHR.dataUrl,
              byName: sigHR.byName || sigHR.by || "-",
              at: sigHR.signedAt || sigHR.at,
            }
          )}
        </tr>
      </table>
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (e) {
    // แสดง error อ่านง่าย ๆ กันหน้าโล่ง
    const html = `<!doctype html><meta charset="utf-8"><pre style="padding:20px;color:#b91c1c;background:#fff5f5;border:1px solid #fecaca;border-radius:12px;font:14px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${
      (e && (e.stack || e.message)) || e
    }</pre>`;
    return new Response(html, {
      status: 500,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
