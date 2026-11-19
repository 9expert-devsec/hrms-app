"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { BLUE, BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, FOCUS, INPUT, LINE, NAVY, SLATE } from "../../../../../../components/hr/hrUi";
import { HOLIDAY_KINDS, HOLIDAY_KIND_LABELS, WEEKDAY_TOGGLES, validateHoliday } from "@/lib/leaveRules";
import { thaiDateShort } from "@/lib/leave/format";
import Dialog from "./Dialog";
import { FieldLabel, SectionCard, callApi } from "./shared";

const KIND_CHIP = {
  public: { background: "#EEF4FF", color: BLUE },
  company: { background: "#F3E8FF", color: "#6B21A8" },
};

/**
 * ตั้งค่าการลา › วันหยุด — holidays by calendar year and the weekly days off.
 * Leave counting skips both (lib/leave/countLeave.js).
 */
export default function HolidaysTab({ initialYear, initialHolidays, weeklyDaysOff, setWeeklyDaysOff, notify }) {
  const [year, setYear] = useState(initialYear);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // { holiday?, form }
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [savingDays, setSavingDays] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let alive = true;
    setLoading(true);
    callApi(`/api/leave-settings/holidays?year=${year}`)
      .then((j) => alive && setHolidays(j.holidays))
      .catch((e) => alive && notify(e.message, "error"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const years = [initialYear - 1, initialYear, initialYear + 1, initialYear + 2];

  async function toggleDay(d) {
    const prev = weeklyDaysOff;
    const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b);
    setWeeklyDaysOff(next);
    setSavingDays(true);
    try {
      const j = await callApi("/api/leave-settings/weekly-days-off", { method: "PUT", body: { weeklyDaysOff: next } });
      setWeeklyDaysOff(j.weeklyDaysOff);
      notify("บันทึกวันหยุดประจำสัปดาห์แล้ว");
    } catch (e) {
      setWeeklyDaysOff(prev);
      notify(e.message, "error");
    } finally {
      setSavingDays(false);
    }
  }

  async function remove() {
    const h = deleting;
    setBusy(true);
    try {
      await callApi(`/api/leave-settings/holidays/${h._id}`, { method: "DELETE" });
      setHolidays((list) => list.filter((x) => x._id !== h._id));
      notify(`ลบ “${h.name}” แล้ว`);
      setDeleting(null);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function saved(h, created) {
    const inYear = h.date.startsWith(`${year}-`);
    setHolidays((list) => {
      const rest = list.filter((x) => x._id !== h._id);
      return (inYear ? [...rest, h] : rest).sort((a, b) => a.date.localeCompare(b.date));
    });
    notify(created ? `เพิ่ม “${h.name}” แล้ว` : `บันทึก “${h.name}” แล้ว`);
    setEditing(null);
  }

  const actions = (h) => (
    <div className="flex items-center justify-end gap-1.5">
      <Small label={`แก้ไข ${h.name}`} onClick={() => setEditing({ holiday: h, form: { date: h.date, name: h.name, kind: h.kind } })} testid="holiday-edit"><Pencil size={16} aria-hidden /></Small>
      <Small label={`ลบ ${h.name}`} danger onClick={() => setDeleting(h)} testid="holiday-delete"><Trash2 size={16} aria-hidden /></Small>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-5">
      <SectionCard title="วันหยุดประจำสัปดาห์" testid="leave-weekly-off">
        <p className="mb-3 text-[13px]" style={{ color: SLATE }}>วันที่เลือกไม่นับเป็นวันลา (เช่น ลาวันศุกร์ถึงวันจันทร์ นับ 2 วัน)</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="วันหยุดประจำสัปดาห์">
          {WEEKDAY_TOGGLES.map(([d, label]) => {
            const on = weeklyDaysOff.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                disabled={savingDays}
                onClick={() => toggleDay(d)}
                className={`inline-flex h-11 min-w-[52px] items-center justify-center rounded-xl px-3 text-[14px] font-semibold disabled:opacity-60 ${FOCUS}`}
                style={on ? { background: NAVY, color: "#FFFFFF", border: `1px solid ${NAVY}` } : { background: "#FFFFFF", color: NAVY, border: "1px solid #D6E0F0" }}
                data-testid="weekday-toggle"
                data-day={d}
                data-on={on ? "1" : "0"}
              >
                {label}
              </button>
            );
          })}
          {savingDays && <Loader2 size={18} className="ml-1 self-center animate-spin" style={{ color: BLUE }} aria-label="กำลังบันทึก" />}
        </div>
      </SectionCard>

      <SectionCard
        title="วันหยุด"
        testid="leave-holidays"
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="ปี" className={`${INPUT} w-auto`} data-testid="holiday-year">
              {years.map((y) => (
                <option key={y} value={y}>{`ปี ${y + 543}`}</option>
              ))}
            </select>
            <button type="button" onClick={() => setEditing({ holiday: null, form: { date: `${year}-01-01`, name: "", kind: "public" } })} className={BTN_PRIMARY} data-testid="holiday-add">
              <Plus size={16} aria-hidden /> เพิ่มวันหยุด
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin" style={{ color: BLUE }} aria-label="กำลังโหลด" /></div>
        ) : !holidays.length ? (
          <p className="rounded-xl px-4 py-8 text-center text-[14px]" style={{ color: SLATE, border: `1px dashed ${LINE}` }} data-testid="holiday-empty">
            ยังไม่มีวันหยุดในปี {year + 543}
          </p>
        ) : (
          <>
            {/* tablet / desktop */}
            <div className="hidden overflow-hidden rounded-xl md:block" style={{ border: `1px solid ${LINE}` }}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="text-[13px]" style={{ background: "#F8FAFD", color: SLATE }}>
                    <th className="px-3 py-3 font-semibold">วันที่</th>
                    <th className="px-3 py-3 font-semibold">ชื่อวันหยุด</th>
                    <th className="px-3 py-3 font-semibold">ประเภท</th>
                    <th className="px-3 py-3"><span className="sr-only">จัดการ</span></th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => (
                    <tr key={h._id} style={{ borderTop: "1px solid #EEF2F8" }} data-testid="holiday-row" data-date={h.date}>
                      <td className="whitespace-nowrap px-3 py-3 text-[14px] font-semibold" style={{ color: NAVY }}>{thaiDateShort(h.date)}</td>
                      <td className="px-3 py-3 text-[14px]" style={{ color: NAVY }}>{h.name}</td>
                      <td className="px-3 py-3"><KindChip kind={h.kind} /></td>
                      <td className="px-3 py-3">{actions(h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* phone */}
            <div className="space-y-2 md:hidden">
              {holidays.map((h) => (
                <div key={h._id} className="flex items-center gap-3 rounded-xl p-3" style={{ border: `1px solid ${LINE}` }} data-testid="holiday-card" data-date={h.date}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold" style={{ color: NAVY }}>{thaiDateShort(h.date)}</p>
                    <p className="text-[14px]" style={{ color: NAVY }}>{h.name}</p>
                    <div className="mt-1"><KindChip kind={h.kind} /></div>
                  </div>
                  {actions(h)}
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {editing && <HolidayDialog editing={editing} onClose={() => setEditing(null)} onSaved={saved} />}

      {deleting && (
        <Dialog
          title="ลบวันหยุด"
          onClose={() => setDeleting(null)}
          testid="holiday-delete-dialog"
          footer={
            <>
              <button type="button" onClick={() => setDeleting(null)} className={BTN_SECONDARY}>ยกเลิก</button>
              <button type="button" onClick={remove} disabled={busy} className={BTN_DANGER} data-testid="holiday-delete-confirm">
                {busy && <Loader2 size={15} className="animate-spin" aria-hidden />} ลบ
              </button>
            </>
          }
        >
          <p className="text-[14px]" style={{ color: NAVY }}>
            ลบ “{deleting.name}” ({thaiDateShort(deleting.date)})? ใบลาที่ส่งไปแล้วไม่เปลี่ยนจำนวนวัน
          </p>
        </Dialog>
      )}
    </div>
  );
}

function HolidayDialog({ editing, onClose, onSaved }) {
  const [form, setForm] = useState(editing.form);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const isNew = !editing.holiday;

  async function save() {
    const checked = validateHoliday(form);
    if (checked.error) return setError({ message: checked.error, field: checked.field });
    setSaving(true);
    setError(null);
    try {
      const j = isNew
        ? await callApi("/api/leave-settings/holidays", { method: "POST", body: checked.value })
        : await callApi(`/api/leave-settings/holidays/${editing.holiday._id}`, { method: "PATCH", body: checked.value });
      onSaved(j.holiday, isNew);
    } catch (e) {
      setError({ message: e.message, field: e.field });
      setSaving(false);
    }
  }

  const bad = (k) => (error?.field === k ? { borderColor: "#EF4444" } : undefined);
  return (
    <Dialog
      title={isNew ? "เพิ่มวันหยุด" : "แก้ไขวันหยุด"}
      onClose={onClose}
      testid="holiday-dialog"
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>ยกเลิก</button>
          <button type="button" onClick={save} disabled={saving} className={BTN_PRIMARY} data-testid="holiday-save">
            {saving && <Loader2 size={15} className="animate-spin" aria-hidden />} บันทึก
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="holiday-date">วันที่</FieldLabel>
          <input id="holiday-date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={INPUT} style={bad("date")} data-testid="holiday-date" />
          {form.date && <p className="mt-1 text-[13px]" style={{ color: SLATE }}>{thaiDateShort(form.date)}</p>}
        </div>
        <div>
          <FieldLabel htmlFor="holiday-name">ชื่อวันหยุด</FieldLabel>
          <input id="holiday-name" value={form.name} maxLength={100} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={INPUT} style={bad("name")} data-testid="holiday-name" />
        </div>
        <fieldset>
          <legend className="mb-1 block text-[13px] font-medium" style={{ color: SLATE }}>ประเภท</legend>
          <div className="flex flex-wrap gap-2">
            {HOLIDAY_KINDS.map((k) => (
              <label key={k} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-3 text-[14px]" style={{ border: `1px solid ${form.kind === k ? BLUE : "#D6E0F0"}`, color: NAVY, background: form.kind === k ? "#F5F8FF" : "#FFFFFF" }}>
                <input type="radio" name="holiday-kind" value={k} checked={form.kind === k} onChange={() => setForm((f) => ({ ...f, kind: k }))} className="accent-[#005CFF]" data-testid={`holiday-kind-${k}`} />
                {HOLIDAY_KIND_LABELS[k]}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-[14px] font-medium" style={{ color: "#B91C1C" }} data-testid="holiday-error">{error.message}</p>}
      </div>
    </Dialog>
  );
}

function KindChip({ kind }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={KIND_CHIP[kind] || KIND_CHIP.public} data-testid="holiday-kind">
      {HOLIDAY_KIND_LABELS[kind] || HOLIDAY_KIND_LABELS.public}
    </span>
  );
}

function Small({ label, onClick, danger, children, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] md:h-9 md:w-9 ${FOCUS}`}
      style={danger ? { background: "#FEF2F2", color: "#B91C1C" } : { background: "#F5F8FF", color: BLUE }}
      data-testid={testid}
    >
      {children}
    </button>
  );
}
