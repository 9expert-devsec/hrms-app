// src/app/(protected)/dashboard/hrm/employee/create/page.jsx
"use client";
 
import { useEffect, useMemo, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import BankSelect from "./../../../../../../components/BankSelect";
import RoleSelect from "./../../../../../../components/RoleSelect";
import TempPasswordDialog from "./../../../../../../components/TempPasswordDialog";
import { prepareUpload, uploadErrorMessage } from "@/lib/client/resizeImage";
import { TITLES_TH, employeeFullNameTh } from "@/lib/employeeName";
import {
  FIELD_LABELS,
  requiredFields,
  validateEmployeeForm,
  fieldFromServerError,
} from "@/lib/employeeFormRules";
import { Req, FieldError, ErrorSummary } from "./../../../../../../components/FormValidation";
// import { NextResponse } from "next/server";
// import dbConnect from "@/lib/mongoose";
// import Employee from "@/lib/models/Employee";

const bankAccRx = /^\d{9,12}$/;

const BANKS = [
  { code: "KTB", name: "KTB (กรุงไทย)", logo: "/banks/ktb.webp" },
  { code: "KBANK", name: "KBank (กสิกร)", logo: "/banks/kbank.png" },
  { code: "SCB", name: "SCB (ไทยพาณิชย์)", logo: "/banks/scb.png" },
];

// export async function POST(req) {
//   try {
//     await dbConnect();

//     // ❗️สำคัญ: อ่านแบบ formData แทน json
//     const form = await req.formData();

//     // Helper: อ่านค่าแบบ string และ trim
//     const g = (key, def = "") => form.get(key)?.toString()?.trim?.() ?? def;

//     // อ่านค่าพื้นฐาน
//     const firstName = g("firstName");
//     const lastName = g("lastName");
//     const nickName = g("nickName");

//     const departmentId = g("departmentId");
//     const department = g("department");

//     const positionId = g("positionId");
//     const positionName = g("positionName");

//     const level = g("level");
//     const dateOfJoin = g("dateOfJoin");
//     const phone = g("phone");
//     const email = g("email");
//     const birthday = g("birthday");
//     const address = g("address");
//     const gender = g("gender");

//     // Emergency
//     const emergency = {
//       firstName: g("emergency.firstName"),
//       lastName: g("emergency.lastName"),
//       relationship: g("emergency.relationship"),
//       phone: g("emergency.phone"),
//       email: g("emergency.email"),
//       address: g("emergency.address"),
//     };

//     // Private Info (Bookbank)
//     const privateInfo = {
//       bankAccountName: g("privateInfo.bankAccountName"),
//       bankAccountNo: g("privateInfo.bankAccountNo"),
//       bankBranch: g("privateInfo.bankBranch"),
//       bankName: g("privateInfo.bankName"),
//       bankCode: g("privateInfo.bankCode"),
//     };

//     // Photo (ไฟล์)
//     const photoFile = form.get("photo"); // อาจเป็น null
//     let photoUrl = "";
//     if (photoFile && typeof photoFile === "object") {
//       const uploaded = await uploadToCloudinary(photoFile, {
//         folder: "employees",
//       });
//       photoUrl = uploaded.secure_url;

//       const arrayBuffer = await photoFile.arrayBuffer();
//       const buffer = Buffer.from(arrayBuffer);

//       photoUrl = "https://...";
//     }

//     // Login fields
//     const createLogin = g("createLogin").toLowerCase() === "true";
//     const accountEmail = g("accountEmail");
//     const password = g("password");
//     const passwordConfirm = g("passwordConfirm");
//     const role = g("role") || "employee";

//     // ✅ Validation ขั้นฐาน (ตัวอย่าง)
//     if (
//       !firstName ||
//       !lastName ||
//       !departmentId ||
//       !positionId ||
//       !dateOfJoin ||
//       !phone ||
//       !email ||
//       !birthday ||
//       !address
//     ) {
//       return NextResponse.json(
//         { ok: false, message: "ข้อมูลจำเป็นไม่ครบ" },
//         { status: 400 }
//       );
//     }

//     if (
//       createLogin &&
//       (!accountEmail || !password || password !== passwordConfirm)
//     ) {
//       return NextResponse.json(
//         { ok: false, message: "ข้อมูลล็อกอินไม่ถูกต้อง" },
//         { status: 400 }
//       );
//     }

//     // ⭐️ ตัวอย่างการรัน EmpID (ปรับให้ตรงกับโมเดลจริงของคุณ)
//     // สมมติ dept มี prefix เช่น 'IT' → EmpID = `${prefix}-${running}`
//     const empIdPrefix = department || "EMP";
//     // หาเลขลำดับล่าสุดในแผนกนี้
//     const lastEmp = await Employee.findOne({ department })
//       .sort({ createdAt: -1 })
//       .lean();
//     const lastRun = lastEmp?.empId?.split("-")?.[1]
//       ? Number(lastEmp.empId.split("-")[1])
//       : 0;
//     const nextRun = String((lastRun || 0) + 1).padStart(4, "0");
//     const empId = `${empIdPrefix}-${nextRun}`;

//     // สร้างพนักงาน
//     const employee = await Employee.create({
//       empId,
//       firstName,
//       lastName,
//       nickName,
//       departmentId,
//       department,
//       positionId,
//       positionName,
//       level,
//       dateOfJoin,
//       phone,
//       email,
//       birthday,
//       address,
//       gender,
//       emergency,
//       privateInfo,
//       photoUrl,
//     });

//     if (createLogin) {
//       await User.create({
//         email: accountEmail,
//         passwordHash: await hash(password, 10),
//         role,
//         employeeId: employee._id,
//       });
//     }

//     return NextResponse.json({ ok: true, employee }, { status: 201 });
//   } catch (err) {
//     console.error("POST /api/employees error:", err);
//     return NextResponse.json(
//       { ok: false, message: err?.message || "Server error" },
//       { status: 500 }
//     );
//   }
// }

export default function EmployeeCreatePage() {
  const submittedRef = useRef(false);
  const router = useRouter();
  const { data: session } = useSession();
  // Role changes are superadmin-only (the API enforces it); others create "employee".
  const canElevate = session?.user?.isSuperadmin === true;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  // --- state พื้นฐาน ---
  const [departments, setDepartments] = useState([]);
  const [selectedDepId, setSelectedDepId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [level, setLevel] = useState("");

  // --- ฟอร์มข้อมูลพนักงาน ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // Thai name — required for a new employee (lib/employeeName.js)
  const [titleTh, setTitleTh] = useState("");
  const [firstNameTh, setFirstNameTh] = useState("");
  const [lastNameTh, setLastNameTh] = useState("");
  const [nickName, setNickName] = useState("");
  const [dateOfJoin, setDateOfJoin] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("ชาย");

  // Bookbank
  const [bankCode, setBankCode] = useState("");
  const bankSelected = useMemo(
    () => BANKS.find((b) => b.code === bankCode),
    [bankCode]
  );
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankBranch, setBankBranch] = useState("");

  // Emergency
  const [emg, setEmg] = useState({
    firstName: "",
    lastName: "",
    relationship: "",
    phone: "",
    email: "",
    address: "",
  });

  // Upload
  const [photoFile, setPhotoFile] = useState(null);
  const [resizing, setResizing] = useState(false);

  // Resized in the browser before upload (lib/client/resizeImage.js).
  async function onPickPhoto(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setResizing(true);
    try {
      setPhotoFile(await prepareUpload(f));
    } catch (err) {
      alert(err.message);
    } finally {
      setResizing(false);
    }
  }

  // สร้างบัญชีสำหรับล็อกอิน — the password is never typed here: the server
  // issues a temporary one, shown once, changed at first sign-in.
  const [createLogin, setCreateLogin] = useState(true);
  const [accountEmail, setAccountEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [tempResult, setTempResult] = useState(null); // { email, tempPassword }, shown once

  // misc
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false); // first บันทึก clicked
  const [serverError, setServerError] = useState(null); // { message, field, value }

  // เลือกแผนก/ตำแหน่ง
  const selectedDep = useMemo(
    () => departments.find((d) => String(d._id) === String(selectedDepId)),
    [selectedDepId, departments]
  );
  const positions = useMemo(() => selectedDep?.positions ?? [], [selectedDep]);

  function handleDepartmentChange(e) {
    const id = e.target.value;
    setSelectedDepId(id);
    setPositionId("");
    setLevel("");
  }
  function handlePositionChange(e) {
    const pid = e.target.value;
    setPositionId(pid);
    const p = positions.find((pp) => String(pp._id) === String(pid));
    setLevel(p?.level ?? "");
  }

  // Validate on บันทึก (lib/employeeFormRules.js): the button stays enabled;
  // problems show under each field and in the summary box above the buttons.
  function handlePreSubmit(e) {
    e.preventDefault();
    setAttempted(true);
    setServerError(null);
    const keys = Object.keys(validateEmployeeForm(formValues, { mode: "create", createLogin }));
    if (keys.length) {
      focusField(keys[0]);
      return;
    }
    setConfirmOpen(true);
  }

  // ดึง Department จริง
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/departments", { cache: "no-store" });
        const j = await r.json();
        if (j?.ok) setDepartments(j.items || []);
      } catch (e) {
        console.error("Fetch departments failed", e);
      }
    })();
  }, []);

  // sync level เมื่อ positions เปลี่ยน
  useEffect(() => {
    if (!positionId) return;
    const p = (positions ?? []).find(
      (pp) => String(pp._id) === String(positionId)
    );
    setLevel(p?.level ?? "");
  }, [positions, positionId]);

  // sync email -> accountEmail (ครั้งแรก/กรณี user ยังไม่แก้เอง)
  useEffect(() => {
    if (!accountEmail) setAccountEmail(email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  // Emp ID Prefix preview
  const empPrefix = selectedDep?.empIdPrefix || selectedDep?.code || "";

  // ---- validation (lib/employeeFormRules.js) ----
  // Nothing is red until the first บันทึก; after that each message clears as
  // soon as its field becomes valid. A server error naming a field stays on
  // that field until its value changes.
  const formValues = {
    titleTh, firstNameTh, lastNameTh, firstName, lastName,
    departmentId: selectedDepId, positionId, dateOfJoin, phone, email, birthday, address, accountEmail,
  };
  const clientErrors = attempted ? validateEmployeeForm(formValues, { mode: "create", createLogin }) : {};
  const serverOnField =
    serverError?.field && !clientErrors[serverError.field] && formValues[serverError.field] === serverError.value;
  const errors = serverOnField ? { ...clientErrors, [serverError.field]: serverError.message } : clientErrors;
  const errorKeys = Object.keys(FIELD_LABELS).filter((k) => errors[k]);
  const fieldProps = (key) => ({
    id: `emp-${key}`,
    "aria-required": requiredFields({ mode: "create", createLogin }).includes(key) ? "true" : undefined,
    "aria-invalid": errors[key] ? "true" : undefined,
    "aria-describedby": errors[key] ? `emp-${key}-error` : undefined,
  });
  const errRing = (key) => (errors[key] ? " !ring-2 !ring-red-500" : "");

  async function doSubmit() {
    if (submittedRef.current) return; // <— กันยิงซ้ำ
    const invalid = Object.keys(validateEmployeeForm(formValues, { mode: "create", createLogin }));
    if (invalid.length) {
      setConfirmOpen(false);
      setAttempted(true);
      focusField(invalid[0]);
      return;
    }
    submittedRef.current = true;
    setPendingSubmit(true);
    setServerError(null);
    try {
        setSubmitting(true);

        const fd = new FormData();
        fd.append("titleTh", titleTh);
        fd.append("firstNameTh", firstNameTh.trim());
        fd.append("lastNameTh", lastNameTh.trim());
        fd.append("firstName", firstName.trim());
        fd.append("lastName", lastName.trim());
        fd.append("nickName", nickName.trim());
        fd.append("departmentId", selectedDepId);
        fd.append("department", selectedDep?.code || selectedDep?.name || "");

        // ส่ง position ทั้ง id และชื่อ (เผื่อ backend อยากใช้)
        fd.append("positionId", positionId);
        const posObj = positions.find(
          (pp) => String(pp._id) === String(positionId)
        );
        fd.append("positionName", posObj?.name || "");

        fd.append("level", String(level));
        fd.append("dateOfJoin", dateOfJoin);
        fd.append("phone", phone);
        fd.append("email", email);
        fd.append("birthday", birthday);
        fd.append("address", address);
        fd.append("gender", gender);

        // Bookbank
        fd.append("privateInfo.bankAccountName", bankAccountName || "");
        fd.append("privateInfo.bankAccountNo", bankAccountNo || "");
        fd.append("privateInfo.bankBranch", bankBranch || "");
        fd.append("privateInfo.bankName", bankSelected?.name || "");
        fd.append("privateInfo.bankCode", bankCode || "");

        // Emergency
        Object.entries(emg).forEach(([k, v]) =>
          fd.append(`emergency.${k}`, v || "")
        );

        if (photoFile) fd.append("photo", photoFile);

        // Login fields
        fd.append("createLogin", String(createLogin));
        if (createLogin) {
          fd.append("accountEmail", accountEmail);
          fd.append("role", canElevate ? role : "employee");
        }

        const res = await fetch("/api/employees", {
          method: "POST",
          body: fd,
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // Shown in the summary box, and on the field when the API names one.
          // A platform 413 (photo too big) has no JSON body.
          const message = res.status === 413 ? uploadErrorMessage(res, data) : data?.message || "สร้างไม่สำเร็จ";
          const field = res.status === 413 ? null : fieldFromServerError(data);
          setServerError({ message, field, value: field ? formValues[field] : undefined });
          setConfirmOpen(false);
          if (field) focusField(field);
          submittedRef.current = false;
          return;
        }

        setConfirmOpen(false);
        if (data?.account?.tempPassword) {
          // Reload only after the creator has seen the one-time password.
          setTempResult({ email: data.account.email, tempPassword: data.account.tempPassword });
          return;
        }
        alert("สร้างพนักงานสำเร็จ");
        window.location.reload();
        return;
    } catch (err) {
      console.error(err);
      setServerError({ message: err.message || "สร้างไม่สำเร็จ", field: null });
      setConfirmOpen(false);
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
      setPendingSubmit(false);
    }
  }

  // Scroll to and focus a field (by its emp-<key> id).
  function focusField(key) {
    requestAnimationFrame(() => {
      const el = document.getElementById(`emp-${key}`);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.focus({ preventScroll: true });
    });
  }

  return (
    <div className="flex flex-col justify-center p-6 space-y-6 max-w-7xl m-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            Create Employee
          </h1>
          <p className="text-slate-400">
            บันทึกข้อมูลพนักงานใหม่ โดยใช้ข้อมูลแผนกจริง
          </p>
        </div>
      </div>

      <form
        onSubmit={handlePreSubmit}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <div className="lg:col-span-2 space-y-6">
          {/* Avatar */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-medium text-slate-100 mb-4">รูปโปรไฟล์</h2>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 rounded-2xl overflow-hidden ring-1 ring-white/10">
                <Image
                  src={
                    photoFile
                      ? URL.createObjectURL(photoFile)
                      : "/avatar-default.png"
                  }
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
                  onChange={onPickPhoto}
                />
              </label>
            </div>
          </section>

          {/* Basic Info */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-medium text-slate-100 mb-4">
              ข้อมูลพื้นฐาน (จำเป็น)
            </h2>

            {/* Thai name (required) — above the English name */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label htmlFor="emp-titleTh" className="text-sm text-slate-300">คำนำหน้าชื่อ<Req /></label>
                <select
                  {...fieldProps("titleTh")}
                  className={`mt-1 w-full rounded-xl bg-slate-800 px-4 py-2.5 ring-1 ring-slate-700 text-white${errRing("titleTh")}`}
                  value={titleTh}
                  onChange={(e) => setTitleTh(e.target.value)}
                >
                  <option value="">-- เลือก --</option>
                  {TITLES_TH.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <FieldError k="titleTh" errors={errors} />
              </div>
              <div>
                <label htmlFor="emp-firstNameTh" className="text-sm text-slate-300">ชื่อ (ไทย)<Req /></label>
                <input
                  {...fieldProps("firstNameTh")}
                  className={`mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100${errRing("firstNameTh")}`}
                  value={firstNameTh}
                  onChange={(e) => setFirstNameTh(e.target.value)}
                />
                <FieldError k="firstNameTh" errors={errors} />
              </div>
              <div>
                <label htmlFor="emp-lastNameTh" className="text-sm text-slate-300">นามสกุล (ไทย)<Req /></label>
                <input
                  {...fieldProps("lastNameTh")}
                  className={`mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100${errRing("lastNameTh")}`}
                  value={lastNameTh}
                  onChange={(e) => setLastNameTh(e.target.value)}
                />
                <FieldError k="lastNameTh" errors={errors} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="emp-firstName" className="text-sm text-slate-300">ชื่อ (อังกฤษ)<Req /></label>
                <input
                  {...fieldProps("firstName")}
                  className={`mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100${errRing("firstName")}`}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <FieldError k="firstName" errors={errors} />
              </div>
              <div>
                <label htmlFor="emp-lastName" className="text-sm text-slate-300">นามสกุล (อังกฤษ)<Req /></label>
                <input
                  {...fieldProps("lastName")}
                  className={`mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100${errRing("lastName")}`}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
                <FieldError k="lastName" errors={errors} />
              </div>
              <div>
                <label className="text-sm text-slate-300">ชื่อเล่น</label>
                <input
                  className="mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
                  value={nickName}
                  onChange={(e) => setNickName(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="emp-departmentId" className="text-sm text-slate-300">แผนก<Req /></label>
                <select
                  {...fieldProps("departmentId")}
                  className={`mt-1 w-full rounded-xl bg-slate-800 px-4 py-2.5 ring-1 ring-slate-700 text-white${errRing("departmentId")}`}
                  value={selectedDepId}
                  onChange={(e) => setSelectedDepId(e.target.value)}
                >
                  <option value="">-- เลือกแผนก --</option>
                  {departments.map((d) => (
                    <option key={d._id} value={String(d._id)}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
                <FieldError k="departmentId" errors={errors} />
              </div>

              <div>
                <label htmlFor="emp-positionId" className="text-sm text-slate-300 mt-4 block">
                  ตำแหน่ง<Req />
                </label>
                <select
                  {...fieldProps("positionId")}
                  className={`mt-1 w-full rounded-xl bg-slate-800 px-4 py-2.5 ring-1 ring-slate-700 text-white${errRing("positionId")}`}
                  disabled={!selectedDepId}
                  value={positionId}
                  onChange={handlePositionChange}
                >
                  <option value="">-- เลือกตำแหน่ง --</option>
                  {positions.map((p) => (
                    <option key={p._id} value={String(p._id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <FieldError k="positionId" errors={errors} />
              </div>

              <div>
                <label className="text-sm text-slate-300 mt-4 block">
                  Level
                </label>
                <input
                  className="mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
                  value={level ?? ""}
                  readOnly
                />
              </div>

              <div>
                <label htmlFor="emp-dateOfJoin" className="text-sm text-slate-300">วันที่เริ่มงาน<Req /></label>
                <input
                  type="date"
                  {...fieldProps("dateOfJoin")}
                  className={`mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100${errRing("dateOfJoin")}`}
                  value={dateOfJoin}
                  onChange={(e) => setDateOfJoin(e.target.value)}
                />
                <FieldError k="dateOfJoin" errors={errors} />
              </div>

              <div>
                <label htmlFor="emp-phone" className="text-sm text-slate-300">
                  เบอร์โทร (10 หลัก)<Req />
                </label>
                <input
                  inputMode="numeric"
                  maxLength={10} // กันกรอกด้วย
                  {...fieldProps("phone")}
                  className={`mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100${errRing("phone")}`}
                  value={phone}
                  onChange={(e) => {
                    const onlyDigits = e.target.value.replace(/\D/g, "");
                    setPhone(onlyDigits.slice(0, 10)); // จำกัดแค่ 10 หลัก
                  }}
                />
                <FieldError k="phone" errors={errors} />
              </div>

              <div>
                <label htmlFor="emp-email" className="text-sm text-slate-300">อีเมล<Req /></label>
                <input
                  {...fieldProps("email")}
                  className={`mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100${errRing("email")}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <FieldError k="email" errors={errors} />
              </div>

              <div>
                <label htmlFor="emp-birthday" className="text-sm text-slate-300">วันเกิด<Req /></label>
                <input
                  type="date"
                  {...fieldProps("birthday")}
                  className={`mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100${errRing("birthday")}`}
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
                <FieldError k="birthday" errors={errors} />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="emp-address" className="text-sm text-slate-300">ที่อยู่<Req /></label>
                <input
                  {...fieldProps("address")}
                  className={`mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100${errRing("address")}`}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <FieldError k="address" errors={errors} />
              </div>

              <div>
                <label className="text-sm text-slate-300">เพศ</label>
                <select
                  className="mt-1 w-full rounded-xl bg-slate-800 px-4 py-2.5 ring-1 ring-slate-700 text-white"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="ชาย">ชาย</option>
                  <option value="หญิง">หญิง</option>
                  <option value="อื่น ๆ">อื่น ๆ</option>
                </select>
              </div>
            </div>

            {/* preview Emp ID prefix */}
            <p className="mt-4 text-sm text-slate-400">
              Emp ID Prefix:{" "}
              <span className="text-indigo-300 font-medium">
                {empPrefix || "-"}
              </span>{" "}
              (รันเลขตอนบันทึก)
            </p>
          </section>

          {/* Emergency */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-medium text-slate-100 mb-4">
              Emergency Contact (ไม่บังคับ)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                placeholder="ชื่อ"
                className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
                value={emg.firstName}
                onChange={(e) =>
                  setEmg((s) => ({ ...s, firstName: e.target.value }))
                }
              />
              <input
                placeholder="นามสกุล"
                className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
                value={emg.lastName}
                onChange={(e) =>
                  setEmg((s) => ({ ...s, lastName: e.target.value }))
                }
              />
              <input
                placeholder="ความสัมพันธ์"
                className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
                value={emg.relationship}
                onChange={(e) =>
                  setEmg((s) => ({ ...s, relationship: e.target.value }))
                }
              />
              <input
                placeholder="เบอร์โทร"
                className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
                value={emg.phone}
                onChange={(e) =>
                  setEmg((s) => ({
                    ...s,
                    phone: e.target.value.replace(/\D/g, ""),
                  }))
                }
              />
              <input
                placeholder="อีเมล"
                className="rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
                value={emg.email}
                onChange={(e) =>
                  setEmg((s) => ({ ...s, email: e.target.value }))
                }
              />
              <input
                placeholder="ที่อยู่"
                className="md:col-span-2 rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
                value={emg.address}
                onChange={(e) =>
                  setEmg((s) => ({ ...s, address: e.target.value }))
                }
              />
            </div>
          </section>

          {/* Private Info (Bookbank) */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-medium text-slate-100 mb-4">
              Private Information (Bookbank){" "}
              <span className="text-slate-400 text-xs">(ไม่บังคับกรอก)</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm text-slate-300">ธนาคาร</label>
                <BankSelect
                  value={bankCode}
                  onChange={setBankCode}
                  banks={BANKS}
                />
              </div>

              <div>
                <label className="text-sm text-slate-300">ชื่อบัญชี</label>
                <input
                  placeholder="Account holder name"
                  className="mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-slate-300">เลขที่บัญชี</label>
                <input
                  placeholder="เช่น 1234567890"
                  maxLength={12}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
                  value={bankAccountNo}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    setBankAccountNo(digits.slice(0, 12)); // จำกัดสูงสุด 12 หลัก
                  }}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-slate-300">สาขา</label>
                <input
                  placeholder="เช่น สาขาสีลม"
                  className="mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Login Account */}
          <div className="rounded-xl border border-white/10 p-4 mt-6">
            <div className="flex items-center justify-between">
              <p className="font-medium">บัญชีผู้ใช้สำหรับล็อกอิน</p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-indigo-500"
                  checked={createLogin}
                  onChange={(e) => setCreateLogin(e.target.checked)}
                />
                <span>สร้างบัญชีให้พนักงาน</span>
              </label>
            </div>

            {createLogin && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="md:col-span-1">
                  <label htmlFor="emp-accountEmail" className="text-sm text-slate-300">
                    อีเมล (ใช้ล็อกอิน)<Req />
                  </label>
                  <input
                    {...fieldProps("accountEmail")}
                    className={`mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10${errRing("accountEmail")}`}
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                  />
                  <FieldError k="accountEmail" errors={errors} />
                </div>

                <div className="md:col-span-1">
                  <label className="text-sm text-slate-300">รหัสผ่าน</label>
                  <p className="text-xs text-slate-400 mt-2">
                    ระบบจะสร้างรหัสผ่านชั่วคราวและแสดงครั้งเดียวหลังบันทึก —
                    พนักงานต้องตั้งรหัสใหม่เมื่อเข้าสู่ระบบครั้งแรก
                  </p>
                </div>

                <div className="md:col-span-1">
                  <label className="text-sm text-slate-300">
                    สิทธิ์ (Role)
                  </label>
                  {canElevate ? (
                    <RoleSelect
                      className="mmt-1 w-full rounded-xl bg-slate-800 px-4 py-2.5 ring-1 ring-slate-700 text-white"
                      value={role}
                      onChange={setRole}
                    />
                  ) : null}
                  {!canElevate && (
                    <p className="text-xs text-slate-400 mt-1">
                      สิทธิ์เริ่มต้นคือ <b>Employee</b>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <ErrorSummary errorKeys={errorKeys} serverError={serverError} serverOnField={serverOnField} />

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 ring-1 ring-white/10 text-slate-200 hover:bg-white/15"
            >
              ยกเลิก
            </button>
            {/* Enabled whenever no save is in flight — problems are listed on click. */}
            <button
              type="submit"
              disabled={submitting || resizing}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 disabled:opacity-50 px-4 py-2.5 text-white ring-1 ring-white/10"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              บันทึก
            </button>

            {confirmOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div className="w-full max-w-lg rounded-2xl bg-slate-800 ring-1 ring-white/10 p-6">
                  <h3 className="text-slate-100 font-semibold">
                    ยืนยันการบันทึกข้อมูลพนักงาน
                  </h3>
                  <p className="text-slate-400 text-sm mt-2">
                    โปรดตรวจสอบข้อมูลให้ถูกต้องก่อนยืนยัน
                    ระบบจะทำการบันทึกและรีเฟรชหน้านี้ 1 ครั้ง
                  </p>

                  {/* สรุปสั้น ๆ (ใส่ตามที่อยาก preview) */}
                  <div className="mt-4 text-sm text-slate-300 space-y-1">
                    <div>
                      ชื่อ-สกุล:{" "}
                      <b>{employeeFullNameTh({ titleTh, firstNameTh, lastNameTh }) || "-"}</b>{" "}
                      / {firstName} {lastName} ({nickName || "-"})
                    </div>
                    <div>
                      แผนก/ตำแหน่ง:{" "}
                      <b>
                        {selectedDep?.code || "-"} /{" "}
                        {positions.find(
                          (p) => String(p._id) === String(positionId)
                        )?.name || "-"}
                      </b>
                    </div>
                    <div>
                      เบอร์: <b>{phone}</b> | อีเมล: <b>{email}</b>
                    </div>
                    {createLogin && (
                      <div>
                        สร้างบัญชีล็อกอิน: <b>{accountEmail}</b> (Role:{" "}
                        {canElevate ? role : "employee"})
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      disabled={pendingSubmit}
                      onClick={() => setConfirmOpen(false)}
                      className="rounded-xl bg-white/10 px-4 py-2.5 ring-1 ring-white/10 text-slate-200 hover:bg-white/15"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={doSubmit}
                      aria-busy={pendingSubmit}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 px-4 py-2.5 text-white ring-1 ring-white/10 disabled:opacity-60"
                      disabled={pendingSubmit || submittedRef.current}
                    >
                      {pendingSubmit && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      ยืนยันบันทึก
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>

      {tempResult && (
        <TempPasswordDialog
          email={tempResult.email}
          tempPassword={tempResult.tempPassword}
          onClose={() => {
            setTempResult(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
