/**
 * Off-site email templates (Thai, short, plain layout, one button). Pure —
 * no server imports. No signatures or allowance amounts, ever.
 *
 * buildOffsiteEmail(type, ctx) → { subject, html, text }
 *   ctx = { request (plain OffsiteRequest), recipientName, url,
 *           recipientIsCreator?, recipientIsLeader?,
 *           returnInfo?, changeSummary?, cancelReason? }
 */
import { changeSummaryLines, formatWorkDateTh } from "../offsiteRules.js";

export const OFFSITE_EMAIL_TYPES = [
  "offsite_invite",
  "offsite_members_ready",
  "offsite_approval_pending",
  "offsite_reconfirm",
  "offsite_returned",
  "offsite_approved",
  "offsite_cancelled",
];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Per type: subject (after "[HRMS] docNo"), intro line, button label.
 * `ctx.recipientIsLeader` / `recipientIsCreator` pick the wording where the
 * team leader and the creator get the same email for different reasons.
 */
const COPY = {
  offsite_invite: (r) => ({
    subject: `คุณได้รับคำเชิญร่วมงานนอกสถานที่: ${r.jobName}`,
    intro: `${r.creatorNameTh} เชิญคุณร่วมปฏิบัติงานนอกสถานที่ กรุณาเปิดคำขอเพื่ออ่านรายละเอียด แล้วลงนามยอมรับหรือปฏิเสธ`,
    button: "เปิดคำเชิญ",
  }),
  offsite_members_ready: (r, ctx) =>
    ctx.recipientIsLeader
      ? {
          subject: "สมาชิกตอบรับครบแล้ว — รอคุณลงนามในฐานะหัวหน้าทีม",
          intro: "สมาชิกทุกคนตอบรับคำเชิญแล้ว คุณเป็นหัวหน้าทีมของคำขอนี้ กรุณาลงนาม (ขั้นที่ 1) เพื่อส่งแบบฟอร์มขออนุมัติ",
          button: "ลงนามและส่งแบบฟอร์ม",
        }
      : {
          subject: "สมาชิกตอบรับครบแล้ว — รอหัวหน้าทีมลงนาม",
          intro: `สมาชิกทุกคนตอบรับคำเชิญแล้ว ขั้นต่อไปคือหัวหน้าทีม (${leaderName(r)}) ลงนามเพื่อส่งแบบฟอร์มขออนุมัติ คุณไม่ต้องดำเนินการใด ๆ`,
          button: "ดูคำขอ",
        },
  offsite_approval_pending: (r) => ({
    subject: `รอคุณอนุมัติ: ${r.jobName}`,
    intro: "มีคำขอทำงานนอกสถานที่รอให้คุณพิจารณาอนุมัติ",
    button: "พิจารณาคำขอ",
  }),
  offsite_reconfirm: (r) => ({
    subject: `รอคุณตรวจสอบและยืนยันอีกครั้ง: ${r.jobName}`,
    intro: "คำขอที่คุณเคยอนุมัติถูกส่งกลับและส่งใหม่ กรุณาตรวจสอบสิ่งที่เปลี่ยนแล้วกด “ยืนยันอีกครั้ง” (ไม่ต้องเซ็นใหม่)",
    button: "ตรวจสอบและยืนยัน",
  }),
  offsite_returned: (r, ctx) =>
    ctx.recipientIsCreator
      ? {
          subject: "คำขอถูกส่งกลับให้แก้ไข",
          intro: "คำขอทำงานนอกสถานที่ของคุณถูกส่งกลับ กรุณาแก้ไขแล้วส่งอีกครั้ง",
          button: "แก้ไขคำขอ",
        }
      : {
          subject: "คำขอที่คุณเป็นหัวหน้าทีมถูกส่งกลับให้แก้ไข",
          intro: "คำขอทำงานนอกสถานที่ที่คุณเป็นหัวหน้าทีมถูกส่งกลับ ผู้สร้างคำขอจะแก้ไขแล้วส่งอีกครั้ง",
          button: "ดูคำขอ",
        },
  offsite_approved: (r, ctx) =>
    ctx.recipientIsCreator
      ? {
          subject: "คำขอของคุณได้รับการอนุมัติแล้ว",
          intro: "คำขอทำงานนอกสถานที่ของคุณได้รับการอนุมัติครบทุกขั้นแล้ว",
          button: "ดูคำขอ",
        }
      : {
          subject: "คำขอที่คุณเป็นหัวหน้าทีมได้รับการอนุมัติแล้ว",
          intro: "คำขอทำงานนอกสถานที่ที่คุณเป็นหัวหน้าทีมได้รับการอนุมัติครบทุกขั้นแล้ว",
          button: "ดูคำขอ",
        },
  offsite_cancelled: () => ({
    subject: "คำขอถูกยกเลิก",
    intro: "คำขอทำงานนอกสถานที่ต่อไปนี้ถูกยกเลิกโดยผู้สร้างคำขอ ไม่ต้องดำเนินการใด ๆ เพิ่มเติม",
    button: "ดูคำขอ",
  }),
};

/** Extra lines (label, value) for some types. */
function extraLines(type, ctx) {
  if (type === "offsite_returned" && ctx.returnInfo) {
    const who = ctx.returnInfo.step ? `${ctx.returnInfo.byName} (ขั้นที่ ${ctx.returnInfo.step})` : `${ctx.returnInfo.byName} (สมาชิก)`;
    return [["ส่งกลับโดย", who], ["เหตุผล", ctx.returnInfo.reason]];
  }
  if (type === "offsite_cancelled" && ctx.cancelReason) return [["เหตุผลที่ยกเลิก", ctx.cancelReason]];
  return [];
}

function changeList(type, ctx) {
  if (type !== "offsite_reconfirm" || !ctx.changeSummary) return [];
  const items = changeSummaryLines(ctx.changeSummary);
  return items.length ? items : ["ไม่มีการเปลี่ยนแปลงข้อมูล"];
}

/** The team leader's name (step 1 approver, else the member entry). */
function leaderName(r) {
  const step1 = (r.approvals || []).find((a) => a.step === 1);
  if (step1?.approverName) return step1.approverName;
  return (r.members || []).find((m) => String(m.employee) === String(r.leader))?.nameSnapshot || "-";
}

export function buildOffsiteEmail(type, ctx) {
  const r = ctx.request;
  const copy = COPY[type](r, ctx);
  const subject = `[HRMS] ${r.docNo || ""} ${copy.subject}`.replace(/\s+/g, " ").trim();
  const facts = [
    ["เลขที่เอกสาร", r.docNo || "-"],
    ["ชื่องาน", r.jobName],
    ["วันที่ทำงาน", `${formatWorkDateTh(r.workDate)} เวลา ${r.startTime}–${r.endTime} น.`],
    ["สถานที่", r.placeName],
    ["ผู้สร้างคำขอ", r.creatorNameTh],
    ["หัวหน้าทีม", leaderName(r)],
    ...extraLines(type, ctx),
  ];
  const changes = changeList(type, ctx);

  const rowsHtml = facts
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5E6A7E;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;color:#0D1B2A">${esc(v)}</td></tr>`)
    .join("");
  const changesHtml = changes.length
    ? `<p style="margin:16px 0 4px;font-weight:bold;color:#0D1B2A">สิ่งที่เปลี่ยนจากครั้งก่อน</p><ul style="margin:0;padding-left:20px;color:#0D1B2A">${changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`
    : "";

  const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:24px;background:#F8FAFD;font-family:Tahoma,'Leelawadee UI','Noto Sans Thai',Arial,sans-serif;font-size:15px;line-height:1.6">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;color:#2486FF;font-weight:bold">9Expert HRMS · ทำงานนอกสถานที่</p>
    <p style="margin:0 0 16px;color:#0D1B2A">เรียน ${esc(ctx.recipientName || "")}</p>
    <p style="margin:0 0 16px;color:#0D1B2A">${esc(copy.intro)}</p>
    <table role="presentation" style="border-collapse:collapse;font-size:14px">${rowsHtml}</table>
    ${changesHtml}
    <p style="margin:24px 0 8px"><a href="${esc(ctx.url)}" style="display:inline-block;background:#005CFF;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 20px;border-radius:8px">${esc(copy.button)}</a></p>
    <p style="margin:16px 0 0;color:#94A3B8;font-size:12px">อีเมลนี้ส่งอัตโนมัติจากระบบ HRMS กรุณาอย่าตอบกลับ</p>
  </div>
</body></html>`;

  const text = [
    `เรียน ${ctx.recipientName || ""}`,
    "",
    copy.intro,
    "",
    ...facts.map(([k, v]) => `${k}: ${v}`),
    ...(changes.length ? ["", "สิ่งที่เปลี่ยนจากครั้งก่อน:", ...changes.map((c) => `- ${c}`)] : []),
    "",
    `${copy.button}: ${ctx.url}`,
    "",
    "อีเมลนี้ส่งอัตโนมัติจากระบบ HRMS กรุณาอย่าตอบกลับ",
  ].join("\n");

  return { subject, html, text };
}
