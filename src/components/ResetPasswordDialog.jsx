"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwordRules";
import TempPasswordDialog from "./TempPasswordDialog";

/**
 * Reset another person's password (users page, employee edit form) —
 * POST /api/users/[id]/reset-password. Two modes, both forcing a change at
 * the user's next sign-in:
 *   "typed"  (default) the admin types it; nothing is echoed back.
 *   "random" a system password, shown once in TempPasswordDialog.
 * `onDone(mode)` runs after a successful reset (the dialog closes itself).
 */
export default function ResetPasswordDialog({ user, onClose, onDone }) {
  const [mode, setMode] = useState("typed");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tempResult, setTempResult] = useState(null); // { email, tempPassword }

  const typedError =
    mode !== "typed"
      ? null
      : pw.length < PASSWORD_MIN_LENGTH
      ? `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`
      : pw !== pw2
      ? "ยืนยันรหัสผ่านไม่ตรงกัน"
      : null;

  async function submit() {
    if (typedError) return setError(typedError);
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${user._id}/reset-password`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "typed" ? { password: pw } : {}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.message || j.error || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
      setPw("");
      setPw2("");
      if (j.tempPassword) {
        setTempResult({ email: j.email, tempPassword: j.tempPassword });
      } else {
        onDone?.("typed");
        onClose();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (tempResult) {
    return (
      <TempPasswordDialog
        email={tempResult.email}
        tempPassword={tempResult.tempPassword}
        onClose={() => {
          setTempResult(null);
          onDone?.("random");
          onClose();
        }}
      />
    );
  }

  const radio = (value, label, hint) => (
    <label
      className="flex items-start gap-2 rounded-xl px-3 py-2.5 cursor-pointer"
      style={{
        border: `1px solid ${mode === value ? "#005CFF" : "rgba(0,92,255,0.15)"}`,
        background: mode === value ? "rgba(0,92,255,0.05)" : "#FFFFFF",
      }}
    >
      <input
        type="radio"
        name="reset-mode"
        checked={mode === value}
        onChange={() => {
          setMode(value);
          setError("");
        }}
        style={{ marginTop: 3 }}
      />
      <span>
        <span style={{ color: "#0D1B2A", fontSize: 14, fontWeight: 600 }}>{label}</span>
        <span style={{ display: "block", color: "#5E6A7E", fontSize: 12 }}>{hint}</span>
      </span>
    </label>
  );

  const inputStyle = {
    width: "100%",
    padding: "10px 40px 10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,92,255,0.15)",
    fontSize: 14,
    color: "#0D1B2A",
    background: "#FFFFFF",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(13,27,42,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "#FFFFFF", boxShadow: "0 16px 48px rgba(13,27,42,0.2)" }}
      >
        <h3 id="reset-password-title" style={{ color: "#0D1B2A", fontSize: 18, fontWeight: 700 }}>
          รีเซ็ตรหัสผ่าน
        </h3>
        <p style={{ color: "#0D1B2A", fontSize: 14, marginTop: 6 }}>{user.email}</p>
        <p style={{ color: "#5E6A7E", fontSize: 13, marginTop: 6 }}>
          ผู้ใช้ต้องตั้งรหัสผ่านใหม่เองเมื่อเข้าสู่ระบบครั้งถัดไป และรหัสผ่านเดิมจะใช้ไม่ได้อีก
        </p>

        <div className="space-y-2 mt-4">
          {radio("typed", "กำหนดรหัสผ่านเอง", "พิมพ์รหัสผ่านแล้วแจ้งผู้ใช้โดยตรง")}
          {radio("random", "ให้ระบบสุ่มรหัส", "ระบบสร้างรหัสชั่วคราวและแสดงครั้งเดียว")}
        </div>

        {mode === "typed" && (
          <div className="space-y-3 mt-4">
            {[
              ["รหัสผ่านใหม่", pw, setPw, "new-password"],
              ["ยืนยันรหัสผ่านใหม่", pw2, setPw2, "new-password"],
            ].map(([label, value, set, ac]) => (
              <div key={label}>
                <label style={{ display: "block", color: "#0D1B2A", fontSize: 13, marginBottom: 4 }}>{label}</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => {
                      set(e.target.value);
                      setError("");
                    }}
                    autoComplete={ac}
                    placeholder={`อย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#5E6A7E" }}
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" style={{ color: "#991B1B", fontSize: 13, marginTop: 10 }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              border: "1px solid rgba(0,92,255,0.10)",
              color: "#0D1B2A",
              fontSize: 13,
              fontWeight: 600,
              background: "#FFFFFF",
              borderRadius: 12,
              padding: "10px 16px",
            }}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || (mode === "typed" && (!pw || !pw2))}
            className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 disabled:opacity-50"
            style={{ background: "#005CFF", color: "#FFFFFF", fontSize: 13, fontWeight: 600, border: "none" }}
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {mode === "typed" ? "ตั้งรหัสผ่าน" : "สร้างรหัสผ่านชั่วคราว"}
          </button>
        </div>
      </div>
    </div>
  );
}
