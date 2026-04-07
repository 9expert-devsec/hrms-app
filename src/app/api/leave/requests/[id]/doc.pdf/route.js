// src/app/api/leave/requests/[id]/doc.pdf/route.js
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireSessionPage as requireSession } from "@/lib/authz";
import LeaveRequest from "@/models/LeaveRequest";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import { v2 as cloudinary } from "cloudinary"; // ถ้ามีไฟล์ config ของคุณอยู่แล้วก็ใช้ของนั้น

import { Readable } from "node:stream";
import { Buffer } from "node:buffer";

function buildDocHtml(payload) {
  const fmt = (d) =>
    d
      ? new Date(d).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "2-digit",
        })
      : "-";

  const sigEmp = reqDoc?.signatures?.find((s) => s.who === "employee");
  const days = Number(reqDoc?.durationDays || 0);

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>Leave Request ${reqDoc._id}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Thai", "Noto Sans", "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji"; color:#111; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px; }
  .title { font-size:22px; font-weight:700; }
  .meta { color:#444; font-size:12px; }
  table { border-collapse:collapse; width:100%; }
  th, td { border:1px solid #ddd; padding:8px 10px; font-size:13px; vertical-align:top; }
  th { background:#f5f5f5; text-align:left; }
  .mt-3{ margin-top:12px; } .mt-5{ margin-top:20px; } .center{text-align:center;}
  .small{font-size:12px; color:#555;}
  .grid2{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
  .sign { height: 64px; }
  .sigbox{ height:80px; border:1px dashed #bbb; display:flex; align-items:center; justify-content:center; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <div class="title">แบบคำขอลา (Leave Request)</div>
      <div class="meta">เลขที่เอกสาร: ${reqDoc._id}</div>
    </div>
    <div class="meta">
      สร้างเมื่อ: ${fmt(reqDoc.createdAt)}<br/>
      พิมพ์เมื่อ: ${fmt(new Date())}
    </div>
  </div>

  <div class="grid2 mt-3">
    <div>
      <table>
        <tr><th>พนักงาน</th><td>${
          [emp?.firstName, emp?.lastName].filter(Boolean).join(" ") || "-"
        }</td></tr>
        <tr><th>ตำแหน่ง</th><td>${emp?.position || "-"}</td></tr>
        <tr><th>แผนก</th><td>${dept?.name || emp?.department || "-"}</td></tr>
      </table>
    </div>
    <div>
      <table>
        <tr><th>ประเภทวันลา</th><td>${reqDoc.typeCode || "-"}</td></tr>
        <tr><th>ช่วงวันลา</th><td>${fmt(reqDoc.startDate)} – ${fmt(
    reqDoc.endDate
  )}</td></tr>
        <tr><th>จำนวนวัน</th><td>${days}</td></tr>
      </table>
    </div>
  </div>

  <div class="mt-3">
    <table>
      <tr><th style="width:130px">เหตุผล</th><td>${
        reqDoc.reason || "-"
      }</td></tr>
      <tr><th>บันทึกเพิ่มเติม</th><td>${reqDoc.notes || "-"}</td></tr>
      <tr><th>สถานะ</th><td>${reqDoc.status || "-"}</td></tr>
    </table>
  </div>

  <div class="grid2 mt-5">
    <div>
      <div class="small">ผู้ยื่นคำขอ</div>
      <div class="sigbox">
        ${
          sigEmp?.dataUrl
            ? `<img class="sign" src="${sigEmp.dataUrl}" alt="signature" />`
            : `<span class="small">— ไม่มีลายเซ็น —</span>`
        }
      </div>
      <div class="center small">
        ${[emp?.firstName, emp?.lastName].filter(Boolean).join(" ") || "-"}<br/>
        ${emp?.position || "-"}
      </div>
    </div>

    <div>
      <div class="small">สำหรับการอนุมัติ</div>
      <table>
        <tr><th style="width:130px">หัวหน้า (HoD)</th><td>${
          reqDoc?.flow?.hodEmployeeId ? "รอดำเนินการ/อนุมัติ" : "-"
        }</td></tr>
        <tr><th>HR</th><td>—</td></tr>
      </table>
    </div>
  </div>

  <div class="mt-5 small">เอกสารถูกสร้างจากระบบ HRMS • เปิดผ่าน /api/leave/requests/[id]/doc</div>
</body></html>`;
}

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    await requireSession();

    const id = params?.id;
    const reqDoc = await LeaveRequest.findById(id).lean();
    if (!reqDoc)
      return NextResponse.json(
        { ok: false, message: "not found" },
        { status: 404 }
      );

    const emp = await Employee.findById(reqDoc.employeeId).lean();
    const dept = emp?.departmentId
      ? await Department.findById(emp.departmentId).lean()
      : null;
    const html = buildDocHtml({ reqDoc, emp, dept });

    // สร้าง PDF ด้วย puppeteer
    const puppeteer = await import("puppeteer").then((m) => m.default || m); // dynamic import
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    cloudinary.config({ cloud_name: "...", api_key: "...", api_secret: "..." });
    const uploadRes = await new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: "hrms/leave-requests",
          public_id: `${id}`,
          resource_type: "raw",
          format: "pdf",
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      Readable.from(pdfBuffer).pipe(upload);
    });

    // ส่งไฟล์ PDF ให้โหลดทันที (ถ้าจะส่งลิงก์ Cloudinary ให้ redirect ก็ได้)
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="leave-${id}.pdf"`,
      },
    });
  } catch (e) {
    console.error("[GET /api/leave/requests/:id/doc.pdf] error:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "error" },
      { status: 500 }
    );
  }
}
