// Checks the leave-count engine (src/lib/leave/countLeave.js) and the amount
// formatter. No dependencies:  node scripts/check-leave-count.mjs
import assert from "node:assert/strict";
import { countLeave, dateKeyOf, calendarDays } from "../src/lib/leave/countLeave.js";
import { formatLeaveAmount } from "../src/lib/leave/format.js";

const OPTS = {
  weeklyDaysOff: [0, 6], // Sat + Sun
  holidays: [{ date: new Date(Date.UTC(2026, 11, 7)), name: "วันหยุดชดเชยวันพ่อแห่งชาติ" }], // stored like Holiday.date
  hoursPerDay: 8,
};

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (e) {
    console.log(`FAIL  ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
}

check("full day 3–7 Dec 2026, Sat/Sun off, 7 Dec holiday → 16 h, 3 excluded", () => {
  const r = countLeave({ unit: "full_day", startDate: "2026-12-03", endDate: "2026-12-07" }, OPTS);
  assert.equal(r.error, undefined);
  assert.equal(r.totalHours, 16);
  assert.equal(r.workingDays, 2);
  assert.deepEqual(r.excluded, [
    { date: "2026-12-05", reason: "วันหยุดประจำสัปดาห์" },
    { date: "2026-12-06", reason: "วันหยุดประจำสัปดาห์" },
    { date: "2026-12-07", reason: "วันหยุดชดเชยวันพ่อแห่งชาติ" },
  ]);
});

check("half day on a holiday → error", () => {
  const r = countLeave({ unit: "half_day", startDate: "2026-12-07", halfDayPeriod: "morning" }, OPTS);
  assert.ok(r.error, "expected an error");
  assert.equal(r.totalHours, 0);
});

check("half day on a working day → 4 h, shown as ครึ่งวัน", () => {
  const r = countLeave({ unit: "half_day", startDate: "2026-12-08", halfDayPeriod: "afternoon" }, OPTS);
  assert.equal(r.totalHours, 4);
  assert.equal(formatLeaveAmount(r.totalHours, { unit: "half_day" }), "ครึ่งวัน");
});

check("hourly 13:00–16:00 → 3 h", () => {
  const r = countLeave({ unit: "hourly", startDate: "2026-12-08", startTime: "13:00", endTime: "16:00" }, OPTS);
  assert.equal(r.error, undefined);
  assert.equal(r.totalHours, 3);
});

check("hourly of 30 minutes → error", () => {
  const r = countLeave({ unit: "hourly", startDate: "2026-12-08", startTime: "13:00", endTime: "13:30" }, OPTS);
  assert.ok(r.error, "expected an error");
});

check("hourly off the 30-minute grid, reversed, or a full day → error", () => {
  assert.ok(countLeave({ unit: "hourly", startDate: "2026-12-08", startTime: "13:15", endTime: "15:15" }, OPTS).error);
  assert.ok(countLeave({ unit: "hourly", startDate: "2026-12-08", startTime: "15:00", endTime: "13:00" }, OPTS).error);
  assert.ok(countLeave({ unit: "hourly", startDate: "2026-12-08", startTime: "09:00", endTime: "17:00" }, OPTS).error);
});

check("a range that is all days off → error", () => {
  const r = countLeave({ unit: "full_day", startDate: "2026-12-05", endDate: "2026-12-07" }, OPTS);
  assert.ok(r.error, "expected an error");
  assert.equal(r.totalHours, 0);
});

check("end before start → error", () => {
  assert.ok(countLeave({ unit: "full_day", startDate: "2026-12-04", endDate: "2026-12-03" }, OPTS).error);
});

check("range crossing a month boundary (Fri 27 Nov – Tue 1 Dec 2026) → 24 h, weekend excluded", () => {
  const r = countLeave({ unit: "full_day", startDate: "2026-11-27", endDate: "2026-12-01" }, OPTS);
  assert.equal(r.totalHours, 24);
  assert.deepEqual(r.excluded.map((x) => x.date), ["2026-11-28", "2026-11-29"]);
  assert.equal(calendarDays("2026-11-27", "2026-12-01"), 5);
});

check("range crossing a year boundary (Thu 31 Dec 2026 – Mon 4 Jan 2027) → 24 h", () => {
  const r = countLeave({ unit: "full_day", startDate: "2026-12-31", endDate: "2027-01-04" }, OPTS);
  assert.equal(r.totalHours, 24);
});

check("Bangkok date of 00:30 local (17:30 UTC the day before) is the local day", () => {
  assert.equal(dateKeyOf(new Date("2026-12-02T17:30:00Z")), "2026-12-03");
});

check("formatLeaveAmount", () => {
  assert.equal(formatLeaveAmount(16), "2 วัน");
  assert.equal(formatLeaveAmount(3), "3 ชม.");
  assert.equal(formatLeaveAmount(12), "1 วัน 4 ชม.");
  assert.equal(formatLeaveAmount(4), "4 ชม.");
  assert.equal(formatLeaveAmount(0), "0 วัน");
  assert.equal(formatLeaveAmount(-4), "-4 ชม.");
});

console.log(`\n${passed} passed${process.exitCode ? ", SOME FAILED" : ", all passed"}`);
