"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";

export default function DepartmentEditForm({ initial, employeeCount, eligibleHeads = [] }) {
  const router = useRouter();

  // --- form states ---
  const [name, setName] = useState(initial?.name || "");
  const [code, setCode] = useState(initial?.code || "");
  const [color, setColor] = useState(initial?.color || "#6366f1");
  const [empIdPrefix, setEmpIdPrefix] = useState(initial?.empIdPrefix || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [levels, setLevels] = useState(initial?.allowedLevels || initial?.allowLevels || []);
  const [positions, setPositions] = useState(initial?.positions || []);

  // 🆕 หัวหน้าแผนก
  const [headId, setHeadId] = useState(
    initial?.headOfDepartment?._id || initial?.headOfDepartment || ""
  );

  // --- ui states ---
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleLevel(lv) {
    setLevels((s) => (s.includes(lv) ? s.filter((x) => x !== lv) : [...s, lv]));
  }
  function addPosition() { setPositions((s) => [...s, { name: "", level: 1 }]); }
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
          positions: positions.map((p) => ({
            name: String(p.name || "").trim(),
            level: Number(p.level) || 1,
          })),
          // 🆕 ส่งค่าไปบันทึก
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
          <span className="text-sm text-slate-400">
            Employees in this department: <b className="text-slate-200">{employeeCount}</b>
          </span>
        )}
      </div>

      {/* Basic info */}
      <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Code" value={code} onChange={(v) => setCode(v.toUpperCase())} />

        {/* 🆕 Head of Department */}
          <div className="md:col-span-2">
            <Label>เลือกหัวหน้าแผนก (เฉพาะ L5–L6)</Label>
            <select
              value={headId}
              onChange={(e) => setHeadId(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-800 px-4 py-2.5 ring-1 ring-slate-700 text-white"
            >
              <option value="">— ไม่กำหนด —</option>
              {eligibleHeads.map((u) => (
                <option key={u._id} value={u._id}>
                  {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.nickName || "-"}
                  {u.position ? ` • ${u.position}` : ""} {u.level ? ` • L${u.level}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Color</Label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl bg-white/5 ring-1 ring-white/10"
            />
          </div>

          <Field label="Emp ID Prefix" value={empIdPrefix} onChange={setEmpIdPrefix} />

          <div className="md:col-span-2">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
            />
          </div>
        </div>
      </section>

      {/* Levels */}
      <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
        <h3 className="text-slate-200 font-medium mb-3">Allowed Levels</h3>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => toggleLevel(lv)}
              className={`rounded-xl px-3 py-1.5 ring-1 ${
                levels.includes(lv)
                  ? "bg-indigo-600/90 ring-white/10 text-white"
                  : "bg-white/5 ring-white/10 text-slate-200"
              }`}
              title={`Level ${lv}`}
            >
              {lv}
            </button>
          ))}
        </div>
      </section>

      {/* Positions */}
      <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-slate-200 font-medium">Positions</h3>
          <button
            type="button"
            onClick={addPosition}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-slate-200 ring-1 ring-white/10"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        <ul className="space-y-3">
          {positions.map((p, i) => (
            <li key={`${i}-${p.name}-${p.level}`} className="grid grid-cols-12 gap-2 rounded-xl bg-[#0f172b] ring-1 ring-white/10 p-3">
              <div className="col-span-7">
                <Field label="Position name" value={p.name} onChange={(v) => updatePos(i, "name", v)} />
              </div>
              <div className="col-span-3">
                <Label>Level</Label>
                <select
                  value={p.level}
                  onChange={(e) => updatePos(i, "level", Number(e.target.value))}
                  className="mt-1 w-full rounded-xl bg-slate-800 px-4 py-2.5 ring-1 ring-slate-700 text-white"
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
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 px-3 py-2.5 text-red-200 ring-1 ring-red-500/30"
                >
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            </li>
          ))}
          {positions.length === 0 && <li className="text-sm text-slate-400">ยังไม่มีตำแหน่ง</li>}
        </ul>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={saving || deleting}
          className="inline-flex items-center gap-2 rounded-xl bg-red-600/80 hover:bg-red-600 px-4 py-2.5 text-white ring-1 ring-red-400/40 disabled:opacity-60"
        >
          {deleting && <Loader2 className="size-4 animate-spin" />} ลบ Department
        </button>

        <button
          type="button"
          onClick={() => setConfirmSave(true)}
          disabled={saving || deleting}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 px-4 py-2.5 text-white ring-1 ring-white/10 disabled:opacity-60"
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
  return <label className="text-sm text-slate-300">{children}</label>;
}
function Field({ label, value, onChange, type = "text" }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
      />
    </div>
  );
}
function ConfirmModal({ open, title, message, confirmText = "ยืนยัน", working = false, onConfirm, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => !working && onClose?.()}>
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-[#0F172B] ring-1 ring-white/10 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <svg viewBox="0 0 24 24" className="mt-1 size-5 text-amber-400"><path fill="currentColor" d="M11 15h2v2h-2zm0-8h2v6h-2z"/></svg>
          <div className="flex-1">
            <h3 className="text-slate-100 font-medium">{title}</h3>
            <p className="text-slate-400 text-sm mt-1">{message}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onClose?.()} disabled={working} className="rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 text-slate-200 ring-1 ring-white/10 disabled:opacity-60">ยกเลิก</button>
          <button type="button" onClick={onConfirm} disabled={working} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 px-4 py-2.5 text-white ring-1 ring-white/10 disabled:opacity-60">
            {working && <Loader2 className="size-4 animate-spin" />}{confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
