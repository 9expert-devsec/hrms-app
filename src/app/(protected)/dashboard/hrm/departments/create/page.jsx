"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ChevronLeft } from "lucide-react";

const LEVEL_LABEL = {
  1: "Newbie (1)",
  2: "Junior (2)",
  3: "Senior (3)",
  4: "Lead (4)",
  5: "Manager (5)",
  6: "C-Level (6)",
};

export default function DepartmentCreatePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [description, setDescription] = useState("");
  const [allowLevels, setAllowLevels] = useState([]); // number[]
  const [positions, setPositions] = useState([
    { name: "", level: null }, // เริ่มด้วย 1 แถว
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // options level
  const levelOptions = useMemo(
    () => [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: LEVEL_LABEL[n] })),
    []
  );

  // เมื่อ allowLevels เปลี่ยน ถ้า level ของ position ไม่อยู่ใน allowLevels ให้เป็น null
  useEffect(() => {
    setPositions((prev) =>
      prev.map((p) => ({
        ...p,
        level: p.level && allowLevels.includes(p.level) ? p.level : null,
      }))
    );
  }, [allowLevels]);

  const canAddMore = positions.length < 10;

  const isValid = useMemo(() => {
    setError("");

    if (!name.trim() || !code.trim()) {
      return false;
    }
    if (!/^[A-Za-z]{2,8}$/.test(code.trim())) {
      setError("รหัสย่อ (Code) ควรเป็น A-Z 2–8 ตัวอักษร");
      return false;
    }
    if (allowLevels.length === 0) {
      setError("กรุณาเลือก Allow levels อย่างน้อย 1 ค่า");
      return false;
    }

    // ตรวจ positions
    if (positions.length > 10) {
      setError("ตำแหน่งต้องไม่เกิน 10 รายการ");
      return false;
    }

    const used = new Set();
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      if (!p.name.trim()) {
        setError(`ตำแหน่งแถวที่ ${i + 1} ต้องกรอกชื่อ`);
        return false;
      }
      const key = p.name.trim().toLowerCase();
      if (used.has(key)) {
        setError(`ตำแหน่งชื่อซ้ำ (แถวที่ ${i + 1})`);
        return false;
      }
      used.add(key);

      if (!p.level || !allowLevels.includes(p.level)) {
        setError(`ตำแหน่งแถวที่ ${i + 1} เลือก Level ไม่ถูกต้อง`);
        return false;
      }
    }

    return true;
  }, [name, code, allowLevels, positions]);

  const onAddRow = () => {
    if (!canAddMore) return;
    setPositions((prev) => [...prev, { name: "", level: null }]);
  };

  const onRemoveRow = (idx) => {
    setPositions((prev) => prev.filter((_, i) => i !== idx));
  };

  const onChangeRow = (idx, patch) => {
    setPositions((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!isValid || saving) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        color,
        description,
        allowLevels,
        positions: positions.map((p, i) => ({
          name: p.name.trim(),
          level: p.level,
          order: i,
        })),
      };

      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Create failed");
      }

      alert("สร้างแผนกสำเร็จ");
      router.push("/dashboard/hrm/departments");
    } catch (err) {
      console.error(err);
      alert(err.message || "Create failed");
      setSaving(false);
    }
  };

  const toggleLevel = (n) => {
    setAllowLevels((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/hrm/departments"
          className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
        >
          <ChevronLeft size={16} />
          Back
        </Link>
        <h1 className="text-2xl font-semibold text-slate-100">
          Create Department
        </h1>
      </div>

      <form onSubmit={submit} className="space-y-8">
        {/* Basic */}
        <section className="rounded-2xl border border-white/10 bg-[#0F172B] p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-sm text-slate-300">Department name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-white/5 text-slate-200 border border-white/10 px-3 py-2.5"
                placeholder="Information Technology"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm text-slate-300">
                Short code (prefix)
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl bg-white/5 text-slate-200 border border-white/10 px-3 py-2.5 uppercase"
                placeholder="IT"
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 items-center">
            <label className="space-y-1">
              <span className="text-sm text-slate-300">Color</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-14 rounded-md bg-transparent"
                />
                <span className="text-slate-400 text-sm">{color}</span>
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-sm text-slate-300">Description</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl bg-white/5 text-slate-200 border border-white/10 px-3 py-2.5"
                placeholder="คำอธิบายแผนก (ถ้ามี)"
              />
            </label>
          </div>
        </section>

        {/* Allow Levels */}
        <section className="rounded-2xl border border-white/10 bg-[#0F172B] p-5">
          <h3 className="text-slate-200 font-medium mb-3">Allow levels</h3>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => {
              const active = allowLevels.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleLevel(n)}
                  className={`rounded-full px-3 py-1.5 text-sm ring-1 transition ${
                    active
                      ? "bg-indigo-600/90 text-white ring-white/10"
                      : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"
                  }`}
                >
                  {LEVEL_LABEL[n]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            * Level ที่อนุญาตตรงนี้จะถูกใช้เป็นตัวเลือกให้กับตำแหน่งด้านล่าง
          </p>
        </section>

        {/* Positions */}
        <section className="rounded-2xl border border-white/10 bg-[#0F172B] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-200 font-medium">Positions</h3>
            <button
              type="button"
              onClick={onAddRow}
              disabled={!canAddMore}
              className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-slate-200 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50"
              title="เพิ่มตำแหน่ง (สูงสุด 10)"
            >
              <Plus size={16} />
              Add
            </button>
          </div>

          <div className="space-y-3">
            {positions.map((row, idx) => (
              <div
                key={idx}
                className="grid md:grid-cols-[1fr_220px_44px] gap-3 items-center"
              >
                <input
                  value={row.name}
                  onChange={(e) => onChangeRow(idx, { name: e.target.value })}
                  placeholder={`ตำแหน่ง #${idx + 1} เช่น IT Support`}
                  className="w-full rounded-xl bg-white/5 text-slate-200 border border-white/10 px-3 py-2.5"
                />

                <select
                  value={row.level ?? ""}
                  onChange={(e) =>
                    onChangeRow(idx, {
                      level: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="select-dark appearance-none pr-10 w-full"
                >
                  <option value="">เลือก Level</option>
                  {levelOptions
                    .filter((opt) => allowLevels.includes(opt.value))
                    .map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  onClick={() => onRemoveRow(idx)}
                  className="grid place-items-center rounded-xl bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
                  title="ลบแถวนี้"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {positions.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-400">
                ยังไม่มีตำแหน่ง — กดปุ่ม Add เพื่อเพิ่มรายการ
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            * จำกัดสูงสุด 10 ตำแหน่ง และ Level ของตำแหน่งต้องอยู่ใน Allow levels
          </p>
        </section>

        {/* Error + Submit */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/dashboard/hrm/departments"
            className="rounded-xl bg-white/5 px-4 py-2.5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!isValid || saving}
            className="rounded-xl bg-indigo-600/90 hover:bg-indigo-600 px-4 py-2.5 text-white font-medium ring-1 ring-white/10 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create Department"}
          </button>
        </div>
      </form>
    </div>
  );
}
