"use client";

import { useState } from "react";
import { ShieldCheck, Send } from "lucide-react";

const ROLES = ["superadmin", "hr", "it", "payroll", "manager", "executive", "employee"];

export default function RoleRequestPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    department: "",
    roles: [],
    reason: "",
  });
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  function toggleRole(role) {
    setForm((f) => {
      const has = f.roles.includes(role);
      return { ...f, roles: has ? f.roles.filter((r) => r !== role) : [...f.roles, role] };
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/roles/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) setOk(true);
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-[#0F172B] px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white/5 p-6 ring-1 ring-inset ring-white/10 shadow-xl backdrop-blur">
        <h1 className="text-2xl font-semibold text-slate-100 flex items-center gap-2">
          <ShieldCheck size={22} className="text-indigo-300" />
          Request Access / Role
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          กรอกข้อมูลเพื่อขอสิทธิ์การใช้งานตามหน้าที่ในระบบ
        </p>

        {ok ? (
          <div className="mt-6 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 px-3 py-2 text-sm">
            ส่งคำขอเรียบร้อย ทีม HR/IT จะตรวจสอบและอนุมัติให้เร็วที่สุด
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-300 mb-1">ชื่อ-นามสกุล</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 outline-none ring-1 ring-inset ring-white/10 focus:ring-indigo-400/40"
                placeholder="Full name"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 outline-none ring-1 ring-inset ring-white/10 focus:ring-indigo-400/40"
                placeholder="you@company.com"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-300 mb-1">แผนก</label>
              <input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 outline-none ring-1 ring-inset ring-white/10 focus:ring-indigo-400/40"
                placeholder="HR / IT / Payroll / …"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-300 mb-2">Roles ที่ต้องการ</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => {
                  const active = form.roles.includes(role);
                  return (
                    <button
                      type="button"
                      key={role}
                      onClick={() => toggleRole(role)}
                      className={`px-3 py-1.5 rounded-lg text-sm ring-1 ring-inset transition
                      ${active ? "bg-indigo-600/90 text-white ring-indigo-500/50"
                               : "bg-white/5 text-slate-200 ring-white/10 hover:bg-white/10"}`}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-300 mb-1">เหตุผลที่ขอสิทธิ์</label>
              <textarea
                rows={4}
                required
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 outline-none ring-1 ring-inset ring-white/10 focus:ring-indigo-400/40"
                placeholder="อธิบายหน้าที่งาน/เหตุผลที่ต้องใช้สิทธิ์นี้"
              />
            </div>

            <div className="md:col-span-2">
              <button
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 disabled:opacity-60 px-4 py-2.5 text-white font-medium transition"
              >
                <Send size={18} />
                {loading ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
