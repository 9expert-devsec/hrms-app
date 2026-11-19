"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Info, Loader2, Plus, Save, Trash2 } from "lucide-react";
import PersonAvatar from "../../../../../../components/PersonAvatar";
import { BLUE, BTN_PRIMARY, BTN_SECONDARY, FOCUS, INPUT, LINE, NAVY, NoAccountPill, SLATE } from "../../../../../../components/hr/hrUi";
import { THAI_MONTHS, fiscalYearLabel, fiscalYearOf, fiscalYearRangeTh, validateGeneralSettings } from "@/lib/leaveRules";
import EmployeePicker from "./EmployeePicker";
import { FieldLabel, SectionCard, callApi } from "./shared";

const FIELDS = ["fiscalYearStartMonth", "hoursPerDay", "workdayStart", "workdayEnd", "halfDayMorning", "halfDayAfternoon"];

/** ตั้งค่าการลา › ทั่วไป — fiscal year, working hours, half days, HR signers. */
export default function GeneralTab({ settings, onSaved, employees, notify }) {
  const [form, setForm] = useState(() => ({ ...settings, hrSigners: [...settings.hrSigners] }));
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null); // { message, field }
  const byId = useMemo(() => new Map(employees.map((e) => [e._id, e])), [employees]);

  const month = Number(form.fiscalYearStartMonth) || 1;
  const fy = fiscalYearOf(new Date(), month);
  const dirty = FIELDS.some((k) => String(form[k]) !== String(settings[k])) || form.hrSigners.join() !== settings.hrSigners.join();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const moveSigner = (i, d) =>
    setForm((f) => {
      const list = [...f.hrSigners];
      [list[i], list[i + d]] = [list[i + d], list[i]];
      return { ...f, hrSigners: list };
    });

  async function save() {
    const checked = validateGeneralSettings(form);
    if (checked.error) {
      setError({ message: checked.error, field: checked.field });
      document.getElementById(`leave-${checked.field}`)?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const j = await callApi("/api/leave-settings", { method: "PUT", body: { ...checked.value, hrSigners: form.hrSigners } });
      onSaved(j.settings);
      setForm({ ...j.settings, hrSigners: [...j.settings.hrSigners] });
      notify("บันทึกการตั้งค่าแล้ว");
    } catch (e) {
      setError({ message: e.message, field: e.field });
    } finally {
      setSaving(false);
    }
  }

  const input = (k, props = {}) => (
    <input
      id={`leave-${k}`}
      value={form[k]}
      onChange={set(k)}
      aria-invalid={error?.field === k || undefined}
      className={INPUT}
      style={error?.field === k ? { borderColor: "#EF4444" } : undefined}
      data-testid={`leave-${k}`}
      {...props}
    />
  );

  return (
    <div className="space-y-4 md:space-y-5" data-testid="leave-general">
      <SectionCard title="ปีงบประมาณและเวลาทำงาน">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel htmlFor="leave-fiscalYearStartMonth">เดือนเริ่มต้นปีงบประมาณ</FieldLabel>
            <select id="leave-fiscalYearStartMonth" value={month} onChange={(e) => setForm((f) => ({ ...f, fiscalYearStartMonth: Number(e.target.value) }))} className={INPUT} data-testid="leave-fiscalYearStartMonth">
              {THAI_MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[13px]" style={{ color: NAVY }} data-testid="leave-fy-line">
              ปีงบประมาณปัจจุบัน: {fiscalYearRangeTh(fy, month)} <span style={{ color: SLATE }}>(ปีงบประมาณ {fiscalYearLabel(fy)})</span>
            </p>
          </div>
          <div>
            <FieldLabel htmlFor="leave-hoursPerDay" hint="(ใช้คำนวณการลารายชั่วโมง)">ชั่วโมงทำงานต่อวัน</FieldLabel>
            {input("hoursPerDay", { type: "number", min: 1, max: 24, step: 0.5, inputMode: "decimal" })}
          </div>
          <div>
            <FieldLabel htmlFor="leave-workdayStart">เวลาเริ่มงาน</FieldLabel>
            {input("workdayStart", { type: "time" })}
          </div>
          <div>
            <FieldLabel htmlFor="leave-workdayEnd">เวลาเลิกงาน</FieldLabel>
            {input("workdayEnd", { type: "time" })}
          </div>
          <div>
            <FieldLabel htmlFor="leave-halfDayMorning" hint="HH:mm–HH:mm">ครึ่งวันเช้า</FieldLabel>
            {input("halfDayMorning", { placeholder: "09:00–12:00", inputMode: "numeric" })}
          </div>
          <div>
            <FieldLabel htmlFor="leave-halfDayAfternoon" hint="HH:mm–HH:mm">ครึ่งวันบ่าย</FieldLabel>
            {input("halfDayAfternoon", { placeholder: "13:00–18:00", inputMode: "numeric" })}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="ผู้ลงนามฝ่ายบุคคล"
        testid="leave-signers"
        aside={
          <button type="button" onClick={() => setPicking(true)} className={BTN_SECONDARY} data-testid="leave-signer-add">
            <Plus size={16} aria-hidden /> เพิ่มผู้ลงนาม
          </button>
        }
      >
        {form.hrSigners.length === 0 && (
          <div role="alert" className="mb-3 flex gap-2 rounded-xl px-4 py-3 text-[14px] font-medium" style={{ background: "#FEF3C7", color: "#92400E" }} data-testid="leave-signers-empty">
            <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0" />
            ยังไม่ได้กำหนดผู้ลงนามฝ่ายบุคคล ใบลาจะค้างที่ขั้นฝ่ายบุคคล
          </div>
        )}
        {form.hrSigners.length > 0 && (
          <ol className="overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }} data-testid="leave-signer-list">
            {form.hrSigners.map((id, i) => {
              const e = byId.get(id);
              return (
                <li key={id} className="flex items-center gap-2.5 px-3 py-2" style={{ borderTop: i ? "1px solid #EEF2F8" : "none" }} data-testid="leave-signer" data-id={id}>
                  <span className="w-5 shrink-0 text-right text-[13px] font-semibold tabular-nums" style={{ color: SLATE }}>{i + 1}</span>
                  <PersonAvatar src={e?.photoUrl} crop={e?.photoCrop} name={e?.name} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[14px] font-semibold" style={{ color: NAVY }}>{e?.name || "ไม่พบพนักงาน"}</span>
                      {e && !e.hasAccount && <NoAccountPill />}
                    </span>
                    <span className="block truncate text-[12px]" style={{ color: SLATE }}>{[e?.departmentCode, e?.position].filter(Boolean).join(" • ")}</span>
                  </span>
                  <IconButton label="เลื่อนขึ้น" disabled={i === 0} onClick={() => moveSigner(i, -1)} testid="leave-signer-up"><ArrowUp size={18} aria-hidden /></IconButton>
                  <IconButton label="เลื่อนลง" disabled={i === form.hrSigners.length - 1} onClick={() => moveSigner(i, 1)} testid="leave-signer-down"><ArrowDown size={18} aria-hidden /></IconButton>
                  <IconButton label={`ลบ ${e?.name || ""} ออกจากผู้ลงนาม`} danger onClick={() => setForm((f) => ({ ...f, hrSigners: f.hrSigners.filter((x) => x !== id) }))} testid="leave-signer-remove"><Trash2 size={17} aria-hidden /></IconButton>
                </li>
              );
            })}
          </ol>
        )}
        <div className="mt-3 flex gap-2 rounded-xl px-4 py-3 text-[13px]" style={{ background: "#EEF4FF", color: NAVY }} data-testid="leave-signer-rule">
          <Info size={16} aria-hidden className="mt-0.5 shrink-0" style={{ color: BLUE }} />
          <span>
            ผู้ลงนามคนใดคนหนึ่งลงนามขั้นฝ่ายบุคคลได้ ผู้ลงนามจะไม่ลงนามใบลาของตัวเอง — ถ้าผู้ขอลาเป็นผู้ลงนาม ผู้ลงนามคนอื่นต้องลงนามแทน
            และถ้าผู้ขอลาเป็นผู้ลงนามเพียงคนเดียว ขั้นฝ่ายบุคคลจะบันทึกเป็น “อนุมัติด้วยตนเอง” และระบุไว้บนเอกสาร
          </span>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {error && <p role="alert" className="mr-auto text-[14px] font-medium" style={{ color: "#B91C1C" }} data-testid="leave-general-error">{error.message}</p>}
        {!error && dirty && <p className="mr-auto text-[13px]" style={{ color: SLATE }}>มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</p>}
        <button type="button" onClick={() => { setForm({ ...settings, hrSigners: [...settings.hrSigners] }); setError(null); }} disabled={!dirty || saving} className={BTN_SECONDARY} data-testid="leave-general-reset">
          ยกเลิกการแก้ไข
        </button>
        <button type="button" onClick={save} disabled={!dirty || saving} className={BTN_PRIMARY} data-testid="leave-general-save">
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />} บันทึก
        </button>
      </div>

      {picking && (
        <EmployeePicker
          title="เพิ่มผู้ลงนามฝ่ายบุคคล"
          employees={employees}
          exclude={form.hrSigners}
          onClose={() => setPicking(false)}
          onPick={(e) => {
            setForm((f) => ({ ...f, hrSigners: [...f.hrSigners, e._id] }));
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function IconButton({ label, onClick, disabled, danger, children, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] disabled:opacity-30 ${FOCUS}`}
      style={danger ? { background: "#FEF2F2", color: "#B91C1C" } : { background: "#F5F8FF", color: BLUE }}
      data-testid={testid}
    >
      {children}
    </button>
  );
}
