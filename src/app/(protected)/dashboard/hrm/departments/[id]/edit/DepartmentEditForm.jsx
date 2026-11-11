"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import NoAccountBadge from "../../../../../../../components/NoAccountBadge";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, INPUT } from "../../../../../../../components/hr/hrUi";
import { employeeDisplayName } from "@/lib/employeeName";

/* ── design tokens ─────────────────────────────────── */
const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const SLATE = "#5E6A7E";
const ICE = "#F8FAFD";

const INPUT_CLS = `mt-1 ${INPUT}`;
const INPUT_STYLE = undefined;
const SECTION = { background: "#FFFFFF", border: "1px solid #E3EAF5", borderRadius: "18px" };

export default function DepartmentEditForm({ initial, employeeCount, eligibleHeads = [], canClearHead = false }) {
  const router = useRouter();

  // --- form states ---
  const [name, setName] = useState(initial?.name || "");
  const [code, setCode] = useState(initial?.code || "");
  const [color, setColor] = useState(initial?.color || "#6366f1");
  const [empIdPrefix, setEmpIdPrefix] = useState(initial?.empIdPrefix || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [levels, setLevels] = useState(initial?.allowedLevels || initial?.allowLevels || []);
  const [positions, setPositions] = useState(() =>
    (initial?.positions || []).map((p) => ({
      ...p,
      _key: p._id || `init-${Math.random().toString(36).slice(2, 9)}`,
    }))
  );

  const [headId, setHeadId] = useState(
    initial?.headOfDepartment?._id || initial?.headOfDepartment || ""
  );
  // Same warning as Settings › กำหนด HOD when the head has no login account.
  const selectedHead = eligibleHeads.find((u) => String(u._id) === String(headId)) || null;
  // Clearing a head is superadmin-only (the API enforces it). The empty
  // option stays for a department that has no head yet, so it still renders.
  const hadHead = !!(initial?.headOfDepartment?._id || initial?.headOfDepartment);
  const showNoHeadOption = canClearHead || !hadHead;

  // --- ui states ---
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleLevel(lv) {
    setLevels((s) => (s.includes(lv) ? s.filter((x) => x !== lv) : [...s, lv]));
  }
  function addPosition() {
    setPositions((s) => [...s, { name: "", level: 1, _key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }]);
  }
  function updatePos(i, key, val) { setPositions((s) => s.map((p, idx) => (idx === i ? { ...p, [key]: val } : p))); }
  function removePos(i) { setPositions((s) => s.filter((_, idx) => idx !== i)); }

  async function doSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/departments/${initial._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(name || "").trim(),
          code: String(code || "").trim().toUpperCase(),
          color,
          empIdPrefix: String(empIdPrefix || "").trim(),
          description,
          allowedLevels: [...levels].sort((a, b) => a - b),
          positions: positions.map(({ name: n, level: l }) => ({
            name: String(n || "").trim(),
            level: Number(l) || 1,
          })),
          headOfDepartment: headId || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "Update failed");
      setConfirmSave(false);
      router.push("/dashboard/hrm/departments");
    } catch (e) {
      alert(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/departments/${initial._id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "Delete failed");
      setConfirmDelete(false);
      router.push("/dashboard/hrm/departments");
    } catch (e) {
      alert(e.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Basic info */}
      <section style={SECTION} className="p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="ชื่อแผนก" value={name} onChange={setName} />
          <Field label="รหัสแผนก (code)" value={code} onChange={(v) => setCode(v.toUpperCase())} />

          {/* Head of Department */}
          <div className="md:col-span-2">
            <Label>เลือกหัวหน้าแผนก</Label>
            <select
              value={headId}
              onChange={(e) => setHeadId(e.target.value)}
              className={INPUT_CLS}
              style={INPUT_STYLE}
            >
              {showNoHeadOption && <option value="">— ไม่กำหนด —</option>}
              {eligibleHeads.map((u) => (
                <option key={u._id} value={u._id}>
                  {employeeDisplayName(u) || u.nickName || "-"}
                  {u.position ? ` • ${u.position}` : ""} {u.level ? ` • L${u.level}` : ""}
                </option>
              ))}
            </select>
            {selectedHead && !selectedHead.userId && <NoAccountBadge className="mt-2" />}
          </div>

          <div>
            <Label>สี</Label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="mt-1 h-11 w-full cursor-pointer rounded-xl border border-[#D6E0F0] bg-white p-1"
            />
          </div>

          <Field label="Emp ID Prefix" value={empIdPrefix} onChange={setEmpIdPrefix} />

          <div className="md:col-span-2">
            <Label>คำอธิบาย</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${INPUT_CLS} h-auto py-2.5`}
              style={{ resize: "vertical" }}
            />
          </div>
        </div>
      </section>

      {/* Levels */}
      <section style={SECTION} className="p-5">
        <h3 className="mb-3 text-[15px] font-semibold" style={{ color: NAVY }}>Level ที่อนุญาต</h3>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => toggleLevel(lv)}
              aria-pressed={levels.includes(lv)}
              className="min-h-[36px] min-w-[44px] rounded-full px-3.5 text-sm font-semibold transition-all duration-150"
              style={
                levels.includes(lv)
                  ? { background: BLUE, color: "#FFFFFF" }
                  : { background: "#FFFFFF", color: NAVY, border: "1px solid #D6E0F0" }
              }
              title={`Level ${lv}`}
            >
              {lv}
            </button>
          ))}
        </div>
      </section>

      {/* Positions */}
      <section style={SECTION} className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold" style={{ color: NAVY }}>ตำแหน่ง</h3>
          <button type="button" onClick={addPosition} className={BTN_SECONDARY}>
            <Plus size={16} aria-hidden /> เพิ่มตำแหน่ง
          </button>
        </div>

        <ul className="space-y-3">
          {positions.map((p, i) => (
            <li
              key={p._key}
              className="grid grid-cols-12 gap-2 rounded-xl p-3"
              style={{ background: "#F5F8FF", border: "1px solid #E3EAF5" }}
            >
              <div className="col-span-12 sm:col-span-7">
                <Field label="ชื่อตำแหน่ง" value={p.name} onChange={(v) => updatePos(i, "name", v)} />
              </div>
              <div className="col-span-8 sm:col-span-3">
                <Label>Level</Label>
                <select
                  value={p.level}
                  onChange={(e) => updatePos(i, "level", Number(e.target.value))}
                  className={INPUT_CLS}
                  style={INPUT_STYLE}
                >
                  {[1, 2, 3, 4, 5, 6].map((lv) => (
                    <option key={lv} value={lv}>{lv}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-4 flex items-end sm:col-span-2">
                <button type="button" onClick={() => removePos(i)} className={`${BTN_DANGER} w-full px-2`}>
                  <Trash2 size={16} aria-hidden /> ลบ
                </button>
              </div>
            </li>
          ))}
          {positions.length === 0 && <li className="text-sm" style={{ color: SLATE }}>ยังไม่มีตำแหน่ง</li>}
        </ul>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setConfirmDelete(true)} disabled={saving || deleting} className={BTN_DANGER}>
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 size={16} aria-hidden />} ลบแผนก
        </button>

        <button type="button" onClick={() => setConfirmSave(true)} disabled={saving || deleting} className={BTN_PRIMARY} data-testid="dept-save">
          {saving && <Loader2 className="size-4 animate-spin" />} บันทึกการเปลี่ยนแปลง
        </button>
      </div>

      <ConfirmModal
        open={confirmSave}
        title="ยืนยันการบันทึก"
        message={`บันทึกการเปลี่ยนแปลงของแผนก ${code || "-"} — ${name || "-"} ?`}
        confirmText="ยืนยันบันทึก"
        working={saving}
        onConfirm={doSave}
        onClose={() => setConfirmSave(false)}
      />

      <ConfirmModal
        open={confirmDelete}
        title="ยืนยันการลบ"
        message={`ต้องการลบแผนก ${code || "-"} — ${name || "-"} ใช่ไหม?`}
        confirmText="ยืนยันลบ"
        working={deleting}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function Label({ children }) {
  return <label className="text-[13px] font-semibold" style={{ color: NAVY }}>{children}</label>;
}
function Field({ label, value, onChange, type = "text" }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className={INPUT_CLS}
        style={INPUT_STYLE}
      />
    </div>
  );
}
function ConfirmModal({ open, title, message, confirmText = "ยืนยัน", working = false, onConfirm, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(13,27,42,0.6)" }}
      onClick={() => !working && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-[20px] p-6"
        style={{
          background: "#FFFFFF",
          border: "1px solid #E3EAF5",
          boxShadow: "0 16px 48px rgba(13,27,42,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} style={{ color: "#F59E0B", marginTop: 2, flexShrink: 0 }} />
          <div className="flex-1">
            <h3 className="font-semibold" style={{ color: NAVY }}>{title}</h3>
            <p className="text-sm mt-1" style={{ color: SLATE }}>{message}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onClose?.()} disabled={working} className={BTN_SECONDARY}>
            ยกเลิก
          </button>
          <button type="button" onClick={onConfirm} disabled={working} className={BTN_PRIMARY}>
            {working && <Loader2 className="size-4 animate-spin" />}{confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
