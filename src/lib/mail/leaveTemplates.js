/**
 * Leave email templates (Thai, short, one button) — same layout as the
 * off-site emails. Pure — no server imports. No signatures, ever.
 *
 * buildLeaveEmail(type, ctx) → { subject, html, text }
 *   ctx = { leave (plain Leave), requesterName, recipientName, url,
 *           hoursPerDay, returnInfo?, approverName? }
 */
import { formatLeaveAmount, leavePeriodText } from "../leave/format.js";
import { STEP_LABELS } from "../leave/flow.js";

export const LEAVE_EMAIL_TYPES = [
  "leave_approval_pending",
  "leave_hr_pending",
  "leave_ack_pending",
  "leave_returned",
  "leave_approved",
];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Per type: subject, intro line(s), button label. */
const COPY = {
  leave_approval_pending: (ctx) => ({
    subject: `มีใบลารออนุมัติ: ${ctx.requesterName}`,
    intro: [
      ctx.leave.revision > 1
        ? `${ctx.requesterName} แก้ไขและส่งใบลาใหม่ กรุณาพิจารณาอนุมัติ`
        : `${ctx.requesterName} ส่งใบลา กรุณาพิจารณาอนุมัติ`,
      "ผู้อนุมัติ (1) หรือ (2) คนใดคนหนึ่งอนุมัติได้ — คนที่ดำเนินการก่อนเป็นผู้ตัดสิน",
    ],
    button: "พิจารณาใบลา",
  }),
  leave_hr_pending: (ctx) => ({
    subject: `มีใบลารอฝ่ายบุคคลอนุมัติ: ${ctx.requesterName}`,
    intro: [
      ctx.leave.autoApproved
        ? `${ctx.requesterName} ส่งใบลา (ไม่มีขั้นผู้อนุมัติ) รอฝ่ายบุคคลลงนามอนุมัติ`
        : `ใบลาของ ${ctx.requesterName} ผ่านการอนุมัติจาก ${ctx.approverName || "ผู้อนุมัติ"} แล้ว รอฝ่ายบุคคลลงนามอนุมัติ`,
    ],
    button: "ตรวจสอบใบลา",
  }),
  leave_ack_pending: (ctx) => ({
    subject: `มีใบลารอรับทราบ: ${ctx.requesterName}`,
    intro: [
      `${ctx.approverName || "ผู้อนุมัติอีกท่าน"} อนุมัติใบลาของ ${ctx.requesterName} แล้ว กรุณากดรับทราบเพื่อลงชื่อในใบลา`,
      "การรับทราบไม่บล็อกฝ่ายบุคคล — กดรับทราบได้แม้ฝ่ายบุคคลอนุมัติไปแล้ว",
    ],
    button: "รับทราบใบลา",
  }),
  leave_returned: () => ({
    subject: "ใบลาของคุณถูกส่งกลับให้แก้ไข",
    intro: ["ใบลาของคุณถูกส่งกลับ กรุณาแก้ไขแล้วส่งใหม่ หรือยกเลิกใบลาถ้าไม่ลาแล้ว"],
    button: "แก้ไขใบลา",
  }),
  leave_approved: () => ({
    subject: "ใบลาได้รับอนุมัติแล้ว",
    intro: [
      "ใบลาของคุณได้รับอนุมัติครบทุกขั้นแล้ว",
      "อย่าลืมบันทึกการลาใน Calendar และ Portal ตามที่ระบุในใบลา",
    ],
    button: "ดูประวัติการลา",
  }),
};

function facts(type, ctx) {
  const l = ctx.leave;
  const rows = [
    ["ผู้ขอลา", ctx.requesterName],
    ["ประเภทการลา", l.leaveTypeName || "-"],
    ["ช่วงวันที่", leavePeriodText(l)],
    ["จำนวน", formatLeaveAmount(l.totalHours, { unit: l.unit, hoursPerDay: ctx.hoursPerDay })],
  ];
  if (type !== "leave_returned" && type !== "leave_approved") rows.push(["เหตุผล", l.reason || "-"]);
  if (type === "leave_returned" && ctx.returnInfo) {
    rows.push(["ส่งกลับโดย", `${ctx.returnInfo.byName || "-"} (${STEP_LABELS[ctx.returnInfo.step] || "ผู้อนุมัติ"})`]);
    rows.push(["เหตุผลที่ส่งกลับ", ctx.returnInfo.reason || "-"]);
  }
  return rows;
}

export function buildLeaveEmail(type, ctx) {
  const copy = COPY[type](ctx);
  const subject = `[HRMS] ${copy.subject}`;
  const rows = facts(type, ctx);
  const rowsHtml = rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5E6A7E;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;color:#0D1B2A">${esc(v)}</td></tr>`)
    .join("");
  const introHtml = copy.intro.map((p) => `<p style="margin:0 0 12px;color:#0D1B2A">${esc(p)}</p>`).join("");

  const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:24px;background:#F8FAFD;font-family:Tahoma,'Leelawadee UI','Noto Sans Thai',Arial,sans-serif;font-size:15px;line-height:1.6">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;color:#2486FF;font-weight:bold">9Expert HRMS · การลา</p>
    <p style="margin:0 0 16px;color:#0D1B2A">เรียน ${esc(ctx.recipientName || "")}</p>
    ${introHtml}
    <table role="presentation" style="border-collapse:collapse;font-size:14px">${rowsHtml}</table>
    <p style="margin:24px 0 8px"><a href="${esc(ctx.url)}" style="display:inline-block;background:#005CFF;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 20px;border-radius:8px">${esc(copy.button)}</a></p>
    <p style="margin:16px 0 0;color:#94A3B8;font-size:12px">อีเมลนี้ส่งอัตโนมัติจากระบบ HRMS กรุณาอย่าตอบกลับ</p>
  </div>
</body></html>`;

  const text = [
    `เรียน ${ctx.recipientName || ""}`,
    "",
    ...copy.intro,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `${copy.button}: ${ctx.url}`,
    "",
    "อีเมลนี้ส่งอัตโนมัติจากระบบ HRMS กรุณาอย่าตอบกลับ",
  ].join("\n");

  return { subject, html, text };
}
