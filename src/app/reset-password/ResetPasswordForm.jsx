"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { authInputClass, authButtonClass } from "../../components/auth/AuthCard";
import { PASSWORD_MIN_LENGTH, validateNewPassword } from "@/lib/passwordRules";
import LinkProblem from "./LinkProblem";

/** New password + confirm → POST /api/auth/reset-password → /login?reset=1. */
export default function ResetPasswordForm({ token }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [linkProblem, setLinkProblem] = useState(""); // the link went bad meanwhile

  async function onSubmit(e) {
    e.preventDefault();
    const invalid = validateNewPassword({ newPassword, confirmPassword });
    if (invalid) return setErr(invalid);
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        router.replace("/login?reset=1");
        return;
      }
      if (j.reason && j.reason !== "password") setLinkProblem(j.message);
      else setErr(j.message || "ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่");
    } catch {
      setErr("ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่");
    }
    setLoading(false);
  }

  if (linkProblem) return <LinkProblem message={linkProblem} />;

  const field = (id, label, value, setValue, autoComplete) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-9e-navy">
        {label}
      </label>
      <div className="relative">
        <Lock size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`${authInputClass} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[var(--text-muted)] hover:text-9e-action"
          aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {field("newPassword", "รหัสผ่านใหม่", newPassword, setNewPassword, "new-password")}
      {field("confirmPassword", "ยืนยันรหัสผ่านใหม่", confirmPassword, setConfirmPassword, "new-password")}
      <p className="text-xs text-[var(--text-muted)]">อย่างน้อย {PASSWORD_MIN_LENGTH} ตัวอักษร</p>
      {err && (
        <div role="alert" className="rounded-[var(--9e-radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {err}
        </div>
      )}
      <button type="submit" disabled={loading} aria-busy={loading} className={authButtonClass}>
        {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
        {loading ? "กำลังบันทึก…" : "ตั้งรหัสผ่านใหม่"}
      </button>
    </form>
  );
}
