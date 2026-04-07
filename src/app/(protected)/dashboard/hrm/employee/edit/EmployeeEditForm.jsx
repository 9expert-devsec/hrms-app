"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import BankSelect from "@/components/BankSelect";
import { Loader2, Eye, EyeOff } from "lucide-react";

const BANKS = [
  { code: "KTB", name: "KTB (กรุงไทย)", logo: "/banks/ktb.webp" },
  { code: "KBANK", name: "KBank (กสิกร)", logo: "/banks/kbank.png" },
  { code: "SCB", name: "SCB (ไทยพาณิชย์)", logo: "/banks/scb.png" },
];

const GENDERS = [
  { v: "male", label: "ชาย" },
  { v: "female", label: "หญิง" },
  { v: "other", label: "อื่น ๆ" },
];

function ymd(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (isNaN(d)) return "";
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

export default function EmployeeEditForm({
  employee,
  departments,
  linkedUser,
  canAdmin,
}) {
  /* -------------------- Employee state -------------------- */
  const [preview, setPreview] = useState(employee.photoUrl || "");
  const [photoFile, setPhotoFile] = useState(null);
  const [savingEmp, setSavingEmp] = useState(false);
  const [deletingEmp, setDeletingEmp] = useState(false);

  const [firstName, setFirstName] = useState(employee.firstName || "");
  const [lastName, setLastName] = useState(employee.lastName || "");
  const [nickName, setNickName] = useState(employee.nickName || "");

  const [selectedDepId, setSelectedDepId] = useState(
    String(employee.departmentId || "")
  );
  const selectedDep = useMemo(
    () =>
      (departments || []).find((d) => String(d._id) === String(selectedDepId)),
    [departments, selectedDepId]
  );
  const positions = useMemo(() => selectedDep?.positions || [], [selectedDep]);

  // schema เก็บ position = ชื่อ + level เป็น number
  const posMatched = useMemo(
    () => positions.find((p) => p.name === employee.position),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positions]
  );
  const [positionId, setPositionId] = useState(
    posMatched?._id ? String(posMatched._id) : ""
  );
  const [level, setLevel] = useState(posMatched?.level ?? employee.level ?? "");
  useEffect(() => {
    if (!positionId) return setLevel("");
    const p = positions.find((pp) => String(pp._id) === String(positionId));
    setLevel(p?.level ?? "");
  }, [positionId, positions]);

  const [dateOfJoin, setDateOfJoin] = useState(ymd(employee.dateOfJoin));
  const [phone, setPhone] = useState(employee.phone || "");
  const [email, setEmail] = useState(employee.email || "");
  const [birthday, setBirthday] = useState(ymd(employee.birthday));
  const [address, setAddress] = useState(employee.address || "");
  const [gender, setGender] = useState(employee.gender || "other");

  // Emergency
  const [emg, setEmg] = useState({
    firstName: employee.emergency?.firstName || "",
    lastName: employee.emergency?.lastName || "",
    relationship: employee.emergency?.relationship || "",
    phone: employee.emergency?.phone || "",
    email: employee.emergency?.email || "",
    address: employee.emergency?.address || "",
  });

  // PrivateInfo (schema ใหม่เก็บ flat)
  const [bankCode, setBankCode] = useState(
    employee.privateInfo?.bankCode || ""
  );
  const [bankAccountName, setBankAccountName] = useState(
    employee.privateInfo?.bankAccountName || ""
  );
  const [bankAccountNo, setBankAccountNo] = useState(
    employee.privateInfo?.bankAccountNo || ""
  );
  const [bankBranch, setBankBranch] = useState(
    employee.privateInfo?.bankBranch || ""
  );
  const bankSelected = useMemo(
    () => BANKS.find((b) => b.code === bankCode),
    [bankCode]
  );

  /* -------------------- User account state -------------------- */
  const [user, setUser] = useState(linkedUser); // {_id, email, role} | null
  const [userSaving, setUserSaving] = useState(false);
  const [userEmail, setUserEmail] = useState(linkedUser?.email || "");
  const [userRole, setUserRole] = useState(linkedUser?.role || "employee");

  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  const userId = user?._id ? String(user._id) : null;

  /* -------------------- Upload image -------------------- */
  async function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPreview(URL.createObjectURL(f));
  }

  /* -------------------- Save employee -------------------- */
  async function saveEmployee() {
    setSavingEmp(true);
    try {
      let photoUrl = employee.photoUrl || "";

      // ใน EmployeeEditForm.jsx (ฟังก์ชัน saveEmployee)
      if (photoFile) {
        const fd = new FormData();
        fd.append("file", photoFile);
        const up = await fetch("/api/upload", { method: "POST", body: fd });

        // ✨ กัน response ไม่ใช่ JSON
        const uj = await up.json().catch(async () => {
          const txt = await up.text().catch(() => "");
          return { error: txt || "Upload failed" };
        });

        if (!up.ok || !uj?.url) {
          throw new Error(uj?.error || "Upload failed");
        }
        photoUrl = uj.url;
      }

      // map positionId -> position name + level
      let posName = employee.position || "";
      let lvl = level;
      if (positionId) {
        const p = positions.find((pp) => String(pp._id) === String(positionId));
        posName = p?.name || posName;
        lvl = p?.level ?? lvl;
      }

      const payload = {
        firstName,
        lastName,
        nickName,
        department: selectedDep?.code || employee.department,
        departmentId: selectedDep?._id || employee.departmentId,
        position: posName,
        level: Number(lvl) || 0,
        dateOfJoin,
        phone,
        email,
        birthday,
        address,
        gender,
        emergency: emg,
        privateInfo: {
          bankCode: bankCode || "",
          bankName: bankSelected?.name || employee.privateInfo?.bankName || "",
          bankAccountName: bankAccountName || "",
          bankAccountNo: bankAccountNo || "",
          bankBranch: bankBranch || "",
        },
        photoUrl,
      };

      const res = await fetch(`/api/employees/${employee._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "Update failed");

      alert("บันทึกข้อมูลพนักงานเรียบร้อย");
      location.reload();
    } catch (e) {
      alert(e.message || "Save failed");
    } finally {
      setSavingEmp(false);
    }
  }

  /* -------------------- Update user email/role -------------------- */
  async function saveUser() {
    if (!userId) return;
    setUserSaving(true);
    try {
      const r = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, role: userRole }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || "Update user failed");
      alert("บันทึกบัญชีผู้ใช้เรียบร้อย");
    } catch (e) {
      alert(e.message || "Save user failed");
    } finally {
      setUserSaving(false);
    }
  }

  /* -------------------- Reset password -------------------- */
  async function onResetPassword() {
    if (!userId) {
      alert("ไม่พบ userId ของบัญชีนี้");
      return;
    }
    if (!pwd || pwd.length < 6) {
      alert("กรุณาใส่รหัสผ่านอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setPwdSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Reset password failed");
      alert("รีเซ็ตรหัสผ่านสำเร็จ");
      setPwd("");
    } catch (e) {
      alert(e.message || "Reset password failed");
    } finally {
      setPwdSaving(false);
    }
  }

  /* -------------------- Delete employee (with linked user) -------------------- */
  async function deleteEmployee() {
    if (!canAdmin) return;
    if (
      !confirm(
        `ยืนยันลบพนักงาน: ${firstName} ${lastName}\n\nระบบจะลบบัญชีผู้ใช้ที่เชื่อมอยู่ทั้งหมดด้วย`
      )
    )
      return;

    setDeletingEmp(true);
    try {
      const res = await fetch(`/api/employees/${employee._id}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "Delete failed");

      alert("ลบพนักงานเรียบร้อย");
      location.href = "/dashboard/hrm/employee";
    } catch (e) {
      alert(e.message || "Delete failed");
    } finally {
      setDeletingEmp(false);
    }
  }

  /* -------------------- UI -------------------- */
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT: employee form */}
      <div className="lg:col-span-2 space-y-6">
        {/* Avatar */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="font-medium text-slate-100 mb-4">Profile Photo</h3>
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 rounded-2xl overflow-hidden ring-1 ring-white/10">
              <Image
                src={preview || "/avatar-default.png"}
                alt="avatar"
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
            <label className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 ring-1 ring-white/10 hover:bg-white/15 cursor-pointer">
              <span>เลือกไฟล์…</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickFile}
              />
            </label>
          </div>
        </section>

        {/* Basic */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <h3 className="font-medium text-slate-100 mb-2">ข้อมูลพื้นฐาน</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="ชื่อ" value={firstName} onChange={setFirstName} />
            <Input label="นามสกุล" value={lastName} onChange={setLastName} />
            <Input label="ชื่อเล่น" value={nickName} onChange={setNickName} />

            {/* Department */}
            <div>
              <Label>แผนก</Label>
              <select
                className="select-dark appearance-none mt-1 w-full"
                value={selectedDepId}
                onChange={(e) => {
                  setSelectedDepId(e.target.value);
                  setPositionId("");
                }}
              >
                {departments.map((d) => (
                  <option key={d._id} value={String(d._id)}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Position */}
            <div>
              <Label>ตำแหน่ง</Label>
              <select
                className="select-dark appearance-none mt-1 w-full"
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
              >
                <option value="">— เลือกตำแหน่ง —</option>
                {positions.map((p) => (
                  <option key={p._id} value={String(p._id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Level"
              value={String(level ?? "")}
              onChange={(v) => setLevel(v)}
              readOnly
            />

            <Input
              type="date"
              label="วันที่เริ่มงาน"
              value={dateOfJoin}
              onChange={setDateOfJoin}
            />
            <Input
              label="เบอร์โทร"
              value={phone}
              onChange={(v) => setPhone(v.replace(/\D/g, ""))}
            />
            <Input label="อีเมล" value={email} onChange={setEmail} />
            <Input
              type="date"
              label="วันเกิด"
              value={birthday}
              onChange={setBirthday}
            />

            <div className="md:col-span-2">
              <Input label="ที่อยู่" value={address} onChange={setAddress} />
            </div>

            <div>
              <Label>เพศ</Label>
              <select
                className="select-dark appearance-none mt-1 w-full"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                {GENDERS.map((g) => (
                  <option key={g.v} value={g.v}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Emergency */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="font-medium text-slate-100 mb-2">Emergency Contact</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="ชื่อ"
              value={emg.firstName}
              onChange={(v) => setEmg((s) => ({ ...s, firstName: v }))}
            />
            <Input
              label="นามสกุล"
              value={emg.lastName}
              onChange={(v) => setEmg((s) => ({ ...s, lastName: v }))}
            />
            <Input
              label="ความสัมพันธ์"
              value={emg.relationship}
              onChange={(v) => setEmg((s) => ({ ...s, relationship: v }))}
            />
            <Input
              label="เบอร์โทร"
              value={emg.phone}
              onChange={(v) =>
                setEmg((s) => ({ ...s, phone: v.replace(/\D/g, "") }))
              }
            />
            <Input
              label="อีเมล"
              value={emg.email}
              onChange={(v) => setEmg((s) => ({ ...s, email: v }))}
            />
            <div className="md:col-span-2">
              <Input
                label="ที่อยู่"
                value={emg.address}
                onChange={(v) => setEmg((s) => ({ ...s, address: v }))}
              />
            </div>
          </div>
        </section>

        {/* Bookbank */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="font-medium text-slate-100 mb-2">
            Private Information (Bookbank){" "}
            <span className="text-xs text-slate-400">(admin/HR)</span>
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>ธนาคาร</Label>
              <BankSelect
                value={bankCode}
                onChange={setBankCode}
                banks={BANKS}
              />
            </div>
            <Input
              label="ชื่อบัญชี"
              value={bankAccountName}
              onChange={setBankAccountName}
            />
            <Input
              label="เลขที่บัญชี"
              value={bankAccountNo}
              onChange={(v) => setBankAccountNo(v.replace(/\D/g, ""))}
            />
            <div className="md:col-span-2">
              <Input label="สาขา" value={bankBranch} onChange={setBankBranch} />
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            onClick={saveEmployee}
            disabled={savingEmp}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 px-4 py-2.5 text-white ring-1 ring-white/10 disabled:opacity-60"
          >
            {savingEmp && <Loader2 className="size-4 animate-spin" />}
            บันทึกข้อมูลพนักงาน
          </button>

          {canAdmin && (
            <button
              onClick={deleteEmployee}
              disabled={deletingEmp}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600/80 hover:bg-red-600 px-4 py-2.5 text-white ring-1 ring-red-400/40 disabled:opacity-60"
              title="ลบพนักงานและบัญชีผู้ใช้ที่เชื่อมอยู่"
            >
              {deletingEmp && <Loader2 className="size-4 animate-spin" />}
              Delete Employee
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: user account */}
      <div className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="font-medium text-slate-100 mb-2">บัญชีผู้ใช้</h3>

          {!user ? (
            <p className="text-sm text-slate-400">
              ยังไม่ผูกบัญชีกับพนักงานคนนี้
            </p>
          ) : (
            <>
              <Input
                label="อีเมล (ล็อกอิน)"
                value={userEmail}
                onChange={setUserEmail}
                readOnly={!canAdmin}
              />

              <div className="mt-3">
                <Label>สิทธิ์ (Role)</Label>
                <select
                  className="select-dark appearance-none mt-1 w-full"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  disabled={!canAdmin}
                >
                  <option value="employee">employee</option>
                  <option value="manager">manager</option>
                  <option value="hr">hr</option>
                  <option value="payroll">payroll</option>
                  <option value="it">it</option>
                  <option value="executive">executive</option>
                  <option value="superadmin">superadmin</option>
                </select>
              </div>

              {canAdmin && (
                <button
                  onClick={saveUser}
                  disabled={userSaving}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 text-slate-200 ring-1 ring-white/10 disabled:opacity-60"
                >
                  {userSaving && <Loader2 className="size-4 animate-spin" />}
                  บันทึกบัญชีผู้ใช้
                </button>
              )}

              <hr className="my-5 border-white/10" />

              <h4 className="font-medium text-slate-100 mb-2">
                ตั้งรหัสผ่านใหม่
              </h4>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  label="รหัสผ่านใหม่"
                  value={pwd}
                  onChange={setPwd}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-[38px] text-slate-400"
                  title={showPwd ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button
                onClick={onResetPassword}
                disabled={pwdSaving || !canAdmin}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 px-4 py-2.5 text-white ring-1 ring-white/10 disabled:opacity-60"
              >
                {pwdSaving && <Loader2 className="size-4 animate-spin" />}
                รีเซ็ตรหัสผ่าน
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---- tiny UI helpers ---- */
function Label({ children }) {
  return <label className="text-sm" style={{ color: "#808A95" }}>{children}</label>;
}
function Input({ label, value, onChange, type = "text", readOnly = false }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <input
        type={type}
        value={value ?? ""}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1 w-full rounded-xl px-4 py-2.5"
        style={{
          background: "#FFFFFF",
          color: "#0D1B2A",
          border: "1px solid #E2E8F0",
          opacity: readOnly ? 0.7 : 1,
        }}
      />
    </div>
  );
}
