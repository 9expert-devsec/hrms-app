"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Save } from "lucide-react";
import { FieldError, ErrorSummary, Req } from "../../../../../../components/FormValidation";
import { SELF_EDIT_LABELS, NICKNAME_MAX, validateSelfProfile } from "@/lib/employeeFormRules";
import { prepareUpload, uploadErrorMessage } from "@/lib/client/resizeImage";

const NAVY = "#0D1B2A";
const SLATE = "#5E6A7E";
const inputStyle = (invalid) => ({
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${invalid ? "#EF4444" : "rgba(0,92,255,0.15)"}`,
  fontSize: 14,
  color: NAVY,
  background: "#FFFFFF",
});

/**
 * "แก้ไขโปรไฟล์ของฉัน": photo, nickname, phone — nothing else. Rules in
 * lib/employeeFormRules.js (validateSelfProfile), same as the server.
 */
export default function SelfProfileForm({ initial }) {
  const router = useRouter();
  const [nickName, setNickName] = useState(initial.nickName);
  const [phone, setPhone] = useState(initial.phone);
  const [preview, setPreview] = useState(initial.photoUrl);
  const [photoFile, setPhotoFile] = useState(null);
  const [resizing, setResizing] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState(null); // { message, field }
  const [saving, setSaving] = useState(false);

  const errors = attempted ? validateSelfProfile({ nickName, phone }, { stored: initial }) : {};
  const errorKeys = Object.keys(errors);
  const fieldErrors = serverError?.field ? { ...errors, [serverError.field]: serverError.message } : errors;
  const aria = (k) => ({
    "aria-invalid": fieldErrors[k] ? true : undefined,
    "aria-describedby": fieldErrors[k] ? `self-${k}-error` : undefined,
  });

  async function onPickFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setResizing(true);
    try {
      const ready = await prepareUpload(f); // resized in the browser first
      setPhotoFile(ready);
      setPreview(URL.createObjectURL(ready));
    } catch (err) {
      setServerError({ message: err.message, field: "photo" });
    } finally {
      setResizing(false);
    }
  }

  async function save() {
    setAttempted(true);
    setServerError(null);
    const errs = validateSelfProfile({ nickName, phone }, { stored: initial });
    if (Object.keys(errs).length) {
      document.getElementById(`self-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      const body = { nickName, phone };
      if (photoFile) {
        const fd = new FormData();
        fd.append("file", photoFile);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        const uj = await up.json().catch(() => ({}));
        if (!up.ok) throw Object.assign(new Error(uploadErrorMessage(up, uj)), { field: "photo" });
        body.photoUrl = uj.url;
        body.photoPublicId = uj.public_id || "";
      }
      const res = await fetch("/api/employees/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw Object.assign(new Error(j.message || "บันทึกไม่สำเร็จ"), { field: j.field || null });
      router.push("/dashboard/hrm/employee-profile");
      router.refresh();
    } catch (err) {
      setServerError({ message: err.message, field: err.field || null });
      setSaving(false);
    }
  }

  return (
    <section
      className="space-y-5 rounded-2xl p-6"
      style={{ background: "#FFFFFF", border: "1px solid rgba(0,92,255,0.10)", boxShadow: "0 2px 8px rgba(13,27,42,0.06)" }}
      data-testid="self-profile-form"
    >
      <div className="flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl" style={{ background: "#F8FAFD", border: "1px solid rgba(0,92,255,0.10)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview || "/avatar-default.png"} alt="รูปโปรไฟล์" className="h-full w-full object-cover object-top" />
        </div>
        <div>
          <div style={{ color: NAVY, fontSize: 14, fontWeight: 600 }}>{SELF_EDIT_LABELS.photo}</div>
          <label
            className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium"
            style={{ border: "1px solid rgba(0,92,255,0.15)", color: "#334155", background: "#FFFFFF" }}
          >
            {resizing ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} เลือกรูปใหม่
            <input type="file" accept="image/*" className="sr-only" onChange={onPickFile} disabled={resizing || saving} aria-label="เลือกรูปโปรไฟล์ใหม่" />
          </label>
          <p style={{ color: SLATE, fontSize: 12, marginTop: 6 }}>JPG, PNG, WEBP — ย่อขนาดอัตโนมัติก่อนอัปโหลด</p>
          <FieldError k="photo" errors={fieldErrors} prefix="self" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium" style={{ color: NAVY }}>
          {SELF_EDIT_LABELS.nickName}
          <input
            id="self-nickName"
            className="mt-1"
            style={inputStyle(!!fieldErrors.nickName)}
            value={nickName}
            maxLength={NICKNAME_MAX}
            onChange={(e) => setNickName(e.target.value)}
            {...aria("nickName")}
          />
          <FieldError k="nickName" errors={fieldErrors} prefix="self" />
        </label>
        <label className="block text-sm font-medium" style={{ color: NAVY }}>
          {SELF_EDIT_LABELS.phone}
          <Req />
          <input
            id="self-phone"
            className="mt-1"
            style={inputStyle(!!fieldErrors.phone)}
            value={phone}
            inputMode="numeric"
            maxLength={10}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            aria-required
            {...aria("phone")}
          />
          <FieldError k="phone" errors={fieldErrors} prefix="self" />
        </label>
      </div>

      <p className="rounded-xl px-4 py-3 text-sm" style={{ background: "#F8FAFD", color: SLATE }}>
        ชื่อ-นามสกุล ที่อยู่ ผู้ติดต่อฉุกเฉิน บัญชีธนาคาร และข้อมูลอื่น ๆ แก้ไขได้โดยฝ่ายบุคคล (HR) เท่านั้น
      </p>

      <ErrorSummary errorKeys={errorKeys} serverError={serverError} serverOnField={!!serverError?.field} labels={SELF_EDIT_LABELS} />

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || resizing}
          className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #005CFF, #2486FF)", color: "#FFFFFF", fontSize: 14, fontWeight: 600, border: "none" }}
          data-testid="self-profile-save"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} บันทึก
        </button>
      </div>
    </section>
  );
}
