"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Eye, Info, Loader2, RotateCcw, Send, Zap } from "lucide-react";
import {
  BLUE,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  FOCUS,
  INPUT,
  LINE,
  MUTED,
  NAVY,
  SLATE,
} from "../../../../../components/hr/hrUi";
import PersonAvatar from "../../../../../components/PersonAvatar";
import MySignaturePicker from "../../../../../components/MySignaturePicker";
import { saveMySignature } from "../../../../../components/offsite/SignatureConfirm";
import Dialog from "../settings/ui/Dialog";
import LeaveAttachments from "./LeaveAttachments";
import ThaiDatePicker from "../../../../../components/ThaiDatePicker";
import { fiscalYearLabel, fiscalYearOf } from "@/lib/leaveRules";
import { UNIT_OF_TYPE_UNIT, calendarDays, countLeave, keyToDate } from "@/lib/leave/countLeave";
import { formatLeaveAmount, leavePeriodText, thaiDateRange, thaiDateShort, thaiDateTime } from "@/lib/leave/format";
import { STEP_LABELS, leaveSubject } from "@/lib/leave/flow";

const UNIT_TABS = [
  { unit: "full_day", label: "เต็มวัน" },
  { unit: "half_day", label: "ครึ่งวัน" },
  { unit: "hourly", label: "รายชั่วโมง" },
];
const GREEN = "#15803D";
const RED = "#B91C1C";

/** "06:00" … "22:00" every 30 minutes (A2). */
const TIMES = Array.from({ length: 33 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

const allowedUnits = (type) => (type?.units || []).map((u) => UNIT_OF_TYPE_UNIT[u]).filter(Boolean);

/**
 * ขอลา — ใบแจ้งการลา (QF-HRD-001). The count, the quota line and the
 * approval path are shown live; the server checks all of it again.
 */
export default function LeaveRequestClient({ ctx }) {
  const router = useRouter();
  const { settings, types, quotas, holidays, approval, employee, editing } = ctx;
  const hoursPerDay = settings.hoursPerDay;
  const amount = (h, unit) => formatLeaveAmount(h, { unit, hoursPerDay });

  const [typeId, setTypeId] = useState(() => (editing && types.some((t) => t._id === editing.leaveTypeId) ? editing.leaveTypeId : types[0]?._id || ""));
  const type = types.find((t) => t._id === typeId) || null;
  const [unit, setUnit] = useState(() => {
    const units = allowedUnits(type);
    if (editing && units.includes(editing.unit)) return editing.unit;
    return units.includes("full_day") ? "full_day" : units[0] || "full_day";
  });
  const [startDate, setStartDate] = useState(editing?.startDate || "");
  const [endDate, setEndDate] = useState(editing?.endDate || "");
  const [halfDayPeriod, setHalfDayPeriod] = useState(editing?.halfDayPeriod || "morning");
  const [startTime, setStartTime] = useState(editing?.startTime || "");
  const [endTime, setEndTime] = useState(editing?.endTime || "");
  const [reason, setReason] = useState(editing?.reason || "");
  const [contact, setContact] = useState(editing ? editing.contactDuringLeave : employee.phone);
  const [attachments, setAttachments] = useState(() => (editing?.attachments || []).map((a, i) => ({ ...a, id: `saved-${i}`, status: "done" })));
  const [sig, setSig] = useState(null); // MySignaturePicker, only when no profile signature
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false); // confirm dialog open
  const [withdrawBusy, setWithdrawBusy] = useState(false);

  function pickType(t) {
    setTypeId(t._id);
    const units = allowedUnits(t);
    if (!units.includes(unit)) setUnit(units.includes("full_day") ? "full_day" : units[0]);
  }

  // Live count (same engine as the server).
  const count = useMemo(() => {
    if (!startDate) return null;
    if (unit === "full_day" && !endDate) return null;
    if (unit === "hourly" && (!startTime || !endTime)) return null;
    return countLeave(
      { unit, startDate, endDate: unit === "full_day" ? endDate : startDate, halfDayPeriod, startTime, endTime },
      { weeklyDaysOff: settings.weeklyDaysOff, holidays, hoursPerDay }
    );
  }, [unit, startDate, endDate, halfDayPeriod, startTime, endTime, settings.weeklyDaysOff, holidays, hoursPerDay]);
  const counted = count && !count.error ? count : null;

  // Quota (A3) in the fiscal year of the start date.
  const fy = startDate ? fiscalYearOf(keyToDate(startDate), settings.fiscalYearStartMonth) : ctx.currentFiscalYear;
  const remainingOf = (tid, year = fy) => {
    const q = quotas[year]?.[tid];
    if (!q) return undefined; // fiscal year not loaded: the server decides
    if (q.quotaDays === null) return null;
    return q.quotaDays * hoursPerDay - q.usedHours - q.pendingHours;
  };
  const remaining = type ? remainingOf(type._id) : undefined;
  const after = typeof remaining === "number" && counted ? remaining - counted.totalHours : null;
  const overQuota = after !== null && after < 0;

  const attachFrom = type?.requiresAttachmentFromDays;
  const attachRequired = attachFrom !== null && attachFrom !== undefined && !!counted && counted.totalHours >= attachFrom * hoursPerDay;
  const uploadsDone = attachments.filter((a) => a.status === "done");
  const uploading = attachments.some((a) => a.status === "resizing" || a.status === "uploading");
  const signature = ctx.profileSignature || sig?.png || null;
  const blockedApprovers = approval.mode === "missing";
  const subject = type ? leaveSubject(type.nameTh) : "";
  const addressedTo = approval.mode === "auto" ? "ฝ่ายบุคคล" : approval.approvers[0]?.name || "";

  const missing = [];
  if (!type) missing.push("ประเภทการลา");
  if (!counted) missing.push("ช่วงเวลา");
  if (!reason.trim()) missing.push("เหตุผลการลา");
  if (!contact.trim()) missing.push("ช่องทางติดต่อ");
  if (!signature) missing.push("ลายเซ็น");
  if (attachRequired && !uploadsDone.length) missing.push("ไฟล์แนบ");
  const canSubmit = !missing.length && !overQuota && !blockedApprovers && !uploading && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        leaveTypeId: typeId,
        unit,
        startDate,
        endDate: unit === "full_day" ? endDate : startDate,
        halfDayPeriod: unit === "half_day" ? halfDayPeriod : undefined,
        startTime: unit === "hourly" ? startTime : undefined,
        endTime: unit === "hourly" ? endTime : undefined,
        reason: reason.trim(),
        contactDuringLeave: contact.trim(),
        attachments: uploadsDone.map(({ url, publicId, name, type: t, size }) => ({ url, publicId, name, type: t, size })),
        employeeSignature: ctx.profileSignature ? undefined : sig?.png,
      };
      const res = await fetch(editing ? `/api/leave/${editing._id}/resubmit` : "/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.message || "ส่งใบลาไม่สำเร็จ");
      if (!ctx.profileSignature && sig?.saveAsMine) {
        try {
          await saveMySignature(sig.png);
        } catch (err) {
          console.warn("[leave] could not save signature:", err?.message);
        }
      }
      router.push("/dashboard/leave/history");
      router.refresh();
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  async function withdraw() {
    setWithdrawBusy(true);
    try {
      const res = await fetch(`/api/leave/${editing._id}/withdraw`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.message || "ยกเลิกใบลาไม่สำเร็จ");
      router.push("/dashboard/leave/history");
      router.refresh();
    } catch (e) {
      setError(e.message);
      setWithdrawing(false);
      setWithdrawBusy(false);
    }
  }

  const excludedGroups = useMemo(() => {
    const groups = [];
    for (const x of counted?.excluded || []) {
      const g = groups.find((y) => y.reason === x.reason);
      if (g) g.dates.push(x.date);
      else groups.push({ reason: x.reason, dates: [x.date] });
    }
    return groups;
  }, [counted]);

  return (
    <div className="space-y-4">
      {ctx.editNotice && (
        <div role="status" className="flex items-start gap-2 rounded-2xl px-4 py-3 text-[14px]" style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E" }} data-testid="leave-edit-notice">
          <Info size={18} className="mt-0.5 shrink-0" aria-hidden /> {ctx.editNotice} — ฟอร์มด้านล่างเป็นใบลาใหม่
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          {editing && (
            <section className="rounded-[18px] bg-white p-5" style={{ border: "1px solid #FECACA", background: "#FFFBFB" }} data-testid="leave-returned-banner">
              <h2 className="flex items-center gap-2 text-[16px] font-bold" style={{ color: RED }}>
                <AlertTriangle size={20} aria-hidden /> ใบลาถูกส่งกลับให้แก้ไข
              </h2>
              {editing.returnInfo ? (
                <div className="mt-2 text-[14px]" style={{ color: NAVY }}>
                  <p>
                    {editing.returnInfo.byName || "-"} ({STEP_LABELS[editing.returnInfo.step] || STEP_LABELS[1]}) ·{" "}
                    {editing.returnInfo.at ? thaiDateTime(editing.returnInfo.at) : "-"}
                  </p>
                  <p>เหตุผล: {editing.returnInfo.reason || "-"}</p>
                </div>
              ) : null}
              <p className="mt-2 text-[13px]" style={{ color: SLATE }}>
                แก้ไขฟอร์มด้านล่างแล้วกด “ส่งใหม่” — ใบลาจะเริ่มอนุมัติใหม่ตั้งแต่ขั้นผู้อนุมัติ · หรือ “ยกเลิกใบลา” ถ้าไม่ลาแล้ว
              </p>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setWithdrawing(true)} className={BTN_SECONDARY} data-testid="leave-withdraw">ยกเลิกใบลา</button>
                <button type="button" onClick={submit} disabled={!canSubmit} className={BTN_PRIMARY} data-testid="leave-resubmit-top">
                  {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />} ส่งใหม่
                </button>
              </div>
            </section>
          )}

          <section className="rounded-[18px] bg-white p-5 md:p-6" style={{ border: `1px solid ${LINE}` }} data-testid="leave-form">
            <h2 className="text-[20px] font-bold" style={{ color: NAVY }}>ใบแจ้งการลา</h2>
            <p className="mt-0.5 text-[13px]" style={{ color: SLATE }}>
              กรอกตามแบบฟอร์ม QF-HRD-001 — ระบบเติมชื่อ ตำแหน่ง แผนก และลาครั้งล่าสุดให้อัตโนมัติ
            </p>

            {/* 1. type */}
            <Step title="1. ประเภทการลา">
              {types.length ? (
                <div role="radiogroup" aria-label="ประเภทการลา" className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
                  {types.map((t) => {
                    const on = t._id === typeId;
                    const rem = remainingOf(t._id);
                    return (
                      <button
                        key={t._id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => pickType(t)}
                        className={`min-h-[64px] rounded-xl px-3.5 py-2.5 text-left ${FOCUS}`}
                        style={{ border: `${on ? 2 : 1}px solid ${on ? BLUE : "#D6E0F0"}`, background: on ? "#F0F5FF" : "#FFFFFF", margin: on ? 0 : 1 }}
                        data-testid="leave-type-card"
                        data-id={t._id}
                        data-selected={on ? "1" : "0"}
                      >
                        <span className="flex items-center gap-1.5 text-[15px] font-semibold" style={{ color: on ? BLUE : NAVY }}>
                          {on && <Check size={15} aria-hidden />} {t.nameTh}
                        </span>
                        <span className="mt-0.5 block text-[12px]" style={{ color: typeof rem === "number" && rem <= 0 ? RED : SLATE }} data-testid="leave-type-remaining">
                          {rem === null ? "ไม่จำกัด" : rem === undefined ? "—" : `เหลือ ${amount(rem)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[14px]" style={{ color: RED }}>ยังไม่มีประเภทการลาที่เปิดใช้งาน — ติดต่อฝ่ายบุคคล</p>
              )}
              <p className="mt-2 text-[12px]" style={{ color: MUTED }}>
                ประเภทการลามาจาก “ตั้งค่าการลา” ที่ HR เพิ่มได้เอง · ประเภทนอก 3 แบบหลักจะพิมพ์ในช่อง “อื่นๆ” ของใบลา
              </p>
            </Step>

            {/* 2. unit + period */}
            <Step title="2. รูปแบบและช่วงเวลา">
              <div role="tablist" aria-label="รูปแบบการลา" className="inline-flex flex-wrap gap-1 rounded-xl p-1" style={{ background: "#EEF2F8" }}>
                {UNIT_TABS.map((u) => {
                  const ok = allowedUnits(type).includes(u.unit);
                  const on = unit === u.unit;
                  return (
                    <button
                      key={u.unit}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      disabled={!ok}
                      onClick={() => setUnit(u.unit)}
                      className={`min-h-[40px] rounded-[9px] px-5 text-[14px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
                      style={on ? { background: "#FFFFFF", color: NAVY, fontWeight: 700, boxShadow: "0 1px 3px rgba(13,27,42,0.12)" } : { color: SLATE }}
                      data-testid="leave-unit"
                      data-unit={u.unit}
                    >
                      {u.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:max-w-[640px]">
                <DateField id="leave-start" label={unit === "full_day" ? "ตั้งแต่วันที่" : "วันที่"} value={startDate} onChange={(v) => { setStartDate(v); if (unit === "full_day" && (!endDate || endDate < v)) setEndDate(v); }} testid="leave-start" />
                {unit === "full_day" && <DateField id="leave-end" label="ถึงวันที่" value={endDate} min={startDate || undefined} onChange={setEndDate} testid="leave-end" />}
                {unit === "half_day" && (
                  <div>
                    <span className="mb-1 block text-[13px] font-medium" style={{ color: SLATE }}>ช่วง</span>
                    <div className="flex gap-2" role="radiogroup" aria-label="ช่วงครึ่งวัน">
                      {[["morning", "เช้า", settings.halfDayMorning], ["afternoon", "บ่าย", settings.halfDayAfternoon]].map(([p, label, range]) => (
                        <button
                          key={p}
                          type="button"
                          role="radio"
                          aria-checked={halfDayPeriod === p}
                          onClick={() => setHalfDayPeriod(p)}
                          className={`min-h-[44px] flex-1 rounded-xl px-3 text-[14px] ${FOCUS}`}
                          style={halfDayPeriod === p ? { border: `2px solid ${BLUE}`, background: "#F0F5FF", color: BLUE, fontWeight: 600 } : { border: "1px solid #D6E0F0", color: NAVY }}
                          data-testid="leave-half"
                          data-period={p}
                        >
                          {label} <span className="text-[12px] font-normal" style={{ color: SLATE }}>{range}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {unit === "hourly" && (
                  <div className="grid grid-cols-2 gap-2">
                    <TimeField id="leave-from" label="เวลาเริ่ม" value={startTime} onChange={setStartTime} testid="leave-time-start" />
                    <TimeField id="leave-to" label="ถึงเวลา" value={endTime} onChange={setEndTime} testid="leave-time-end" />
                  </div>
                )}
              </div>

              {/* summary */}
              <div className="mt-4 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:gap-6" style={{ background: "#F0F5FF", border: "1px solid #D5E3FF" }} data-testid="leave-summary">
                <div className="shrink-0">
                  <p className="text-[12px]" style={{ color: SLATE }}>จำนวนที่ลา</p>
                  <p className="text-[28px] font-bold leading-tight" style={{ color: BLUE }} data-testid="leave-total" data-hours={counted ? counted.totalHours : ""}>
                    {counted ? amount(counted.totalHours, unit) : "–"}
                  </p>
                </div>
                <div className="min-w-0 space-y-1 text-[13px]" style={{ color: SLATE }}>
                  {!count && <p>เลือก{unit === "hourly" ? "วันที่และเวลา" : "วันที่"}เพื่อคำนวณจำนวนวันลา</p>}
                  {count?.error && <p className="font-medium" style={{ color: RED }} role="alert" data-testid="leave-count-error">{count.error}</p>}
                  {counted && unit === "full_day" && (
                    <p className="font-semibold" style={{ color: NAVY }} data-testid="leave-selected-line">
                      เลือกไว้ {calendarDays(startDate, endDate)} วัน · ไม่นับวันหยุด {counted.excluded.length} วัน
                    </p>
                  )}
                  {counted && unit !== "full_day" && (
                    <p className="font-semibold" style={{ color: NAVY }}>
                      {unit === "half_day" ? `ครึ่งวัน${halfDayPeriod === "afternoon" ? "บ่าย" : "เช้า"}` : `${startTime}–${endTime}`} · {thaiDateShort(startDate)}
                    </p>
                  )}
                  {excludedGroups.map((g) => (
                    <p key={g.reason} data-testid="leave-excluded-line">
                      {g.dates.map((d) => thaiDateShort(d, { weekday: true }).replace(/ \d{4}$/, "")).join(" · ")} — {g.reason}
                    </p>
                  ))}
                  {counted && type && remaining !== undefined && (
                    remaining === null ? (
                      <p className="font-semibold" style={{ color: GREEN }}>{type.nameTh}ไม่จำกัดจำนวนวัน</p>
                    ) : (
                      <p className="font-semibold" style={{ color: overQuota ? RED : GREEN }} data-testid="leave-after-line" data-over={overQuota ? "1" : "0"}>
                        {overQuota
                          ? `เกินวันลาคงเหลือ — ${type.nameTh}เหลือ ${amount(Math.max(remaining, 0))} (ปีงบ ${fiscalYearLabel(fy)})`
                          : `${type.nameTh}คงเหลือหลังอนุมัติ: ${amount(after)}`}
                      </p>
                    )
                  )}
                </div>
              </div>
            </Step>

            {/* 3. details */}
            <Step title="3. รายละเอียด">
              <div className="grid gap-3 sm:grid-cols-2 xl:max-w-[640px]">
                <ReadOnly label="เรื่อง" value={subject || "-"} hint="ระบบตั้งจากประเภทการลา" testid="leave-subject" />
                <ReadOnly label="เรียน" value={addressedTo || "-"} hint={approval.mode === "auto" ? "อนุมัติอัตโนมัติ — ส่งตรงถึงฝ่ายบุคคล" : "ผู้อนุมัติ (1) ของคุณ"} testid="leave-addressed" />
              </div>
              <div className="mt-3 xl:max-w-[640px]">
                <label htmlFor="leave-reason" className="mb-1 block text-[13px] font-medium" style={{ color: SLATE }}>เหตุผลการลา <span style={{ color: RED }}>*</span></label>
                <textarea id="leave-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} className={`${INPUT} h-auto py-2.5`} data-testid="leave-reason" />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:max-w-[640px]">
                <div>
                  <label htmlFor="leave-contact" className="mb-1 block text-[13px] font-medium" style={{ color: SLATE }}>ระหว่างลาติดต่อได้ที่ <span style={{ color: RED }}>*</span></label>
                  <input id="leave-contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} className={INPUT} data-testid="leave-contact" />
                </div>
                <div>
                  <span className="mb-1 block text-[13px] font-medium" style={{ color: SLATE }}>
                    แนบไฟล์ {attachRequired ? <span style={{ color: RED }}>* (ลา{attachFrom} วันขึ้นไปต้องแนบ)</span> : "(ถ้ามี)"}
                  </span>
                  <LeaveAttachments value={attachments} onChange={setAttachments} required={attachRequired} />
                </div>
              </div>
            </Step>

            {/* footer */}
            <div className="mt-6 border-t pt-5" style={{ borderColor: LINE }}>
              {error && (
                <p role="alert" className="mb-3 rounded-xl px-4 py-2.5 text-[14px] font-medium" style={{ background: "#FEF2F2", color: RED, border: "1px solid #FECACA" }} data-testid="leave-submit-error">
                  {error}
                </p>
              )}
              {blockedApprovers && (
                <p role="alert" className="mb-3 rounded-xl px-4 py-2.5 text-[14px] font-medium" style={{ background: "#FEF2F2", color: RED, border: "1px solid #FECACA" }} data-testid="leave-no-approver">
                  ยังไม่ได้กำหนดผู้อนุมัติ — ติดต่อฝ่ายบุคคล
                </p>
              )}
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  {ctx.profileSignature ? (
                    <div className="flex items-center gap-3" data-testid="leave-profile-signature">
                      <span className="grid h-[52px] w-[110px] shrink-0 place-items-center rounded-xl bg-white p-1" style={{ border: `1px solid ${LINE}` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ctx.profileSignature} alt="ลายเซ็นของฉัน" className="max-h-full max-w-full" />
                      </span>
                      <span>
                        <span className="block text-[14px] font-semibold" style={{ color: NAVY }}>ลงชื่อด้วยลายเซ็นในโปรไฟล์</span>
                        <span className="block text-[12px]" style={{ color: SLATE }}>เปลี่ยนลายเซ็นได้ที่หน้าโปรไฟล์ของฉัน</span>
                      </span>
                    </div>
                  ) : (
                    <MySignaturePicker label="ลายเซ็นผู้ขอลา" onChange={setSig} />
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setPreview(true)} className={BTN_SECONDARY} data-testid="leave-preview">
                    <Eye size={16} aria-hidden /> ดูตัวอย่างใบลา
                  </button>
                  <button type="button" onClick={submit} disabled={!canSubmit} className={BTN_PRIMARY} data-testid="leave-submit" title={missing.length ? `ยังขาด: ${missing.join(", ")}` : undefined}>
                    {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : editing ? <RotateCcw size={16} aria-hidden /> : <Send size={16} aria-hidden />}
                    {editing ? "ส่งใหม่" : "ส่งใบลา"}
                  </button>
                </div>
              </div>
              {missing.length > 0 && !submitting && (
                <p className="mt-2 text-right text-[12px]" style={{ color: MUTED }} data-testid="leave-missing">ยังขาด: {missing.join(", ")}</p>
              )}
            </div>
          </section>
        </div>

        {/* right column */}
        <aside className="space-y-4">
          <ApprovalCard approval={approval} />
          <BalanceCard ctx={ctx} amount={amount} />
          <section className="rounded-[18px] bg-white p-5" style={{ border: `1px solid ${LINE}` }} data-testid="leave-last">
            <h3 className="text-[16px] font-bold" style={{ color: NAVY }}>ลาครั้งล่าสุด</h3>
            <p className="mt-1.5 text-[15px] font-semibold" style={{ color: NAVY }}>
              {ctx.lastLeave
                ? `${ctx.lastLeave.leaveTypeName} · ${thaiDateRange(ctx.lastLeave.startDate, ctx.lastLeave.endDate)} · ${amount(ctx.lastLeave.totalHours, ctx.lastLeave.unit)}`
                : "ยังไม่มีการลาที่อนุมัติแล้ว"}
            </p>
            <p className="mt-1 text-[12px]" style={{ color: MUTED }}>พิมพ์ลงช่อง “ข้าพเจ้าได้…ครั้งล่าสุด” ของใบลาให้อัตโนมัติ</p>
          </section>
        </aside>
      </div>

      {preview && (
        <Dialog
          title="ตัวอย่างใบลา"
          onClose={() => setPreview(false)}
          width={560}
          testid="leave-preview-dialog"
          footer={<button type="button" onClick={() => setPreview(false)} className={BTN_SECONDARY}>ปิด</button>}
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
            {[
              ["เรื่อง", subject || "-"],
              ["เรียน", addressedTo || "-"],
              ["ข้าพเจ้า", employee.name],
              ["ตำแหน่ง", employee.position || "-"],
              ["แผนก", employee.department || "-"],
              ["ขอลา", type?.nameTh || "-"],
              ["ช่วงเวลา", startDate ? leavePeriodText({ startDate, endDate: unit === "full_day" ? endDate || startDate : startDate, unit, halfDayPeriod, startTime, endTime }) : "-"],
              ["จำนวน", counted ? amount(counted.totalHours, unit) : "-"],
              ["เหตุผล", reason.trim() || "-"],
              ["ระหว่างลาติดต่อได้ที่", contact.trim() || "-"],
              ["ลาครั้งล่าสุด", ctx.lastLeave ? `${ctx.lastLeave.leaveTypeName} · ${thaiDateRange(ctx.lastLeave.startDate, ctx.lastLeave.endDate)} · ${amount(ctx.lastLeave.totalHours, ctx.lastLeave.unit)}` : "-"],
              ["ไฟล์แนบ", uploadsDone.length ? `${uploadsDone.length} ไฟล์` : "-"],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt style={{ color: SLATE }}>{k}</dt>
                <dd className="min-w-0 break-words" style={{ color: NAVY }}>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[12px]" style={{ color: MUTED }}>ตัวอย่างแบบฟอร์มฉบับเต็ม (QF-HRD-001) จะเปิดใช้ในรอบถัดไป</p>
        </Dialog>
      )}

      {withdrawing && (
        <Dialog
          title="ยกเลิกใบลา"
          onClose={() => !withdrawBusy && setWithdrawing(false)}
          testid="leave-withdraw-dialog"
          footer={
            <>
              <button type="button" onClick={() => setWithdrawing(false)} disabled={withdrawBusy} className={BTN_SECONDARY}>ปิด</button>
              <button type="button" onClick={withdraw} disabled={withdrawBusy} className={BTN_DANGER} data-testid="leave-withdraw-confirm">
                {withdrawBusy && <Loader2 size={15} className="animate-spin" aria-hidden />} ยกเลิกใบลา
              </button>
            </>
          }
        >
          <p className="text-[14px]" style={{ color: NAVY }}>ยกเลิกใบลานี้? ใบลาจะเปลี่ยนเป็น “ยกเลิกแล้ว” และไม่ต้องมีผู้อนุมัติ</p>
        </Dialog>
      )}
    </div>
  );
}

function Step({ title, children }) {
  return (
    <div className="mt-6">
      <h3 className="mb-3 text-[15px] font-bold" style={{ color: NAVY }}>{title}</h3>
      {children}
    </div>
  );
}

function DateField({ id, label, value, onChange, min, testid }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium" style={{ color: SLATE }}>{label}</label>
      <ThaiDatePicker id={id} value={value} min={min} onChange={onChange} testid={testid} />
    </div>
  );
}

function TimeField({ id, label, value, onChange, testid }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium" style={{ color: SLATE }}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={INPUT} data-testid={testid}>
        <option value="">--:--</option>
        {TIMES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  );
}

function ReadOnly({ label, value, hint, testid }) {
  return (
    <div>
      <span className="mb-1 block text-[13px] font-medium" style={{ color: SLATE }}>{label}</span>
      <div className="flex min-h-[44px] items-center rounded-xl px-3 text-[14px]" style={{ background: "#F1F4F8", color: NAVY }} data-testid={testid}>{value}</div>
      <p className="mt-1 text-[12px]" style={{ color: MUTED }}>{hint}</p>
    </div>
  );
}

function PersonRow({ person, label }) {
  return (
    <div className="flex items-center gap-3" data-testid="leave-approver-row">
      <PersonAvatar src={person.photoUrl} crop={person.photoCrop} name={person.name} size={36} />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold" style={{ color: NAVY }}>{person.name}</p>
        <p className="text-[12px]" style={{ color: SLATE }}>{label}</p>
      </div>
    </div>
  );
}

function ApprovalCard({ approval }) {
  const { mode, approvers, hrSigners } = approval;
  return (
    <section className="rounded-[18px] bg-white p-5" style={{ border: `1px solid ${LINE}` }} data-testid="leave-approval" data-mode={mode}>
      <h3 className="mb-3 text-[16px] font-bold" style={{ color: NAVY }}>ลำดับการอนุมัติ</h3>
      <div className="space-y-3">
        {mode === "auto" && (
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "#FEF3C7", color: "#92400E" }}><Zap size={17} aria-hidden /></span>
            <p className="text-[14px] font-semibold" style={{ color: NAVY }}>อนุมัติอัตโนมัติ — ส่งตรงถึงฝ่ายบุคคล</p>
          </div>
        )}
        {mode === "missing" && (
          <p className="rounded-xl px-3 py-2.5 text-[13px] font-medium" style={{ background: "#FEF2F2", color: RED }}>ยังไม่ได้กำหนดผู้อนุมัติ — ติดต่อฝ่ายบุคคล</p>
        )}
        {approvers.map((p, i) => (
          <PersonRow key={p._id} person={p} label={`ผู้อนุมัติ (${i + 1})`} />
        ))}
        {mode === "either" && (
          <p className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px]" style={{ background: "#F5F7FB", color: SLATE }}>
            <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
            คนใดคนหนึ่งอนุมัติได้ — อีกคนกด “รับทราบ” ภายหลัง และไม่ต้องรอก่อนส่งต่อ HR
          </p>
        )}
        <div className="flex items-center gap-3 pt-1">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={{ background: "#DCE6F7", color: BLUE }}>HR</span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold" style={{ color: NAVY }}>ฝ่ายบุคคล</p>
            <p className="text-[12px]" style={{ color: SLATE }} data-testid="leave-hr-signer">
              {hrSigners.length ? `ผู้ลงนาม: ${hrSigners.join(", ")}` : "ยังไม่ได้กำหนดผู้ลงนาม"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function BalanceCard({ ctx, amount }) {
  const fy = ctx.currentFiscalYear;
  const hpd = ctx.settings.hoursPerDay;
  const rows = ctx.types
    .map((t) => ({ t, q: ctx.quotas[fy]?.[t._id] }))
    .filter(({ q }) => q && q.quotaDays !== null);
  return (
    <section className="rounded-[18px] bg-white p-5" style={{ border: `1px solid ${LINE}` }} data-testid="leave-balance">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[16px] font-bold" style={{ color: NAVY }}>วันลาคงเหลือ</h3>
        <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: "#EEF4FF", color: BLUE }}>ปีงบ {fiscalYearLabel(fy)}</span>
      </div>
      {!rows.length ? (
        <p className="text-[13px]" style={{ color: SLATE }}>ไม่มีประเภทการลาที่จำกัดจำนวนวัน</p>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ t, q }) => {
            const total = q.quotaDays * hpd;
            const pct = total > 0 ? Math.min(100, (q.usedHours / total) * 100) : 100;
            return (
              <li key={t._id} data-testid="leave-balance-row">
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-medium" style={{ color: NAVY }}>{t.nameTh}</span>
                  <span style={{ color: SLATE }}>ใช้ {amount(q.usedHours)} / {amount(total)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "#EEF2F8" }} role="progressbar" aria-label={`${t.nameTh} ใช้ไป`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BLUE }} />
                </div>
                {q.pendingHours > 0 && <p className="mt-1 text-[11px]" style={{ color: MUTED }}>รออนุมัติ {amount(q.pendingHours)}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
