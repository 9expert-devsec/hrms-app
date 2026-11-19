"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { BLUE, BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, FOCUS, INPUT, LINE, NAVY, SLATE } from "../../../../../../components/hr/hrUi";
import { FORM_CATEGORIES, FORM_CATEGORY_LABELS, LEAVE_UNITS, UNIT_LABELS, validateLeaveType } from "@/lib/leaveRules";
import Dialog from "./Dialog";
import { FieldLabel, SectionCard, callApi, fmtDays } from "./shared";

const EMPTY = { nameTh: "", formCategory: "other", units: ["day"], defaultQuotaDays: "", requiresAttachmentFromDays: "", isActive: true };

/** ตั้งค่าการลา › ประเภทการลา — HR's list of leave types. */
export default function TypesTab({ types, setTypes, notify }) {
  const [editing, setEditing] = useState(null); // { type?, form }
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(null);

  async function move(i, d) {
    const ids = types.map((t) => t._id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    setBusy(`move-${types[i]._id}`);
    try {
      const j = await callApi("/api/leave-settings/types/order", { method: "PUT", body: { ids } });
      setTypes(j.types);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(t) {
    setBusy(`toggle-${t._id}`);
    try {
      const j = await callApi(`/api/leave-settings/types/${t._id}`, { method: "PUT", body: { ...t, isActive: !t.isActive } });
      setTypes((list) => list.map((x) => (x._id === t._id ? j.type : x)));
      notify(j.type.isActive ? `เปิดใช้งาน “${t.nameTh}” แล้ว` : `ปิดใช้งาน “${t.nameTh}” แล้ว`);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const t = deleting;
    setBusy(`delete-${t._id}`);
    try {
      await callApi(`/api/leave-settings/types/${t._id}`, { method: "DELETE" });
      setTypes((list) => list.filter((x) => x._id !== t._id));
      notify(`ลบ “${t.nameTh}” แล้ว`);
      setDeleting(null);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  const actions = (t, i) => (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Small label="เลื่อนขึ้น" disabled={i === 0 || !!busy} onClick={() => move(i, -1)} testid="type-up"><ArrowUp size={17} aria-hidden /></Small>
      <Small label="เลื่อนลง" disabled={i === types.length - 1 || !!busy} onClick={() => move(i, 1)} testid="type-down"><ArrowDown size={17} aria-hidden /></Small>
      <Small label={`แก้ไข ${t.nameTh}`} onClick={() => setEditing({ type: t, form: toForm(t) })} testid="type-edit"><Pencil size={16} aria-hidden /></Small>
      <Small label={t.isActive ? `ปิดใช้งาน ${t.nameTh}` : `เปิดใช้งาน ${t.nameTh}`} disabled={!!busy} onClick={() => toggle(t)} testid="type-toggle"><Power size={16} aria-hidden /></Small>
      {!t.isSystem && <Small label={`ลบ ${t.nameTh}`} danger disabled={!!busy} onClick={() => setDeleting(t)} testid="type-delete"><Trash2 size={16} aria-hidden /></Small>}
    </div>
  );

  return (
    <SectionCard
      title="ประเภทการลา"
      testid="leave-types"
      aside={
        <button type="button" onClick={() => setEditing({ type: null, form: { ...EMPTY } })} className={BTN_PRIMARY} data-testid="type-add">
          <Plus size={16} aria-hidden /> เพิ่มประเภทการลา
        </button>
      }
    >
      {/* tablet / desktop */}
      <div className="hidden overflow-hidden rounded-xl md:block" style={{ border: `1px solid ${LINE}` }}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-[13px]" style={{ background: "#F8FAFD", color: SLATE }}>
              <th className="px-3 py-3 font-semibold">ชื่อ</th>
              <th className="px-3 py-3 font-semibold">หมวดในแบบฟอร์ม</th>
              <th className="px-3 py-3 font-semibold">หน่วยที่ลาได้</th>
              <th className="px-3 py-3 font-semibold">โควตาเริ่มต้น</th>
              <th className="px-3 py-3 font-semibold">ต้องแนบเอกสารเมื่อลาตั้งแต่</th>
              <th className="px-3 py-3 font-semibold">สถานะ</th>
              <th className="px-3 py-3"><span className="sr-only">จัดการ</span></th>
            </tr>
          </thead>
          <tbody>
            {types.map((t, i) => (
              <tr key={t._id} style={{ borderTop: "1px solid #EEF2F8" }} data-testid="type-row" data-name={t.nameTh}>
                <td className="px-3 py-3 text-[14px] font-semibold" style={{ color: NAVY }}>
                  {t.nameTh}
                  {t.isSystem && <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#EEF4FF", color: BLUE }}>ระบบ</span>}
                </td>
                <td className="px-3 py-3 text-[14px]" style={{ color: NAVY }}>{FORM_CATEGORY_LABELS[t.formCategory]}</td>
                <td className="px-3 py-3"><Units units={t.units} /></td>
                <td className="px-3 py-3 text-[14px]" style={{ color: NAVY }} data-testid="type-quota">{fmtDays(t.defaultQuotaDays)}</td>
                <td className="px-3 py-3 text-[14px]" style={{ color: NAVY }}>{t.requiresAttachmentFromDays === null ? "—" : fmtDays(t.requiresAttachmentFromDays)}</td>
                <td className="px-3 py-3"><StatusPill active={t.isActive} /></td>
                <td className="px-3 py-3">{actions(t, i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* phone */}
      <div className="space-y-3 md:hidden">
        {types.map((t, i) => (
          <div key={t._id} className="space-y-2 rounded-xl p-4" style={{ border: `1px solid ${LINE}` }} data-testid="type-card" data-name={t.nameTh}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold" style={{ color: NAVY }}>{t.nameTh}</span>
              {t.isSystem && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#EEF4FF", color: BLUE }}>ระบบ</span>}
              <StatusPill active={t.isActive} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
              <dt style={{ color: SLATE }}>หมวดในแบบฟอร์ม</dt><dd style={{ color: NAVY }}>{FORM_CATEGORY_LABELS[t.formCategory]}</dd>
              <dt style={{ color: SLATE }}>หน่วยที่ลาได้</dt><dd><Units units={t.units} /></dd>
              <dt style={{ color: SLATE }}>โควตาเริ่มต้น</dt><dd style={{ color: NAVY }}>{fmtDays(t.defaultQuotaDays)}</dd>
              <dt style={{ color: SLATE }}>แนบเอกสารเมื่อลาตั้งแต่</dt><dd style={{ color: NAVY }}>{t.requiresAttachmentFromDays === null ? "—" : fmtDays(t.requiresAttachmentFromDays)}</dd>
            </dl>
            {actions(t, i)}
          </div>
        ))}
      </div>

      {editing && (
        <TypeDialog
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={(type, created) => {
            setTypes((list) => (created ? [...list, type] : list.map((x) => (x._id === type._id ? type : x))));
            notify(created ? `เพิ่ม “${type.nameTh}” แล้ว` : `บันทึก “${type.nameTh}” แล้ว`);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <Dialog
          title="ลบประเภทการลา"
          onClose={() => setDeleting(null)}
          testid="type-delete-dialog"
          footer={
            <>
              <button type="button" onClick={() => setDeleting(null)} className={BTN_SECONDARY}>ยกเลิก</button>
              <button type="button" onClick={remove} disabled={!!busy} className={BTN_DANGER} data-testid="type-delete-confirm">
                {busy && <Loader2 size={15} className="animate-spin" aria-hidden />} ลบ
              </button>
            </>
          }
        >
          <p className="text-[14px]" style={{ color: NAVY }}>
            ลบ “{deleting.nameTh}” และโควตาของประเภทนี้ทั้งหมด? ลบได้เฉพาะประเภทที่ยังไม่มีใบลาใช้
          </p>
        </Dialog>
      )}
    </SectionCard>
  );
}

const toForm = (t) => ({
  nameTh: t.nameTh,
  formCategory: t.formCategory,
  units: [...t.units],
  defaultQuotaDays: t.defaultQuotaDays ?? "",
  requiresAttachmentFromDays: t.requiresAttachmentFromDays ?? "",
  isActive: t.isActive,
});

function TypeDialog({ editing, onClose, onSaved }) {
  const [form, setForm] = useState(editing.form);
  const [unlimited, setUnlimited] = useState(editing.type ? editing.type.defaultQuotaDays === null : false);
  const [noAttach, setNoAttach] = useState(editing.type ? editing.type.requiresAttachmentFromDays === null : true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const isNew = !editing.type;

  async function save() {
    const body = { ...form, defaultQuotaDays: unlimited ? null : form.defaultQuotaDays === "" ? undefined : form.defaultQuotaDays, requiresAttachmentFromDays: noAttach ? null : form.requiresAttachmentFromDays };
    if (!unlimited && form.defaultQuotaDays === "") return setError({ message: "กรุณาระบุโควตาเริ่มต้น หรือเลือก ไม่จำกัด", field: "defaultQuotaDays" });
    if (!noAttach && form.requiresAttachmentFromDays === "") return setError({ message: "กรุณาระบุจำนวนวัน หรือเลือก ไม่ต้องแนบ", field: "requiresAttachmentFromDays" });
    const checked = validateLeaveType(body);
    if (checked.error) return setError({ message: checked.error, field: checked.field });
    setSaving(true);
    setError(null);
    try {
      const j = isNew
        ? await callApi("/api/leave-settings/types", { method: "POST", body: checked.value })
        : await callApi(`/api/leave-settings/types/${editing.type._id}`, { method: "PUT", body: checked.value });
      onSaved(j.type, isNew);
    } catch (e) {
      setError({ message: e.message, field: e.field });
      setSaving(false);
    }
  }

  const bad = (k) => (error?.field === k ? { borderColor: "#EF4444" } : undefined);
  return (
    <Dialog
      title={isNew ? "เพิ่มประเภทการลา" : `แก้ไข ${editing.type.nameTh}`}
      onClose={onClose}
      testid="type-dialog"
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>ยกเลิก</button>
          <button type="button" onClick={save} disabled={saving} className={BTN_PRIMARY} data-testid="type-save">
            {saving && <Loader2 size={15} className="animate-spin" aria-hidden />} บันทึก
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="type-name">ชื่อประเภทการลา</FieldLabel>
          <input id="type-name" value={form.nameTh} onChange={(e) => setForm((f) => ({ ...f, nameTh: e.target.value }))} maxLength={60} className={INPUT} style={bad("nameTh")} data-testid="type-name" />
        </div>
        <div>
          <FieldLabel htmlFor="type-category" hint="(ช่องที่ติ๊กในแบบฟอร์มใบลา และแถวในตารางสถิติ)">หมวดในแบบฟอร์ม</FieldLabel>
          <select id="type-category" value={form.formCategory} onChange={(e) => setForm((f) => ({ ...f, formCategory: e.target.value }))} className={INPUT} data-testid="type-category">
            {FORM_CATEGORIES.map((c) => (
              <option key={c} value={c}>{FORM_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className="mb-1 text-[13px] font-medium" style={{ color: SLATE }}>หน่วยที่ลาได้</legend>
          <div className="flex flex-wrap gap-2">
            {LEAVE_UNITS.map((u) => {
              const on = form.units.includes(u);
              return (
                <label key={u} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-3 text-[14px]" style={{ border: `1px solid ${on ? BLUE : "#D6E0F0"}`, background: on ? "#EEF4FF" : "#FFFFFF", color: NAVY }}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setForm((f) => ({ ...f, units: on ? f.units.filter((x) => x !== u) : LEAVE_UNITS.filter((x) => x === u || f.units.includes(x)) }))}
                    className="h-4 w-4 accent-[#005CFF]"
                    data-testid={`type-unit-${u}`}
                  />
                  {UNIT_LABELS[u]}
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="type-quota" hint="(วัน)">โควตาเริ่มต้นต่อปี</FieldLabel>
            <input id="type-quota" type="number" min={0} step={0.5} inputMode="decimal" disabled={unlimited} value={unlimited ? "" : form.defaultQuotaDays} onChange={(e) => setForm((f) => ({ ...f, defaultQuotaDays: e.target.value }))} className={`${INPUT} disabled:bg-[#F5F7FB]`} style={bad("defaultQuotaDays")} data-testid="type-quota-input" />
            <Check label="ไม่จำกัด" checked={unlimited} onChange={setUnlimited} testid="type-quota-unlimited" />
          </div>
          <div>
            <FieldLabel htmlFor="type-attach" hint="(วันขึ้นไป)">ต้องแนบเอกสารเมื่อลาตั้งแต่</FieldLabel>
            <input id="type-attach" type="number" min={0} step={0.5} inputMode="decimal" disabled={noAttach} value={noAttach ? "" : form.requiresAttachmentFromDays} onChange={(e) => setForm((f) => ({ ...f, requiresAttachmentFromDays: e.target.value }))} className={`${INPUT} disabled:bg-[#F5F7FB]`} style={bad("requiresAttachmentFromDays")} data-testid="type-attach-input" />
            <Check label="ไม่ต้องแนบ" checked={noAttach} onChange={setNoAttach} testid="type-attach-none" />
          </div>
        </div>
        {error && <p role="alert" className="text-[14px] font-medium" style={{ color: "#B91C1C" }} data-testid="type-error">{error.message}</p>}
      </div>
    </Dialog>
  );
}

function Check({ label, checked, onChange, testid }) {
  return (
    <label className="mt-1.5 inline-flex min-h-[36px] cursor-pointer items-center gap-2 text-[13px]" style={{ color: NAVY }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#005CFF]" data-testid={testid} />
      {label}
    </label>
  );
}

function Units({ units }) {
  return (
    <span className="flex flex-wrap gap-1">
      {units.map((u) => (
        <span key={u} className="rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: "#F1F4F8", color: NAVY }}>{UNIT_LABELS[u]}</span>
      ))}
    </span>
  );
}

function StatusPill({ active }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={active ? { background: "#DCFCE7", color: "#166534" } : { background: "#F1F4F8", color: SLATE }} data-testid="type-status">
      {active ? "ใช้งาน" : "ปิดใช้งาน"}
    </span>
  );
}

function Small({ label, onClick, disabled, danger, children, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] disabled:opacity-30 md:h-9 md:w-9 ${FOCUS}`}
      style={danger ? { background: "#FEF2F2", color: "#B91C1C" } : { background: "#F5F8FF", color: BLUE }}
      data-testid={testid}
    >
      {children}
    </button>
  );
}
