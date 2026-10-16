"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import NoAccountBadge from "../../../../../../../components/NoAccountBadge";

/* ── design tokens ─────────────────────────────────── */
const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const SLATE = "#5E6A7E";
const ICE = "#F8FAFD";

const INPUT_CLS =
  "mt-1 w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-150 focus:ring-2 focus:ring-[#005CFF]/30";
const INPUT_STYLE = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,92,255,0.15)",
  color: NAVY,
};
const SECTION = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,92,255,0.10)",
  borderRadius: "16px",
  boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
};

export default function DepartmentEditForm({ initial, employeeCount, eligibleHeads = [] }) {
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
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        {typeof employeeCount === "number" && (
          <span className="text-sm" style={{ color: SLATE }}>
            Employees in this department: <b style={{ color: NAVY }}>{employeeCount}</b>
          </span>
        )}
      </div>

      {/* Basic info */}
      <section style={SECTION} className="p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Code" value={code} onChange={(v) => setCode(v.toUpperCase())} />

          {/* Head of Department */}
          <div className="md:col-span-2">
            <Label>เลือกหัวหน้าแผนก (เฉพาะ L5–L6)</Label>
            <select
              value={headId}
              onChange={(e) => setHeadId(e.target.value)}
              className={INPUT_CLS}
              style={INPUT_STYLE}
            >
              <option value="">— ไม่กำหนด —</option>
              {eligibleHeads.map((u) => (
                <option key={u._id} value={u._id}>
                  {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.nickName || "-"}
                  {u.position ? ` • ${u.position}` : ""} {u.level ? ` • L${u.level}` : ""}
                </option>
              ))}
            </select>
            {selectedHead && !selectedHead.userId && <NoAccountBadge className="mt-2" />}
          </div>

          <div>
            <Label>Color</Label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl cursor-pointer"
              style={{ ...INPUT_STYLE, padding: 4 }}
            />
          </div>

          <Field label="Emp ID Prefix" value={empIdPrefix} onChange={setEmpIdPrefix} />

          <div className="md:col-span-2">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={INPUT_CLS}
              style={{ ...INPUT_STYLE, resize: "vertical" }}
            />
          </div>
        </div>
      </section>

      {/* Levels */}
      <section style={SECTION} className="p-5">
        <h3 className="font-medium mb-3" style={{ color: NAVY }}>Allowed Levels</h3>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => toggleLevel(lv)}
              className="rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-all duration-150"
              style={
                levels.includes(lv)
                  ? { background: BLUE, color: "#FFFFFF" }
                  : { background: ICE, color: NAVY, border: "1px solid rgba(0,92,255,0.12)" }
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
          <h3 className="font-medium" style={{ color: NAVY }}>Positions</h3>
          <button
            type="button"
            onClick={addPosition}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-150"
            style={{ background: "rgba(0,92,255,0.08)", color: BLUE }}
          >
            <Plus size={16} /> Add
          </button>
        </div>

        <ul className="space-y-3">
          {positions.map((p, i) => (
            <li
              key={p._key}
              className="grid grid-cols-12 gap-2 rounded-xl p-3"
              style={{ background: ICE, border: "1px solid rgba(0,92,255,0.08)" }}
            >
              <div className="col-span-7">
                <Field label="Position name" value={p.name} onChange={(v) => updatePos(i, "name", v)} />
              </div>
              <div className="col-span-3">
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
              <div className="col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={() => removePos(i)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-150"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#DC2626", border: "1px solid rgba(239,68,68,0.15)" }}
                >
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            </li>
          ))}
          {positions.length === 0 && <li className="text-sm" style={{ color: SLATE }}>ยังไม่มีตำแหน่ง</li>}
        </ul>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={saving || deleting}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-150 disabled:opacity-60"
          style={{ background: "rgba(239,68,68,0.08)", color: "#DC2626", border: "1px solid rgba(239,68,68,0.15)" }}
        >
          {deleting && <Loader2 className="size-4 animate-spin" />} ลบ Department
        </button>

        <button
          type="button"
          onClick={() => setConfirmSave(true)}
          disabled={saving || deleting}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
          style={{ background: BLUE, color: "#FFFFFF" }}
        >
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
  return <label className="text-sm font-semibold" style={{ color: NAVY }}>{children}</label>;
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
        className="w-full max-w-md rounded-2xl p-5"
        style={{
          background: "#FFFFFF",
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
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={working}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ background: ICE, color: NAVY }}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
            style={{ background: BLUE, color: "#FFFFFF" }}
          >
            {working && <Loader2 className="size-4 animate-spin" />}{confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
