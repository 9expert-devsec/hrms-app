// src/app/api/leave/requests/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
// ถ้าทีมคุณมี requireSessionApi แยกสำหรับ API ให้เปลี่ยนเป็น requireSessionApi ได้
import { requirePageApi } from "@/lib/rbac/guard";
import { employeeOfUser } from "@/lib/rbac/scopeQueries";
import Department from "@/models/Department";
import LeaveRequest from "@/models/LeaveRequest";

/* ---------------- helpers ---------------- */
// The linked employee only (lib/accountLinks.js).
const resolveEmployee = (session) => employeeOfUser(session?.user?.id);

// set เวลาเป็น 00:00 ของวันนั้น (เพื่อเทียบซ้ำให้ชัวร์)
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// รวมวันปลายทางด้วย
function countDaysInclusive(start, end) {
  const s = startOfDay(start);
  const e = startOfDay(end);
  const diff = Math.round((e - s) / 86400000) + 1;
  return Math.max(1, diff);
}

/* ---------------- handler ---------------- */
export async function POST(req) {
  try {
    const gate = await requirePageApi("self_leave_request");
    if (gate.res) return gate.res;
    const me = gate.session;

    await dbConnect();

    // ---- แยกอ่าน payload ตาม Content-Type ----
    const ct = req.headers.get("content-type") || "";
    let payload = {};
    let files = [];

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const raw = form.get("payload");
      try {
        payload = raw ? JSON.parse(String(raw)) : {};
      } catch {
        return NextResponse.json({ ok: false, message: "Invalid payload JSON" }, { status: 400 });
      }
      files = form.getAll("files") || [];
    } else {
      payload = await req.json().catch(() => ({}));
    }

    const {
      typeCode,
      reason = "",
      notes = "",            // ✅ รับ notes
      startDate,
      endDate,
      signatureDataUrl,
    } = payload || {};

    if (!typeCode || !startDate || !endDate) {
      return NextResponse.json(
        { ok: false, message: "typeCode, startDate, endDate are required" },
        { status: 400 }
      );
    }

    const emp = await resolveEmployee(me);
    if (!emp?._id) {
      return NextResponse.json({ ok: false, message: "Employee not found" }, { status: 404 });
    }

    // หา HoD จากแผนก (รองรับหลายชื่อฟิลด์ที่ทีมอาจใช้)
    let hodEmployeeId = null;
    if (emp.departmentId) {
      const dept = await Department.findById(emp.departmentId)
        .select("headEmployeeId managerEmployeeId headOfDepartment")
        .lean();
      hodEmployeeId =
        dept?.headEmployeeId ||
        dept?.managerEmployeeId ||
        dept?.headOfDepartment ||
        null;
    }

    // ทำความสะอาด metadata ของไฟล์แนบ (อัปโหลดจริงค่อยต่อยอด)
    const attachments = [];
    for (const f of files) {
      if (f && typeof f === "object") {
        attachments.push({
          name: f.name || "",
          size: Number(f.size || 0),
          mime: f.type || "",
          url: "", // ไว้ค่อยใส่เมื่ออัปโหลดขึ้น Cloudinary/OSS
        });
      }
    }

    // normalize วัน + คำนวณจำนวนวัน
    const sDay = startOfDay(startDate);
    const eDay = startOfDay(endDate);
    const durationDays = countDaysInclusive(sDay, eDay);

    /* ---------- กันส่งซ้ำ (server-side) ---------- 
       ถ้ามีคำขอชุดเดียวกันที่พึ่งสร้างในช่วงไม่กี่นาที ให้รีเทิร์นตัวเดิม */
    const recent = new Date(Date.now() - 5 * 60 * 1000); // 5 นาทีที่ผ่านมา
    const dup = await LeaveRequest.findOne({
      employeeId: emp._id,
      typeCode,
      startDate: sDay,
      endDate: eDay,
      createdAt: { $gt: recent },
      status: { $in: ["pending_hod", "pending_hr"] },
    })
      .select("_id")
      .lean();

    if (dup) {
      return NextResponse.json({ ok: true, _id: dup._id, duplicate: true });
    }

    // สร้างเอกสาร
    const doc = await LeaveRequest.create({
      employeeId: emp._id,
      typeCode,
      reason: String(reason || "").trim(),
      notes: String(notes || "").trim(),         // ✅ เซฟ notes
      startDate: sDay,
      endDate: eDay,
      durationDays,
      attachments,
      status: "pending_hod",
      flow: { hodEmployeeId: hodEmployeeId || undefined },
      signatures: [
        {
          who: "employee",
          name: [emp.firstName, emp.lastName].filter(Boolean).join(" ") || undefined,
          title: emp.position || undefined,
          at: new Date(),
          dataUrl: signatureDataUrl || undefined,
        },
      ],
      docHtml: "", // ตอนนี้ยังไม่ snapshot; route /doc จะเรนเดอร์สด
    });

    return NextResponse.json({ ok: true, _id: doc._id });
  } catch (e) {
    console.error("[/api/leave/requests][POST] error:", e);
    const msg =
      e?.message?.includes("JSON") && e?.message?.includes("Unexpected")
        ? "Invalid request payload"
        : e?.message || "failed";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
