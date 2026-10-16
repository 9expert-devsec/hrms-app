"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import BankSelect from "./../../../../../../components/BankSelect";
import RoleSelect from "./../../../../../../components/RoleSelect";
import ResetPasswordDialog from "./../../../../../../components/ResetPasswordDialog";
import { Loader2 } from "lucide-react";
import { canAccess } from "@/lib/rbac/access";
import { accountActionBlock, linkActionBlock } from "@/lib/rbac/accountRules";
import EmployeeAccountLink from "./EmployeeAccountLink";
import { TITLES_TH, thaiNameError, employeeDisplayName } from "@/lib/employeeName";
import { prepareUpload, uploadErrorMessage } from "@/lib/client/resizeImage";

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
  const [resizing, setResizing] = useState(false);
  const [savingEmp, setSavingEmp] = useState(false);
  const [deletingEmp, setDeletingEmp] = useState(false);

  const [firstName, setFirstName] = useState(employee.firstName || "");
  const [lastName, setLastName] = useState(employee.lastName || "");
  // Thai name: optional for existing staff, but a stored value can't be cleared.
  const [titleTh, setTitleTh] = useState(employee.titleTh || "");
  const [firstNameTh, setFirstNameTh] = useState(employee.firstNameTh || "");
  const [lastNameTh, setLastNameTh] = useState(employee.lastNameTh || "");
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
  const { data: session } = useSession();
  const isSuperadmin = session?.user?.isSuperadmin === true;


  const userId = user?._id ? String(user._id) : null;

  /* -------------------- Upload image -------------------- */
  // Resized in the browser before upload (lib/client/resizeImage.js).
  async function onPickFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setResizing(true);
    try {
      const ready = await prepareUpload(f);
      setPhotoFile(ready);
      setPreview(URL.createObjectURL(ready));
    } catch (err) {
      alert(err.message);
    } finally {
      setResizing(false);
    }
  }

  /* -------------------- Save employee -------------------- */
  async function saveEmployee() {
    setSavingEmp(true);
    try {
      // Same rule as the server: a Thai name already stored may not be cleared.
      const thaiError = thaiNameError({ titleTh, firstNameTh, lastNameTh }, { mode: "edit", current: employee });
      if (thaiError) throw new Error(thaiError);

      let photoUrl = employee.photoUrl || "";
      let photoPublicId = employee.photoPublicId || "";

      if (photoFile) {
        const fd = new FormData();
        fd.append("file", photoFile);
        const up = await fetch("/api/upload", { method: "POST", body: fd });

        // A platform 413 has no JSON body; uploadErrorMessage maps it to Thai.
        const uj = await up.json().catch(() => ({}));

        if (!up.ok || !uj?.url) {
          throw new Error(uploadErrorMessage(up, uj));
        }
        photoUrl = uj.url;
        photoPublicId = uj.public_id || "";
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
        titleTh,
        firstNameTh,
        lastNameTh,
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
        photoPublicId,
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

  /* -------------------- Account actions: users_manage holders (and superadmin) -------------------- */
  // Reset and sign-in email changes follow the users page's guard rails
  // (accountActionBlock): never your own account, never a superadmin account
  // for a non-superadmin.
  const canManageAccount = !!userId && canAccess(session?.user, "users_manage");
  const accountTarget = { id: userId, isSuperadmin: linkedUser?.role === "superadmin", status: linkedUser?.status };
  const blockFor = (action) =>
    canManageAccount
      ? accountActionBlock({ actor: session?.user, target: accountTarget, action, activeSuperadminCount: Infinity })
      : null;
  const resetBlock = blockFor("reset");
  const emailBlock = blockFor("email");
  const canEditEmail = canManageAccount && !emailBlock;
  const [resetOpen, setResetOpen] = useState(false);

  /* -------------------- Update user email/role -------------------- */
  async function saveUser() {
    if (!userId) return;
    // Same path and validation as the users page (PATCH /api/users/[id] → changeAccountEmail).
    const body = {};
    if (canEditEmail && userEmail.trim().toLowerCase() !== (linkedUser?.email || "").toLowerCase()) body.email = userEmail;
    if (isSuperadmin) body.role = userRole; // the API refuses role changes otherwise
    if (!Object.keys(body).length) return alert("ไม่มีการเปลี่ยนแปลง");
    setUserSaving(true);
    try {
      const r = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) throw new Error(j?.message || "Update user failed");
      alert(body.email ? "บันทึกแล้ว — ผู้ใช้ต้องเข้าสู่ระบบด้วยอีเมลใหม่" : "บันทึกบัญชีผู้ใช้เรียบร้อย");
      location.reload();
    } catch (e) {
      alert(e.message || "Save user failed");
    } finally {
      setUserSaving(false);
    }
  }

  /* -------------------- Unlink the account (it stays, with its role) -------------------- */
  const emailMismatch =
    !!userId &&
    (linkedUser?.email || "").trim().toLowerCase() !== (employee.email || "").trim().toLowerCase();
  const unlinkBlock = userId
    ? linkActionBlock({
        actor: session?.user,
        target: { id: userId, isSuperadmin: linkedUser?.role === "superadmin" },
        action: "unlink",
      })
    : null;
  const [unlinking, setUnlinking] = useState(false);

  async function onUnlink() {
    if (!userId || unlinkBlock) return;
    if (!confirm(`ยกเลิกการผูกบัญชี ${linkedUser?.email} กับพนักงานคนนี้?\n\nบัญชียังอยู่และคงสิทธิ์เดิม`)) return;
    setUnlinking(true);
    try {
      const r = await fetch(`/api/employees/${employee._id}/account`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.message || j.error || "ยกเลิกการผูกไม่สำเร็จ");
      location.reload();
    } catch (e) {
      alert(e.message);
    } finally {
      setUnlinking(false);
    }
  }

  /* -------------------- Delete employee (the linked account is kept) -------------------- */
  async function deleteEmployee() {
    if (!canAdmin) return;
    if (
      !confirm(
        `ยืนยันลบพนักงาน: ${employeeDisplayName({ firstName, lastName, firstNameTh, lastNameTh })}\n\nบัญชีผู้ใช้ที่ผูกอยู่จะไม่ถูกลบ (จะถูกยกเลิกการผูก) — ระงับหรือลบบัญชีได้ที่หน้าผู้ใช้`
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
                className="object-cover object-top"
              />
            </div>
            <label className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 ring-1 ring-white/10 hover:bg-white/15 cursor-pointer">
              <span>{resizing ? "กำลังปรับขนาดรูป…" : "เลือกไฟล์…"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={resizing}
                onChange={onPickFile}
              />
            </label>
          </div>
        </section>

        {/* Basic */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <h3 className="font-medium text-slate-100 mb-2">ข้อมูลพื้นฐาน</h3>
          {/* Thai name — above the English name */}
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>คำนำหน้าชื่อ</Label>
              <select
                value={titleTh}
                onChange={(e) => setTitleTh(e.target.value)}
                className="mt-1 w-full rounded-xl px-4 py-2.5"
                style={{ background: "#FFFFFF", color: "#0D1B2A", border: "1px solid #E2E8F0" }}
              >
                {/* An empty choice only while nothing is stored yet. */}
                {!employee.titleTh && <option value="">-- เลือก --</option>}
                {TITLES_TH.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <Input label="ชื่อ (ไทย)" value={firstNameTh} onChange={setFirstNameTh} />
            <Input label="นามสกุล (ไทย)" value={lastNameTh} onChange={setLastNameTh} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="ชื่อ (อังกฤษ)" value={firstName} onChange={setFirstName} />
            <Input label="นามสกุล (อังกฤษ)" value={lastName} onChange={setLastName} />
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
            disabled={savingEmp || resizing}
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
              title="ลบพนักงาน (บัญชีผู้ใช้ที่ผูกอยู่จะถูกยกเลิกการผูก ไม่ถูกลบ)"
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
            canAdmin ? (
              <EmployeeAccountLink
                employeeId={String(employee._id)}
                employeeEmail={employee.email || ""}
                isSuperadmin={isSuperadmin}
              />
            ) : (
              <p className="text-sm text-slate-400">
                ยังไม่ผูกบัญชีกับพนักงานคนนี้
              </p>
            )
          ) : (
            <>
              {/* Sign-in email: users_manage holders and superadmin only (guard rails). */}
              <Input
                label="อีเมล (ล็อกอิน)"
                value={userEmail}
                onChange={setUserEmail}
                readOnly={!canEditEmail}
              />
              {!canEditEmail && (
                <p className="mt-1 text-xs" style={{ color: "#5E6A7E" }} title={emailBlock?.error}>
                  {emailBlock?.error || "เปลี่ยนอีเมลเข้าสู่ระบบได้เฉพาะผู้ดูแลบัญชีผู้ใช้"}
                </p>
              )}
              {emailMismatch && (
                <div className="mt-2 text-xs rounded-lg px-3 py-2" style={{ background: "#FEF3C7", color: "#92400E" }}>
                  อีเมลของบัญชีไม่ตรงกับอีเมลพนักงาน ({employee.email || "—"})
                  {canEditEmail && employee.email && (
                    <button
                      type="button"
                      onClick={() => setUserEmail(employee.email)}
                      className="block mt-1 underline font-semibold"
                    >
                      ใช้อีเมลเดียวกับพนักงาน
                    </button>
                  )}
                </div>
              )}

              {/* Role changes are superadmin-only (the API enforces it too). */}
              {isSuperadmin && (
                <div className="mt-3">
                  <Label>สิทธิ์ (Role)</Label>
                  <RoleSelect
                    className="select-dark appearance-none mt-1 w-full"
                    value={userRole}
                    onChange={setUserRole}
                  />
                </div>
              )}

              {(canEditEmail || isSuperadmin) && (
                <button
                  onClick={saveUser}
                  disabled={userSaving}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 text-slate-200 ring-1 ring-white/10 disabled:opacity-60"
                >
                  {userSaving && <Loader2 className="size-4 animate-spin" />}
                  บันทึกบัญชีผู้ใช้
                </button>
              )}

              {canManageAccount && (
                <>
                  <hr className="my-5 border-white/10" />

                  <h4 className="font-medium text-slate-100 mb-1">รีเซ็ตรหัสผ่าน</h4>
                  <p className="text-xs mb-3" style={{ color: "#5E6A7E" }}>
                    กำหนดรหัสผ่านเอง หรือให้ระบบสุ่ม — ผู้ใช้ต้องตั้งรหัสใหม่เมื่อเข้าสู่ระบบครั้งถัดไป
                  </p>
                  <span title={resetBlock?.error}>
                    <button
                      onClick={() => setResetOpen(true)}
                      disabled={!!resetBlock}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 px-4 py-2.5 text-white ring-1 ring-white/10 disabled:opacity-60"
                    >
                      รีเซ็ตรหัสผ่าน
                    </button>
                  </span>
                </>
              )}

              {canAdmin && (
                <>
                  <hr className="my-5 border-white/10" />
                  <h4 className="font-medium text-slate-100 mb-1">ยกเลิกการผูก</h4>
                  <p className="text-xs mb-3" style={{ color: "#5E6A7E" }}>
                    บัญชียังอยู่และคงสิทธิ์เดิม แต่จะไม่เห็นข้อมูลของพนักงานคนนี้อีก
                  </p>
                  <span title={unlinkBlock?.error}>
                    <button
                      onClick={onUnlink}
                      disabled={unlinking || !!unlinkBlock}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 text-slate-200 ring-1 ring-white/10 disabled:opacity-60"
                    >
                      {unlinking && <Loader2 className="size-4 animate-spin" />}
                      ยกเลิกการผูก
                    </button>
                  </span>
                </>
              )}
            </>
          )}
        </section>
      </div>

      {resetOpen && userId && (
        <ResetPasswordDialog
          user={{ _id: userId, email: linkedUser?.email || "" }}
          onClose={() => setResetOpen(false)}
          onDone={(mode) => {
            if (mode === "typed") alert("ตั้งรหัสผ่านแล้ว — ผู้ใช้ต้องเปลี่ยนรหัสเมื่อเข้าสู่ระบบครั้งถัดไป");
          }}
        />
      )}
    </div>
  );
}

/* ---- tiny UI helpers ---- */
function Label({ children }) {
  return <label className="text-sm" style={{ color: "#5E6A7E" }}>{children}</label>;
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
