"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEPT_PREFIX,
  POSITIONS_BY_DEPT,
  GENDERS,
} from "@/app/config/hrmOptions";
import {
  CalendarDays,
  Save,
  UserPlus,
  Upload,
  X,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

import { useRouter } from "next/navigation";

export default function EmployeeCreateForm() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    nickName: "",
    department: "IT",
    position: "",
    dateOfJoin: "",
    phone: "",
    email: "",
    birthday: "",
    address: "",
    gender: "male",
    photoUrl: "",
    emergency: {
      firstName: "",
      lastName: "",
      relationship: "",
      phone: "",
      email: "",
      address: "",
    },
    privateInfo: {
      bookbank: {
        accountHolderName: "",
        accountNumber: "",
        bankName: "",
        branchName: "",
      },
    },
    createAccount: true,
    accountPassword: "",
    role: "employee",
  });

  // ---------- Upload Profile ----------
  const [preview, setPreview] = useState(""); // objectURL สำหรับโชว์ทันที
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  // --- Save Button , Password
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false); // เปิด/ปิดกล่องยืนยัน
  const [saving, setSaving] = useState(false); // แสดงโหลดตอนบันทึก
  const [showPwd, setShowPwd] = useState(false);

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  const phoneRe = /^(\d{10}|\d{3}-\d{3}-\d{4})$/;

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr("");

    // พรีวิวทันที
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    // อัปโหลดไป API
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data?.url)
        throw new Error(data?.error || "upload failed");
      setForm((f) => ({ ...f, photoUrl: data.url }));
    } catch (err) {
      setUploadErr("อัปโหลดไม่สำเร็จ");
      setPreview("");
    } finally {
      setUploading(false);
    }
  }  

  function clearPhoto() {
    setPreview("");
    setForm((f) => ({ ...f, photoUrl: "" }));
  }

  // positions ของแผนก
  const positions = useMemo(
    () => POSITIONS_BY_DEPT[form.department] || [],
    [form.department]
  );

  // prefix สำหรับ emp id
  const prefix = useMemo(() => {
    // mapping จาก department -> prefix
    const map = DEPT_PREFIX;
    // แผนก AC คุณอยากใช้ "FN" => map.AC = "FN"
    return map[form.department] || form.department;
  }, [form.department]);

  // สร้าง errors แบบคำนวณจากค่าปัจจุบันของฟอร์ม
  const errors = useMemo(() => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "จำเป็น";
    if (!form.lastName.trim()) e.lastName = "จำเป็น";
    if (!form.nickName.trim()) e.nickName = "จำเป็น";
    if (!form.department) e.department = "จำเป็น";
    if (!form.position) e.position = "จำเป็น";
    if (!form.dateOfJoin) e.dateOfJoin = "จำเป็น";

    if (!form.phone.trim()) e.phone = "จำเป็น";
    else if (!phoneRe.test(form.phone.trim())) e.phone = "ใส่เบอร์ 10 หลัก";

    if (!form.email.trim()) e.email = "จำเป็น";
    else if (!emailRe.test(form.email.trim())) e.email = "อีเมลไม่ถูกต้อง";

    if (!form.birthday) e.birthday = "จำเป็น";
    if (!form.address.trim()) e.address = "จำเป็น";
    if (!form.gender) e.gender = "จำเป็น";

    return e;
  }, [form]);

  // ปุ่มบันทึกจะกดได้ต่อเมื่อไม่มี error และไม่ได้อัปโหลด/บันทึกอยู่
  const canSave = Object.keys(errors).length === 0 && !uploading && !saving;

  // preview next empAutoId
  const [previewId, setPreviewId] = useState("");
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/employees/next-id?prefix=${prefix}`);
        const d = await r.json();
        if (!ignore && d?.empAutoId) setPreviewId(d.empAutoId);
      } catch {}
    };
    if (prefix) load();
    return () => (ignore = true);
  }, [prefix]);

  function set(path, value) {
    setForm((f) => {
      const copy = structuredClone(f);
      const seg = path.split(".");
      let cur = copy;
      for (let i = 0; i < seg.length - 1; i++) cur = cur[seg[i]];
      cur[seg.at(-1)] = value;
      return copy;
    });
  }

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function saveEmployee() {
    setResult(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        phone: form.phone.replace(/\D/g, ""), // <<— สำคัญ
        emergency: {
          ...form.emergency,
          phone: form.emergency.phone?.replace(/\D/g, "") || "", // (ถ้าจะเผื่อด้วย)
        },
        prefix,
        dateOfJoin: form.dateOfJoin
          ? new Date(form.dateOfJoin).toLocaleDateString("en-GB") // 👉 dd/mm/yyyy
          : null,

        birthday: form.birthday
          ? new Date(form.birthday).toLocaleDateString("en-GB")
          : null,
      };

      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ ok: false, message: data?.error || "บันทึกไม่สำเร็จ" });
        setSaving(false);
        return;
      }

      setResult({
        ok: true,
        message: `บันทึกสำเร็จ · รหัสพนักงาน ${data.empAutoId}`,
      });
      // แสดงโหลดสักครู่แล้วรีเฟรชหน้า
      setTimeout(() => {
        setConfirmOpen(false);
        setSaving(false);
        window.location.reload();
        // window.location.assign("/dashboard/hrm/employee");
      }, 700);
    } catch (e) {
      setResult({ ok: false, message: "เครือข่ายผิดพลาด" });
      setSaving(false);
    } finally {
      setConfirmOpen(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="space-y-3">
        <h3 className="font-medium text-slate-200">Profile Photo</h3>

        <div className="flex items-center gap-4">
          {/* Preview */}
          <div className="h-20 w-20 rounded-full overflow-hidden ring-1 ring-white/10 bg-white/5 grid place-items-center">
            {preview || form.photoUrl ? (
              <img
                src={preview || form.photoUrl}
                alt="preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs text-slate-400">No photo</span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 ring-1 ring-white/10 cursor-pointer">
              <Upload size={16} />
              <span>{uploading ? "Uploading…" : "Upload"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>

            {(preview || form.photoUrl) && (
              <button
                type="button"
                onClick={clearPhoto}
                className="inline-flex items-center gap-1 rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 ring-1 ring-white/10"
              >
                <X size={16} /> Remove
              </button>
            )}
          </div>
        </div>

        {uploadErr && <p className="text-sm text-red-300">{uploadErr}</p>}
        {form.photoUrl && !uploading && (
          <p className="text-xs text-emerald-300">Uploaded: {form.photoUrl}</p>
        )}
      </section>

      {/* Preview auto-id */}
      <div className="rounded-lg bg-white/5 ring-1 ring-white/10 px-4 py-3 text-slate-300 flex items-center justify-between">
        <div>Employee ID (auto)</div>
        <div className="font-semibold text-indigo-300">
          {previewId || `${prefix}-????`}
        </div>
      </div>

      {/* Required */}
      <section className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">
            First name*
          </label>
          <input
            className={`w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 ring-1
          ${
            errors.firstName
              ? "ring-red-400/60 focus:ring-red-400/70"
              : "ring-white/10 focus:ring-indigo-400/40"
          }`}
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            aria-invalid={!!errors.firstName}
            required
          />
          {errors.firstName && (
            <p className="mt-1 text-xs text-red-300">{errors.firstName}</p>
          )}
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">
            Last name*
          </label>
          <input
            className={`w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 ring-1
          ${
            errors.lastName
              ? "ring-red-400/60 focus:ring-red-400/70"
              : "ring-white/10 focus:ring-indigo-400/40"
          }`}
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            required
          />
          {errors.lastName && (
            <p className="mt-1 text-xs text-red-300">{errors.lastName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1">Nickname</label>
          <input
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 ring-1 ring-white/10"
            value={form.nickName}
            onChange={(e) => set("nickName", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1">
            Department*
          </label>
          <select
            className="select-dark appearance-none pr-10 w-full"
            value={form.department}
            onChange={(e) => set("department", e.target.value)}
            required
          >
            {Object.keys(DEPT_PREFIX).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Prefix: {prefix}</p>
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1">Position*</label>
          <select
            className="select-dark appearance-none pr-10 w-full"
            value={form.position}
            onChange={(e) => set("position", e.target.value)}
            required
          >
            <option value="" disabled>
              เลือกตำแหน่ง
            </option>
            {(positions.length ? positions : ["(กำหนดเอง)"]).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1">
            Date of join*
          </label>
          <input
            type="date"
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 ring-1 ring-white/10"
            value={form.dateOfJoin}
            onChange={(e) => set("dateOfJoin", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1">Phone*</label>
          <input
            inputMode="numeric"
            maxLength={12} // เผื่อขีดด้วย
            pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
            placeholder="0xx-xxx-xxxx"
            className={`w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 ring-1
    ${
      errors.phone
        ? "ring-red-400/60 focus:ring-red-400/70"
        : "ring-white/10 focus:ring-indigo-400/40"
    }`}
            value={form.phone}
            onChange={(e) => {
              // ดึงค่าเฉพาะตัวเลข
              let value = e.target.value.replace(/\D/g, "");

              // จำกัดความยาวไม่เกิน 10 ตัว
              value = value.slice(0, 10);

              // จัดรูปแบบ xxx-xxx-xxxx
              let formatted = value;
              if (value.length > 6) {
                formatted = value.replace(
                  /(\d{3})(\d{3})(\d{0,4})/,
                  "$1-$2-$3"
                );
              } else if (value.length > 3) {
                formatted = value.replace(/(\d{3})(\d{0,3})/, "$1-$2");
              }

              set("phone", formatted);
            }} // ตัดอักขระที่ไม่ใช่เลข
            aria-invalid={!!errors.phone}
          />
          {errors.phone && (
            <p className="mt-1 text-xs text-red-300">{errors.phone}</p>
          )}
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1">Email*</label>
          <input
            type="email"
            placeholder="you@company.com"
            className={`w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 ring-1
      ${
        errors.email
          ? "ring-red-400/60 focus:ring-red-400/70"
          : "ring-white/10 focus:ring-indigo-400/40"
      }`}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-300">{errors.email}</p>
          )}
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1">Birthday</label>
          <input
            type="date"
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 ring-1 ring-white/10"
            value={form.birthday}
            onChange={(e) => set("birthday", e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-slate-300 mb-1">Address</label>
          <textarea
            rows={3}
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-slate-100 ring-1 ring-white/10"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1">Gender</label>
          <select
            className="select-dark appearance-none pr-10 w-full"
            value={form.gender}
            onChange={(e) => set("gender", e.target.value)}
          >
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Emergency Contact (optional) */}
      <section className="space-y-3">
        <h3 className="font-medium text-slate-200">
          Emergency Contact (Optional)
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <input
            placeholder="First name"
            className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10"
            value={form.emergency.firstName}
            onChange={(e) => set("emergency.firstName", e.target.value)}
          />
          <input
            placeholder="Last name"
            className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10"
            value={form.emergency.lastName}
            onChange={(e) => set("emergency.lastName", e.target.value)}
          />
          <input
            placeholder="Relationship"
            className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10"
            value={form.emergency.relationship}
            onChange={(e) => set("emergency.relationship", e.target.value)}
          />
          <input
            placeholder="Phone"
            className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10"
            value={form.emergency.phone}
            onChange={(e) => set("emergency.phone", e.target.value)}
          />
          <input
            placeholder="Email"
            className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10"
            value={form.emergency.email}
            onChange={(e) => set("emergency.email", e.target.value)}
          />
          <input
            placeholder="Address"
            className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 md:col-span-2"
            value={form.emergency.address}
            onChange={(e) => set("emergency.address", e.target.value)}
          />
        </div>
      </section>

      {/* Private Info (Super Admin/HR เท่านั้น) */}
      <section className="space-y-3">
        <h3 className="font-medium text-slate-200">
          Private Information (Admin/HR only) — Optional
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <input
            placeholder="Account holder name"
            className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10"
            value={form.privateInfo.bookbank.accountHolderName}
            onChange={(e) =>
              set("privateInfo.bookbank.accountHolderName", e.target.value)
            }
          />
          <input
            placeholder="Account number"
            className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10"
            value={form.privateInfo.bookbank.accountNumber}
            onChange={(e) =>
              set("privateInfo.bookbank.accountNumber", e.target.value)
            }
          />
          <input
            placeholder="Bank name"
            className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10"
            value={form.privateInfo.bookbank.bankName}
            onChange={(e) =>
              set("privateInfo.bookbank.bankName", e.target.value)
            }
          />
          <input
            placeholder="Branch name"
            className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10"
            value={form.privateInfo.bookbank.branchName}
            onChange={(e) =>
              set("privateInfo.bookbank.branchName", e.target.value)
            }
          />
        </div>
      </section>

      {/* Create account now? */}
      <section className="space-y-3">
        <h3 className="font-medium text-slate-200">Create Account</h3>
        <label className="inline-flex items-center gap-2 text-slate-300">
          <input
            type="checkbox"
            checked={form.createAccount}
            onChange={(e) => set("createAccount", e.target.checked)}
          />
          สร้างบัญชีล็อกอินให้พนักงานทันที (role = employee)
        </label>

        {form.createAccount && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Initial password"
                className="w-full rounded-xl bg-white/5 px-4 py-2.5 pr-10 ring-1 ring-white/10 text-slate-100"
                value={form.accountPassword}
                onChange={(e) => set("accountPassword", e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <select
              className="select-dark appearance-none pr-10 w-full"
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
            >
              <option value="employee">employee</option>
              <option value="manager">manager</option>
              <option value="hr">hr</option>
              <option value="executive">executive</option>
              <option value="it">it</option>
              <option value="payroll">payroll</option>
              <option value="superadmin">superadmin</option>
            </select>
          </div>
        )}
      </section>

      {/* Result + Submit */}
      {result && (
        <div
          className={`rounded-lg px-3 py-2 text-sm border
          ${
            result.ok
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/30 bg-red-500/10 text-red-200"
          }`}
        >
          {result.message}
        </div>
      )}

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={!canSave}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 disabled:opacity-50 px-4 py-2.5 text-white font-medium"
      >
        บันทึก
      </button>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "#FFFFFF", border: "1px solid rgba(0,92,255,0.10)", boxShadow: "0 8px 32px rgba(13,27,42,0.15)" }}>
            <h3 className="text-lg font-semibold" style={{ color: "#0D1B2A" }}>
              ยืนยันการบันทึก
            </h3>
            <p className="text-sm mt-2" style={{ color: "#808A95" }}>
              โปรดตรวจสอบความถูกต้องของข้อมูลพนักงานให้เรียบร้อยก่อนดำเนินการต่อ
            </p>

            {/* แสดงข้อความผลลัพธ์ถ้ามี */}
            {result && (
              <div
                className={`mt-3 rounded-lg px-3 py-2 text-sm border
          ${
            result.ok
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/30 bg-red-500/10 text-red-200"
          }`}
              >
                {result.message}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-xl"
                style={{ background: "#F8FAFD", border: "1px solid #E2E8F0", color: "#334155" }}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={saveEmployee}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
