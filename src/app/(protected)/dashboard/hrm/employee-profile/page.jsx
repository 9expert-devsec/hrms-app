// src/app/(protected)/dashboard/hrm/employee-profile/page.jsx
// Own profile (no ?id) and someone else's (?id=, the slimmed view). Same data
// and access as before — only the layout changed.
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, ChevronRight, KeyRound, PenLine, Pencil, User } from "lucide-react";
import { requirePage } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import { profileAccess } from "@/lib/rbac/scopes";
import { departmentIdOf, employeeOfUser } from "@/lib/rbac/scopeQueries";
import { getSignature } from "@/lib/offsite";
import { employeeDisplayName, employeeFullNameTh, employeeNameEn } from "@/lib/employeeName";
import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import { UnlinkedNotice } from "./../../../../../components/SelfServiceGate";
import { initialsOf } from "./../../../../../components/PersonAvatar";
import CopyBtn from "./CopyBtn";

export const dynamic = "force-dynamic";

// The view shows these fields only; everything else (email, birthday,
// address, employment, bank, emergency contact) lives on the edit page.
const PROFILE_FIELDS =
  "_id userId photoUrl titleTh firstNameTh lastNameTh firstName lastName nickName phone department departmentId position";

const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const LIME = "#D4F73F";
const SLATE = "#5E6A7E";
// #C9D7F0 in the design is 3.64:1 on #005CFF — this is the nearest shade that passes AA (4.54:1).
const SUBTLE_ON_BLUE = "#E8EEF9";

function photoSrc(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return u.startsWith("/") ? u : `/${u}`;
}

const clean = (v) => (typeof v === "string" ? v.trim() : "");

export default async function EmployeeProfilePage({ searchParams }) {
  const session = await requirePage("self_profile");
  await dbConnect();

  const sp = await searchParams;
  const targetId = sp?.id || null;
  let e = null;

  if (targetId) {
    e = await Employee.findById(targetId).select(PROFILE_FIELDS).lean().catch(() => null);
  } else {
    // Own profile = the linked employee only (lib/accountLinks.js).
    e = await employeeOfUser(session.user.id, PROFILE_FIELDS);
    if (!e) return <UnlinkedNotice />;
  }
  if (!e) notFound();

  // Self = linked to this account, never an email match.
  const isSelf = !!e.userId && String(e.userId) === String(session.user.id || "");

  // Someone else's profile: employees / users_manage holders, superadmin, a
  // head of their department, or a colleague in the same department (ทีมของฉัน
  // links). Anyone else gets 404, so the page does not confirm the person exists.
  const access = profileAccess(session.user, {
    targetEmployeeId: e._id,
    targetDepartmentId: await departmentIdOf(e),
    targetDepartmentCode: e.department,
  });
  if (!isSelf && !access.canView) notFound();

  // Own profile → the self-edit page (photo, nickname, phone). Someone else's →
  // the HR edit page, only for those who may open it (`employees`).
  const edit = isSelf
    ? { href: "/dashboard/hrm/employee-profile/edit", label: "แก้ไขโปรไฟล์" }
    : canAccess(session.user, "employees")
      ? { href: `/dashboard/hrm/employee/edit?id=${e._id}`, label: "แก้ไขข้อมูลพนักงาน" }
      : null;

  const [dept, signature] = await Promise.all([
    e.departmentId ? Department.findById(e.departmentId).select("name code").lean() : null,
    isSelf ? getSignature(e._id) : null,
  ]);

  const department = dept?.name || clean(e.department);
  const position = clean(e.position);
  const nickName = clean(e.nickName);
  const phone = clean(e.phone);
  const nameEn = employeeNameEn(e);
  const thaiFull = employeeFullNameTh(e);
  const display = employeeDisplayName(e);
  const thaiName = thaiFull || (display && display !== nameEn ? display : "");
  const heroName = thaiName || nameEn || "—";

  const personal = (
    <Card title="ข้อมูลส่วนตัว" Icon={User} testid="profile-personal">
      <Fields>
        <Field label="ชื่อ-นามสกุล (ไทย)" value={thaiName} />
        <Field label="ชื่อ-นามสกุล (อังกฤษ)" value={nameEn} />
        <Field label="ชื่อเล่น" value={nickName} />
      </Fields>
    </Card>
  );
  const contact = (
    <Card title="การติดต่อและการทำงาน" Icon={Building2} testid="profile-contact">
      <Fields>
        <Field label="เบอร์โทร" value={phone} extra={phone ? <CopyBtn text={phone} /> : null} />
        <Field label="แผนก" value={department} />
        <Field label="ตำแหน่ง" value={position} />
      </Fields>
    </Card>
  );

  return (
    <div className="-m-6 min-h-full px-4 py-4 md:px-8 md:py-7" style={{ background: "#F5F7FB" }}>
      <div className="mx-auto max-w-[1360px] space-y-4 md:space-y-6">
        <Hero name={heroName} nameEn={thaiName ? nameEn : ""} nickName={nickName} position={position} department={department} photo={photoSrc(e.photoUrl)} edit={edit} />

        {isSelf ? (
          // Phone/tablet: one column, contact → personal → signature → account.
          // Desktop: personal + contact on the left, account + signature on the right.
          <div className="flex flex-col gap-4 md:gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
              <div className="order-2 min-w-0 lg:order-none">{personal}</div>
              <div className="order-1 min-w-0 lg:order-none">{contact}</div>
            </div>
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6" data-testid="profile-right">
              <div className="order-4 min-w-0 lg:order-none">
                <Card title="บัญชีและความปลอดภัย" Icon={KeyRound} testid="profile-account">
                  <Link
                    href="/account/password"
                    data-testid="profile-password"
                    className="flex min-h-[44px] items-center gap-3 rounded-[14px] p-3.5 no-underline transition-colors hover:bg-[#EEF4FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005CFF]"
                    style={{ background: "#F5F8FF" }}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white" style={{ color: BLUE }}>
                      <KeyRound size={16} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold" style={{ color: NAVY }}>เปลี่ยนรหัสผ่าน</span>
                      <span className="block text-[12px]" style={{ color: SLATE }}>แนะนำให้เปลี่ยนเป็นระยะ</span>
                    </span>
                    <ChevronRight size={16} style={{ color: SLATE }} aria-hidden />
                  </Link>
                </Card>
              </div>
              <div className="order-3 min-w-0 lg:order-none">
                <SignatureCard png={signature?.png || null} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 md:gap-6">
            {personal}
            {contact}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── A. hero ──────────────────────────────────────────────────── */
function Hero({ name, nameEn, nickName, position, department, photo, edit }) {
  const chip = "rounded-full px-3 py-1 text-[13px] font-medium";
  return (
    <section
      className="relative overflow-hidden rounded-[24px] p-8"
      style={{ background: "linear-gradient(135deg, #0D1B2A 0%, #005CFF 65%, #2486FF 100%)" }}
      data-testid="profile-hero"
    >
      <Image
        src="/brand/symbol-statelight.png"
        alt=""
        aria-hidden
        width={380}
        height={468}
        sizes="(min-width: 768px) 380px, 240px"
        priority
        className="pointer-events-none absolute -top-12 right-[-24px] h-auto w-[240px] select-none md:-top-20 md:right-[-8px] md:w-[380px]"
        style={{ opacity: 0.14 }}
        data-testid="profile-watermark"
      />
      <div className="relative flex flex-col items-center gap-5 text-center md:flex-row md:gap-7 md:text-left">
        <div
          className="relative h-[112px] w-[112px] shrink-0 overflow-hidden rounded-[24px] md:h-[148px] md:w-[148px] md:rounded-[28px]"
          style={{ border: `3px solid ${LIME}`, background: "#DCE6F7" }}
          data-testid="profile-photo"
        >
          {photo ? (
            // Full photo, top-anchored (no face crop on the profile page).
            <Image src={photo} alt={name} fill sizes="148px" className="object-cover object-top" />
          ) : (
            <span aria-hidden className="grid h-full w-full place-items-center text-[36px] font-bold md:text-[44px]" style={{ color: BLUE }}>
              {initialsOf(name)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="break-words text-[22px] font-bold leading-tight text-white md:text-[30px]" data-testid="profile-name">{name}</h1>
          {nameEn && (
            <p className="mt-1 break-words text-[15px] font-medium md:text-[17px]" style={{ color: SUBTLE_ON_BLUE }} data-testid="profile-name-en">
              {nameEn}
            </p>
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start" data-testid="profile-chips">
            {nickName && <span className={chip} style={{ background: LIME, color: NAVY }}>ชื่อเล่น {nickName}</span>}
            {position && <span className={`${chip} text-white`} style={{ background: "rgba(255,255,255,0.14)" }}>{position}</span>}
            {department && <span className={`${chip} text-white`} style={{ background: "rgba(255,255,255,0.14)" }}>{department}</span>}
          </div>
        </div>

        {edit && (
          <Link
            href={edit.href}
            data-testid="profile-edit"
            className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-[15px] font-semibold no-underline transition-colors hover:bg-[#EEF4FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:w-auto"
            style={{ color: BLUE }}
          >
            <Pencil size={16} aria-hidden /> {edit.label}
          </Link>
        )}
      </div>
    </section>
  );
}

/* ── B. cards ─────────────────────────────────────────────────── */
function Card({ title, Icon, action, testid, children }) {
  return (
    <section className="rounded-[20px] bg-white px-5 py-[18px] md:px-6 md:py-[22px]" style={{ border: "1px solid #E3EAF5" }} data-testid={testid}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px]" style={{ background: "#EEF4FF", color: BLUE }}>
          <Icon size={16} aria-hidden />
        </span>
        <h2 className="min-w-0 flex-1 text-[17px] font-bold" style={{ color: NAVY }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fields({ children }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">{children}</dl>;
}

function Field({ label, value, extra = null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px]" style={{ color: SLATE }}>{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2 text-[16px] font-medium" style={{ color: NAVY }}>
        <span className="min-w-0 break-words">{value || "—"}</span>
        {extra}
      </dd>
    </div>
  );
}

function SignatureCard({ png }) {
  const action = (
    <Link
      href="/dashboard/hrm/employee-profile/signature"
      data-testid="profile-signature-link"
      className="inline-flex min-h-[44px] items-center text-[14px] font-medium no-underline hover:underline"
      style={{ color: BLUE }}
    >
      {png ? "แก้ไข" : "เพิ่มลายเซ็น"}
    </Link>
  );
  return (
    <Card title="ลายเซ็นของฉัน" Icon={PenLine} action={action} testid="profile-signature">
      <div
        className="flex min-h-[106px] flex-col items-center justify-center gap-1.5 rounded-[14px] px-4 py-3 text-center"
        style={{ background: "#F5F8FF", border: "1px solid #D6E0F0" }}
      >
        {png ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- stored PNG data URL, shown in its own ink colour */}
            <img src={png} alt="ลายเซ็นของฉัน" className="max-h-14 w-auto max-w-full object-contain" data-testid="profile-signature-img" />
            <span aria-hidden className="block h-px w-[220px] max-w-full" style={{ background: "#9AA5B4" }} />
            <span className="text-[12px]" style={{ color: SLATE }}>ใช้ในใบลาและเอกสารทำงานนอกสถานที่</span>
          </>
        ) : (
          <span className="text-[14px]" style={{ color: SLATE }} data-testid="profile-signature-empty">ยังไม่มีลายเซ็น</span>
        )}
      </div>
    </Card>
  );
}
