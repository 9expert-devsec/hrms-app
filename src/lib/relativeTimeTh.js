/**
 * Thai "last seen" text. Pure — browser-safe. Calendar days are Bangkok days.
 *   < 1 min → "เมื่อสักครู่", < 1 h → "10 นาทีที่แล้ว", today → "2 ชม. ที่แล้ว",
 *   yesterday → "เมื่อวาน", up to 7 days → "3 วันที่แล้ว",
 *   older → "6 พ.ย. 2569"; none → "ยังไม่เคยเข้า".
 */
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TZ = "Asia/Bangkok";

const bangkokYmd = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
const dayNumber = (d) => {
  const [y, m, day] = bangkokYmd(d);
  return Date.UTC(y, m - 1, day) / 86400000;
};

export function shortDateTh(value) {
  const [y, m, d] = bangkokYmd(new Date(value));
  return `${d} ${MONTHS[m - 1]} ${y + 543}`;
}

/** "6 พ.ย. 2569 14:05 น." — for a title attribute. */
export function fullDateTimeTh(value) {
  if (!value) return "";
  const d = new Date(value);
  const time = d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${shortDateTh(d)} ${time} น.`;
}

export function lastSeenTh(value, now = new Date()) {
  if (!value) return "ยังไม่เคยเข้า";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "ยังไม่เคยเข้า";
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  const days = dayNumber(now) - dayNumber(d);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60 && days === 0) return `${mins} นาทีที่แล้ว`;
  if (days === 0) return `${Math.floor(mins / 60)} ชม. ที่แล้ว`;
  if (days === 1) return "เมื่อวาน";
  if (days <= 7) return `${days} วันที่แล้ว`;
  return shortDateTh(d);
}

/** "14:05 น." in Bangkok time. */
export function timeTh(value) {
  return `${new Date(value).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false })} น.`;
}
