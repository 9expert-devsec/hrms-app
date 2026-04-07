"use client";

import { useState } from "react";
import { UserPlus, CheckCircle2, AlertTriangle } from "lucide-react";

const ROLE_OPTIONS = ["superadmin", "hr", "it", "payroll", "manager", "employee"];

export default function AdminRegisterForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    role: "employee",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // {ok:boolean, message:string, created?:any}

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setResult(null);

    // validations
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setResult({ ok: false, message: "อีเมลไม่ถูกต้อง" });
      return;
    }
    if (form.password.length < 6) {
      setResult({ ok: false, message: "รหัสผ่านอย่างน้อย 6 ตัวอักษร" });
      return;
    }
    if (form.password !== form.confirm) {
      setResult({ ok: false, message: "รหัสผ่านไม่ตรงกัน" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || form.email.split("@")[0],
          email: form.email,
          password: form.password,
          role: form.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data?.error || "สร้างผู้ใช้ไม่สำเร็จ" });
      } else {
        setResult({ ok: true, message: "สร้างผู้ใช้สำเร็จ", created: data });
        setForm({ name: "", email: "", password: "", confirm: "", role: "employee" });
      }
    } catch (err) {
      setResult({ ok: false, message: "เกิดข้อผิดพลาดจากเครือข่าย" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {result && (
        <div
          className={`rounded-lg px-3 py-2 text-sm border ${
            result.ok
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/30 bg-red-500/10 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {result.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{result.message}</span>
          </div>
          {result.ok && result.created?.email && (
            <p className="mt-1 text-xs opacity-80">
              User: {result.created.email} · role: {result.created.role}
            </p>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">ชื่อ (ไม่บังคับ)</label>
          <input
            name="name"
            value={form.name}
            onChange={onChange}
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 outline-none ring-1 ring-inset ring-white/10 focus:ring-indigo-400/40"
            placeholder="Full name"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">อีเมล</label>
          <input
            required
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 outline-none ring-1 ring-inset ring-white/10 focus:ring-indigo-400/40"
            placeholder="user@company.com"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">รหัสผ่าน</label>
          <input
            required
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 outline-none ring-1 ring-inset ring-white/10 focus:ring-indigo-400/40"
            placeholder="อย่างน้อย 6 ตัวอักษร"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">ยืนยันรหัสผ่าน</label>
          <input
            required
            type="password"
            name="confirm"
            value={form.confirm}
            onChange={onChange}
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 outline-none ring-1 ring-inset ring-white/10 focus:ring-indigo-400/40"
            placeholder="พิมพ์รหัสผ่านอีกครั้ง"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1">กำหนดสิทธิ์ (Role)</label>
        <select
          name="role"
          value={form.role}
          onChange={onChange}
          className="select-dark appearance-none pr-10 w-full"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400 mt-1">
          เลือกสิทธิ์ตามหน้าที่ของผู้ใช้ในระบบ (RBAC)
        </p>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-slate-400">
          ผู้ใช้ใหม่จะถูกบันทึกลงฐานข้อมูล MongoDB
        </div>
        <button
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 disabled:opacity-60 px-4 py-2.5 text-white font-medium"
        >
          <UserPlus size={18} />
          {loading ? "Creating..." : "Create user"}
        </button>
      </div>
    </form>
  );
}
