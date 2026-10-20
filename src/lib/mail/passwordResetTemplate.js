/**
 * "ตั้งรหัสผ่านใหม่" email (Thai, one button). Pure — no server imports.
 * The link carries the reset token: it is never logged (sendMail stores no body).
 *
 * buildPasswordResetEmail({ recipientName, url, minutes }) → { subject, html, text }
 */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function buildPasswordResetEmail({ recipientName = "", url, minutes = 30 }) {
  const subject = "[HRMS] ตั้งรหัสผ่านใหม่";
  const intro = "มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี HRMS ของคุณ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่";
  const expiry = `ลิงก์นี้ใช้ได้ครั้งเดียว และหมดอายุใน ${minutes} นาที`;
  const ignore = "ถ้าคุณไม่ได้ขอตั้งรหัสผ่านใหม่ ไม่ต้องทำอะไร — รหัสผ่านเดิมยังใช้ได้ตามปกติ";

  const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:24px;background:#F8FAFD;font-family:Tahoma,'Leelawadee UI','Noto Sans Thai',Arial,sans-serif;font-size:15px;line-height:1.6">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;color:#2486FF;font-weight:bold">9Expert HRMS · ตั้งรหัสผ่านใหม่</p>
    <p style="margin:0 0 16px;color:#0D1B2A">เรียน ${esc(recipientName)}</p>
    <p style="margin:0 0 16px;color:#0D1B2A">${esc(intro)}</p>
    <p style="margin:24px 0 8px"><a href="${esc(url)}" style="display:inline-block;background:#005CFF;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 20px;border-radius:8px">ตั้งรหัสผ่านใหม่</a></p>
    <p style="margin:16px 0 0;color:#0D1B2A">${esc(expiry)}</p>
    <p style="margin:8px 0 0;color:#5E6A7E">${esc(ignore)}</p>
    <p style="margin:16px 0 0;color:#94A3B8;font-size:12px">อีเมลนี้ส่งอัตโนมัติจากระบบ HRMS กรุณาอย่าตอบกลับ</p>
  </div>
</body></html>`;

  const text = [
    `เรียน ${recipientName}`,
    "",
    intro,
    "",
    `ตั้งรหัสผ่านใหม่: ${url}`,
    "",
    expiry,
    ignore,
    "",
    "อีเมลนี้ส่งอัตโนมัติจากระบบ HRMS กรุณาอย่าตอบกลับ",
  ].join("\n");

  return { subject, html, text };
}
