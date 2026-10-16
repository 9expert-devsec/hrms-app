"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";

/**
 * One-time display of a temporary password (POST /api/users/[id]/reset-password).
 * Used by the users page and the employee edit form. The password exists only
 * in this dialog's props; closing it discards it.
 */
export default function TempPasswordDialog({ email, tempPassword, onClose }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(13,27,42,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="temp-password-title"
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "#FFFFFF", boxShadow: "0 16px 48px rgba(13,27,42,0.2)" }}
      >
        <h3 id="temp-password-title" style={{ color: "#0D1B2A", fontSize: 18, fontWeight: 700 }}>
          รหัสผ่านชั่วคราว
        </h3>
        {email && <p style={{ color: "#5E6A7E", fontSize: 13, marginTop: 4 }}>{email}</p>}
        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3"
          style={{ background: "#F8FAFD", border: "1px solid rgba(0,92,255,0.15)" }}
        >
          <code style={{ fontSize: 20, letterSpacing: "0.08em", color: "#0D1B2A", fontWeight: 700 }}>
            {tempPassword}
          </code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5"
            style={{
              border: "1px solid #005CFF20",
              color: "#005CFF",
              background: "#005CFF08",
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "คัดลอกแล้ว" : "คัดลอก"}
          </button>
        </div>
        <div
          className="mt-4 flex gap-2 rounded-xl px-4 py-3"
          style={{ background: "#FEF3C7", color: "#92400E", fontSize: 13 }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          รหัสนี้จะแสดงครั้งเดียว — แจ้งพนักงานโดยตรง และพนักงานต้องตั้งรหัสใหม่เมื่อเข้าสู่ระบบ
        </div>
        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
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
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
