"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { PASSWORD_MIN_LENGTH, validateNewPassword } from "@/lib/passwordRules";

const inputClass =
  "h-12 w-full rounded-[var(--9e-radius-md)] border border-[var(--surface-border)] bg-white px-4 text-[15px] text-9e-navy";

export default function ChangePasswordForm({ forced, email }) {
  const router = useRouter();
  const { update } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!currentPassword) {
      setError(forced ? "กรุณากรอกรหัสผ่านชั่วคราว" : "กรุณากรอกรหัสผ่านปัจจุบัน");
      return;
    }
    const invalid = validateNewPassword({ newPassword, confirmPassword, currentPassword });
    if (invalid) {
      setError(invalid);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.message || j.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      // Re-read the session from the DB (jwt "update" trigger) so the
      // password-change flag is cleared without signing in again.
      await update();
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-9e-ice px-4 py-10">
      <div className="w-full max-w-[440px] rounded-2xl bg-white p-8 shadow-[0_8px_24px_rgba(13,27,42,0.08)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[rgba(0,92,255,0.08)] text-9e-action">
            <KeyRound size={20} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl text-9e-navy">เปลี่ยนรหัสผ่าน</h1>
            {email && <p className="text-sm text-[var(--text-muted)]">{email}</p>}
          </div>
        </div>

        {forced && (
          <div className="mb-5 rounded-[var(--9e-radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            บัญชีนี้ได้รับรหัสผ่านชั่วคราว กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งานระบบ
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="current" className="mb-1.5 block text-sm font-semibold text-9e-navy">
              {forced ? "รหัสผ่านชั่วคราว" : "รหัสผ่านปัจจุบัน"}
            </label>
            <input
              id="current"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="new" className="mb-1.5 block text-sm font-semibold text-9e-navy">
              รหัสผ่านใหม่
            </label>
            <input
              id="new"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              อย่างน้อย {PASSWORD_MIN_LENGTH} ตัวอักษร และต้องไม่ซ้ำกับรหัสผ่านเดิม
            </p>
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold text-9e-navy">
              ยืนยันรหัสผ่านใหม่
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <div role="alert" className="rounded-[var(--9e-radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--9e-radius-md)] bg-9e-action font-bold text-white disabled:opacity-70"
          >
            {loading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
            {loading ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
          </button>
        </form>

        <div className="mt-6 flex justify-between text-sm">
          {!forced ? (
            <a href="/dashboard" className="text-9e-action hover:underline">
              กลับไปแดชบอร์ด
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="inline-flex items-center gap-1.5 text-[var(--text-muted)] hover:text-9e-navy"
          >
            <LogOut size={14} aria-hidden="true" />
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
