"use client";

import { useState } from "react";
import { Mail, Send, CheckCircle2, Loader2 } from "lucide-react";
import AuthCard, { authInputClass, authButtonClass } from "../../components/auth/AuthCard";
import { COMPANY_EMAIL_DOMAIN, FORGOT_PASSWORD_GENERIC_MESSAGE, RESET_LINK_TTL_MINUTES } from "@/lib/passwordRules";

/**
 * ลืมรหัสผ่าน (signed out). Whatever the address, the answer is the same
 * (POST /api/auth/forgot); a link goes only to an active @9expert.co.th account.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
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
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setErr("ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow="FORGOT PASSWORD"
      title="ลืมรหัสผ่าน"
      subtitle={`กรอกอีเมลที่ใช้เข้าสู่ระบบ เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ (ลิงก์ใช้ได้ ${RESET_LINK_TTL_MINUTES} นาที)`}
    >
      {done ? (
        <div role="status" className="flex gap-3 rounded-[var(--9e-radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" data-testid="forgot-done">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{FORGOT_PASSWORD_GENERIC_MESSAGE}</span>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-9e-navy">
              อีเมล
            </label>
            <div className="relative">
              <Mail size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authInputClass}
                placeholder={`you@${COMPANY_EMAIL_DOMAIN}`}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              ใช้ได้กับอีเมล @{COMPANY_EMAIL_DOMAIN} เท่านั้น — บัญชีที่ใช้อีเมลอื่นกรุณาติดต่อฝ่ายไอที
            </p>
          </div>
          {err && (
            <div role="alert" className="rounded-[var(--9e-radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {err}
            </div>
          )}
          <button type="submit" disabled={loading} aria-busy={loading} className={authButtonClass}>
            {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
            {loading ? "กำลังส่ง…" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
