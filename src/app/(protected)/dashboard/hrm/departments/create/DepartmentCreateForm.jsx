"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Ban, Palette } from "lucide-react";

export default function DepartmentCreateForm({ levels }) {
  const router = useRouter();

  const [code, setCode] = useState("");               // ชื่อย่อ เช่น IT
  const [name, setName] = useState("");               // ชื่อเต็ม
  const [empIdPrefix, setEmpIdPrefix] = useState(""); // เริ่มต้นเท่ากับ code
  const [allowedLevels, setAllowedLevels] = useState([1,2,3,4,5]);
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366F1");      // default indigo-500

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function onChangeCode(v) {
    const up = v.toUpperCase();
    setCode(up);
    // ให้ prefix auto-fill เท่ากับ code ระหว่างกรอก
    if (!empIdPrefix || empIdPrefix === code) setEmpIdPrefix(up);
  }

  function toggleLevel(v) {
    setAllowedLevels((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  }

  const codeOk = /^[A-Z]{2,6}$/.test(code);
  const prefixOk = /^[A-Z]{2,6}$/.test(empIdPrefix);
  const colorOk = /^#([0-9a-fA-F]{6})$/.test(color);
  const canSubmit = codeOk && prefixOk && !!name.trim() && colorOk && allowedLevels.length > 0;

  async function submitForm() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          empIdPrefix,
          allowedLevels: allowedLevels.sort((a,b)=>a-b),
          description,
          color,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(()=> ({}));
        throw new Error(data?.message || "Create failed");
      }
      router.push("/dashboard/hrm/departments");
      router.refresh();
    } catch (e) {
      alert(e.message || "Create department failed");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        {/* ชื่อเต็ม */}
        <div className="md:col-span-2">
          <label className="text-sm text-slate-300">Department Full Name</label>
          <input
            value={name}
            onChange={(e)=>setName(e.target.value)}
            placeholder="เช่น Information Technology"
            className="mt-1 w-full select-dark"
          />
        </div>

        {/* ชื่อย่อ */}
        <div>
          <label className="text-sm text-slate-300">Short Code (2–6 uppercase)</label>
          <input
            value={code}
            onChange={(e)=>onChangeCode(e.target.value.replace(/\s+/g,""))}
            placeholder="เช่น IT"
            className="mt-1 w-full select-dark"
          />
          {!codeOk && code && (
            <p className="text-xs text-rose-400 mt-1">กรุณากรอกตัวอักษร A–Z 2–6 ตัว</p>
          )}
        </div>

        {/* Prefix */}
        <div>
          <label className="text-sm text-slate-300">Employee ID Prefix</label>
          <input
            value={empIdPrefix}
            onChange={(e)=>setEmpIdPrefix(e.target.value.toUpperCase().replace(/\s+/g,""))}
            placeholder="เช่น IT"
            className="mt-1 w-full select-dark"
          />
          {!prefixOk && empIdPrefix && (
            <p className="text-xs text-rose-400 mt-1">กรุณากรอกตัวอักษร A–Z 2–6 ตัว</p>
          )}
          <p className="text-xs text-slate-400 mt-1">
            ใช้สำหรับ gen หมายเลขพนักงาน เช่น <b>{empIdPrefix || "XX"}-0001</b>
          </p>
        </div>

        {/* Allowed Levels */}
        <div className="md:col-span-2">
          <label className="text-sm text-slate-300">Allowed Levels</label>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
            {levels.map((lv) => (
              <label key={lv.value} className={`surface surface-hover px-3 py-2 flex items-center gap-2 cursor-pointer
                ${allowedLevels.includes(lv.value) ? "ring-1 ring-indigo-500/40 bg-white/10" : ""}`}>
                <input
                  type="checkbox"
                  checked={allowedLevels.includes(lv.value)}
                  onChange={() => toggleLevel(lv.value)}
                />
                <span>{lv.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* สี */}
        <div>
          <label className="text-sm text-slate-300 flex items-center gap-2">
            <Palette size={16}/> Department Color
          </label>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e)=>setColor(e.target.value)}
              className="h-10 w-14 rounded-md bg-transparent border border-white/10"
            />
            <input
              value={color}
              onChange={(e)=>setColor(e.target.value)}
              className="select-dark flex-1"
              placeholder="#6366F1"
            />
          </div>
          {!colorOk && color && (
            <p className="text-xs text-rose-400 mt-1">ใส่สีรูปแบบ #RRGGBB เช่น #6366F1</p>
          )}
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ring-1 ring-white/10" style={{background: color+"22"}}>
            <span className="inline-block h-3 w-3 rounded-full" style={{background: color}}/>
            <span className="text-slate-300 text-sm">ตัวอย่างสี</span>
          </div>
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="text-sm text-slate-300">Description (optional)</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e)=>setDescription(e.target.value)}
            className="mt-1 w-full select-dark"
            placeholder="บันทึกข้อมูลเพิ่มเติมสำหรับแผนก…"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex items-center gap-3">
        <button
          disabled={!canSubmit}
          onClick={()=>setConfirmOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white font-medium ring-1 ring-white/10 disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            <Save size={18}/> Create
          </span>
        </button>

        <button
          onClick={()=>history.back()}
          className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 ring-1 ring-inset ring-white/10"
        >
          <span className="inline-flex items-center gap-2">
            <Ban size={18}/> Cancel
          </span>
        </button>
      </div>

      {/* Confirm */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">
          <div className="w-full max-w-xl p-6 bg-blue-950 border border-white/10 rounded-xl">
            <h3 className="text-lg font-semibold mb-2">ยืนยันสร้างแผนกใหม่</h3>
            <p className="text-slate-400 mb-4">กรุณาตรวจสอบข้อมูลก่อนกดบันทึก</p>

            <div className="grid gap-2 text-sm">
              <Row label="Full name" value={name || "-"} />
              <Row label="Short code" value={code || "-"} />
              <Row label="Emp ID Prefix" value={empIdPrefix || "-"} />
              <Row label="Allowed Levels" value={allowedLevels.sort((a,b)=>a-b).join(", ") || "-"} />
              <Row label="Color" value={color || "-"} />
              {description && <Row label="Description" value={description} />}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10"
                onClick={()=>setConfirmOpen(false)}
                disabled={submitting}
              >
                ยกเลิก
              </button>
              <button
                onClick={submitForm}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white font-medium ring-1 ring-white/10 disabled:opacity-50"
              >
                {submitting ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin"/> กำลังบันทึก…</span> : "ยืนยันบันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
