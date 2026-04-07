"use client";

import { useState } from "react";
import { Mail, Send } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed");
      setSent(true);
    } catch (e) {
      setErr("ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-[#0F172B] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/5 p-6 ring-1 ring-inset ring-white/10 shadow-xl backdrop-blur">
        <h1 className="text-2xl font-semibold text-slate-100">Forgot password</h1>
        <p className="text-slate-400 text-sm mt-1">
          ใส่อีเมลของคุณ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
        </p>

        {sent ? (
          <div className="mt-6 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 px-3 py-2 text-sm">
            ส่งคำขอสำเร็จแล้ว โปรดตรวจสอบกล่องจดหมายของคุณ
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {err && (
              <div className="rounded-lg border border-red-400/30 bg-red-500/10 text-red-200 px-3 py-2 text-sm">
                {err}
              </div>
            )}
            <div>
              <label className="block text-sm text-slate-300 mb-1">Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-xl bg-white/5 px-4 py-2.5 pl-10 text-slate-100 placeholder:text-slate-400 outline-none ring-1 ring-inset ring-white/10 focus:ring-indigo-400/40"
                />
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <button
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 disabled:opacity-60 px-4 py-2.5 text-white font-medium transition"
            >
              <Send size={18} />
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
