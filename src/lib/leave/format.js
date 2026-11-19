import { HOURS_PER_DAY, dateKeyOf, weekdayOf } from "./countLeave.js";

/** Display helpers for leave amounts and dates. Pure — browser-safe. */

const MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const WEEKDAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

const num = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/**
 * A leave amount from hours: "2 วัน", "3 ชม.", "1 วัน 4 ชม.", "0 วัน".
 * "ครึ่งวัน" only for a half_day request of exactly half a day
 * ({ unit: "half_day" }). Negative amounts keep their sign.
 */
export function formatLeaveAmount(totalHours, { unit, hoursPerDay = HOURS_PER_DAY } = {}) {
  const h = Number(totalHours) || 0;
  if (unit === "half_day" && h === hoursPerDay / 2) return "ครึ่งวัน";
  if (h < 0) return `-${formatLeaveAmount(-h, { hoursPerDay })}`;
  const days = Math.floor(h / hoursPerDay + 1e-9);
  const rest = Math.round((h - days * hoursPerDay) * 100) / 100;
  if (!days && !rest) return "0 วัน";
  const parts = [];
  if (days) parts.push(`${days} วัน`);
  if (rest) parts.push(`${num(rest)} ชม.`);
  return parts.join(" ");
}

function parts(value) {
  const k = dateKeyOf(value);
  if (!k) return null;
  const [y, m, d] = k.split("-").map(Number);
  return { k, y, m, d };
}

/** "จ. 7 ธ.ค. 2569" */
export function thaiDateShort(value, { weekday = true } = {}) {
  const p = parts(value);
  if (!p) return "-";
  const date = `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y + 543}`;
  return weekday ? `${WEEKDAYS_SHORT[weekdayOf(p.k)]} ${date}` : date;
}

/** "3–7 ธ.ค. 2569", "28 พ.ย. – 2 ธ.ค. 2569", or one date. */
export function thaiDateRange(start, end) {
  const a = parts(start);
  const b = parts(end) || a;
  if (!a) return "-";
  if (a.k === b.k) return thaiDateShort(a.k, { weekday: false });
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTHS_SHORT[b.m - 1]} ${b.y + 543}`;
  if (a.y === b.y) return `${a.d} ${MONTHS_SHORT[a.m - 1]} – ${b.d} ${MONTHS_SHORT[b.m - 1]} ${b.y + 543}`;
  return `${thaiDateShort(a.k, { weekday: false })} – ${thaiDateShort(b.k, { weekday: false })}`;
}

/** "19 พ.ย. 2569 · 10:05" (Bangkok). */
export function thaiDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
  return `${thaiDateShort(d, { weekday: false })} · ${time}`;
}

/** The period of a leave for lists: date range, plus the half or the hours. */
export function leavePeriodText(leave) {
  const range = thaiDateRange(leave.startDate, leave.endDate);
  if (leave.unit === "half_day") return `${range} (${leave.halfDayPeriod === "afternoon" ? "บ่าย" : "เช้า"})`;
  if (leave.unit === "hourly" && leave.startTime) return `${range} ${leave.startTime}–${leave.endTime}`;
  return range;
}
