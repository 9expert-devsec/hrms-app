/**
 * Leave-count engine (paper form QF-HRD-001). Pure and browser-safe: the
 * ขอลา page shows its result live and the server recomputes it on every
 * submit / resubmit, ignoring any total the client sends.
 *
 * Dates are date-only keys "YYYY-MM-DD" on the Asia/Bangkok calendar. A Date
 * is converted with dateKeyOf() (Bangkok), never with UTC getters, so 00:00
 * Bangkok never slips to the previous day. Stored date-only values (Leave
 * startDate/endDate, Holiday.date) are UTC midnight of that key (keyToDate).
 */

/* ── assumptions (one-line changes) ─────────────────────────── */

/** A2: hours in one leave day when the settings document has none. */
export const HOURS_PER_DAY = 8;
/** A1: weekly days off when the settings document has none (0 = Sunday … 6 = Saturday). */
export const DEFAULT_WEEKLY_DAYS_OFF = [0, 6];
/** A2: hourly leave — step in minutes and the shortest request in hours. */
export const HOURLY_STEP_MINUTES = 30;
export const HOURLY_MIN_HOURS = 1;

export const LEAVE_UNITS = ["full_day", "half_day", "hourly"];
export const HALF_DAY_PERIODS = ["morning", "afternoon"];
export const WEEKLY_DAY_OFF_REASON = "วันหยุดประจำสัปดาห์";

/** LeaveType.units (round 39: day | half | hour) ↔ Leave.unit. */
export const UNIT_OF_TYPE_UNIT = { day: "full_day", half: "half_day", hour: "hourly" };
export const TYPE_UNIT_OF_UNIT = { full_day: "day", half_day: "half", hourly: "hour" };

const TZ = "Asia/Bangkok";
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/* ── date keys ──────────────────────────────────────────────── */

/** "YYYY-MM-DD" if `s` is a real calendar date, else null. */
export function parseDateKey(s) {
  const m = typeof s === "string" ? KEY_RE.exec(s) : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

/** The Bangkok calendar date of a Date / ISO string / key, as "YYYY-MM-DD" (null if invalid). */
export function dateKeyOf(value) {
  if (!value) return null;
  if (typeof value === "string" && KEY_RE.test(value)) return parseDateKey(value);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** The stored Date of a key: UTC midnight of that calendar date. */
export function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export const addDays = (key, n) => {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 0 = Sunday … 6 = Saturday, of the calendar date itself. */
export const weekdayOf = (key) => keyToDate(key).getUTCDay();

/** Today on the Bangkok calendar. */
export const todayKey = (now = new Date()) => dateKeyOf(now);

/* ── times ──────────────────────────────────────────────────── */

export const isTime = (s) => typeof s === "string" && TIME_RE.test(s);
export const minutesOf = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/* ── the engine ─────────────────────────────────────────────── */

const fail = (error) => ({ totalHours: 0, workingDays: 0, excluded: [], error });

/** Map of key → holiday name from [{ date, name }] (date: key, Date or ISO string). */
function holidayMap(holidays) {
  const map = new Map();
  for (const h of holidays || []) {
    const k = dateKeyOf(h?.date);
    if (k) map.set(k, h.name || "วันหยุด");
  }
  return map;
}

/** Why `key` is a day off ("วันหยุดประจำสัปดาห์" or the holiday's name), or null. */
function dayOffReason(key, offDays, holidays) {
  if (holidays.has(key)) return holidays.get(key);
  if (offDays.has(weekdayOf(key))) return WEEKLY_DAY_OFF_REASON;
  return null;
}

/**
 * countLeave({ unit, startDate, endDate, halfDayPeriod, startTime, endTime },
 *            { weeklyDaysOff, holidays, hoursPerDay })
 *   → { totalHours, workingDays, excluded: [{ date, reason }], error? }
 *
 * full_day: every date start..end inclusive, skipping weekly days off and
 * holidays (each skip listed in `excluded`). half_day / hourly: one date
 * (endDate is ignored, start = end), which must be a working day. `error` is
 * a Thai message; totals are 0 when it is set.
 */
export function countLeave(input = {}, opts = {}) {
  const hoursPerDay = Number(opts.hoursPerDay) > 0 ? Number(opts.hoursPerDay) : HOURS_PER_DAY;
  const offDays = new Set(Array.isArray(opts.weeklyDaysOff) ? opts.weeklyDaysOff : DEFAULT_WEEKLY_DAYS_OFF);
  const holidays = holidayMap(opts.holidays);
  const { unit } = input;

  if (!LEAVE_UNITS.includes(unit)) return fail("กรุณาเลือกรูปแบบการลา");
  const start = parseDateKey(input.startDate);
  if (!start) return fail("กรุณาเลือกวันที่ลา");

  if (unit === "full_day") {
    const end = parseDateKey(input.endDate);
    if (!end) return fail("กรุณาเลือกวันที่สิ้นสุด");
    if (end < start) return fail("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มลา");
    const excluded = [];
    let workingDays = 0;
    let span = 0;
    for (let k = start; k <= end; k = addDays(k, 1)) {
      if (++span > 366) return fail("ช่วงวันลายาวเกิน 1 ปี");
      const reason = dayOffReason(k, offDays, holidays);
      if (reason) excluded.push({ date: k, reason });
      else workingDays += 1;
    }
    if (!workingDays) return fail("ช่วงที่เลือกเป็นวันหยุดทั้งหมด — ไม่มีวันทำงานให้ลา");
    return { totalHours: workingDays * hoursPerDay, workingDays, excluded };
  }

  // half_day / hourly: a single working day.
  const reason = dayOffReason(start, offDays, holidays);
  if (reason) return fail(`วันที่เลือกเป็นวันหยุด (${reason}) — เลือกวันทำงาน`);

  if (unit === "half_day") {
    if (!HALF_DAY_PERIODS.includes(input.halfDayPeriod)) return fail("กรุณาเลือกช่วงเช้าหรือบ่าย");
    return { totalHours: hoursPerDay / 2, workingDays: 1, excluded: [] };
  }

  // hourly
  if (!isTime(input.startTime) || !isTime(input.endTime)) return fail("กรุณาระบุเวลาเริ่มและเวลาสิ้นสุด");
  const from = minutesOf(input.startTime);
  const to = minutesOf(input.endTime);
  if (from % HOURLY_STEP_MINUTES || to % HOURLY_STEP_MINUTES) return fail(`เวลาต้องเป็นช่วงละ ${HOURLY_STEP_MINUTES} นาที`);
  if (to <= from) return fail("เวลาสิ้นสุดต้องหลังเวลาเริ่ม");
  const hours = (to - from) / 60;
  if (hours < HOURLY_MIN_HOURS) return fail(`ลารายชั่วโมงขั้นต่ำ ${HOURLY_MIN_HOURS} ชั่วโมง`);
  if (hours >= hoursPerDay) return fail(`ลารายชั่วโมงต้องน้อยกว่า ${hoursPerDay} ชั่วโมง — เลือกเต็มวันหรือครึ่งวันแทน`);
  return { totalHours: hours, workingDays: 1, excluded: [] };
}

/** Calendar days from start to end inclusive (0 if invalid). */
export function calendarDays(startDate, endDate) {
  const s = parseDateKey(startDate);
  const e = parseDateKey(endDate);
  if (!s || !e || e < s) return 0;
  return Math.round((keyToDate(e) - keyToDate(s)) / 86400000) + 1;
}
