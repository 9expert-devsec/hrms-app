// src/app/(protected)/dashboard/hrm/employee-profile/page.jsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePage } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import { profileAccess } from "@/lib/rbac/scopes";
import { departmentIdOf, employeeOfUser } from "@/lib/rbac/scopeQueries";
import { UnlinkedNotice } from "./../../../../../components/SelfServiceGate";
import { employeeDisplayName, employeeFullNameTh, employeeNameEn } from "@/lib/employeeName";

import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import CopyBtn from "./CopyBtn";
import { Zap, Pencil, KeyRound, ArrowLeft, PenLine } from "lucide-react";

export const dynamic = "force-dynamic";

// The view shows these fields only; everything else (email, birthday,
// address, employment, bank, emergency contact) lives on the edit page.
const PROFILE_FIELDS =
  "_id userId photoUrl titleTh firstNameTh lastNameTh firstName lastName nickName phone department departmentId position";

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

  const canManage = canAccess(session.user, "employees");
  const canEdit = isSelf || canManage;

  const dept = e.departmentId ? await Department.findById(e.departmentId).select("name code").lean() : null;
  const departmentLabel = dept?.name || e.department || "-";

  function normalizeAvatar(u) {
    if (!u) return "/avatar-default.png";
    if (u.startsWith("http") || u.startsWith("data:")) return u;
    return u.startsWith("/") ? u : `/${u}`;
  }
  const avatar = normalizeAvatar(e.photoUrl);
  const nameTh = employeeFullNameTh(e) || employeeDisplayName(e) || "-";

  return (
    <div className="px-6 py-6 container mx-auto space-y-6" style={{ maxWidth: 960 }}>
      <div className="flex items-center justify-between">
        <h1 style={{ color: "#0D1B2A", fontSize: "1.5rem", fontWeight: 600 }}>โปรไฟล์</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/hrm/employee"
            className="group inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium no-underline transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(0,92,255,0.10)",
              color: "#334155",
              boxShadow: "0 1px 4px rgba(13,27,42,0.06)",
            }}
          >
            <ArrowLeft size={14} /> กลับ
          </Link>
          {canEdit && (
            <Link
              href={`/dashboard/hrm/employee/edit?id=${e._id}`}
              className="group inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium no-underline transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(135deg, #005CFF, #2486FF)",
                color: "#FFFFFF",
                boxShadow: "0 2px 12px rgba(0,92,255,0.3)",
              }}
            >
              <Pencil size={14} /> แก้ไข
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Profile card ───────────────────────────── */}
        <section
          className="lg:col-span-2 overflow-hidden rounded-3xl"
          style={{ background: "#FFFFFF", border: "1px solid rgba(0,92,255,0.10)", boxShadow: "0 2px 8px rgba(13,27,42,0.06)" }}
          data-testid="profile-card"
        >
          <div className="h-20" style={{ background: "linear-gradient(135deg, #0D1B2A 0%, #005CFF 60%, #2486FF 100%)" }} />
          <div className="flex flex-col items-center gap-6 px-6 pb-6 sm:flex-row sm:items-end">
            <div className="-mt-12 shrink-0">
              <div className="h-28 w-28 rounded-2xl p-[3px]" style={{ background: "linear-gradient(135deg, #D4F73F, #005CFF, #D4F73F)" }}>
                <div className="relative h-full w-full overflow-hidden rounded-[13px] bg-white">
                  {/* Full photo, top-anchored (no face crop on the profile page). */}
                  <Image src={avatar} alt={nameTh} fill sizes="112px" className="object-cover object-top" />
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h2 style={{ color: "#0D1B2A", fontSize: "20px", fontWeight: 700 }}>{nameTh}</h2>
              <p style={{ color: "#5E6A7E", fontSize: "14px" }}>{e.position || "-"}</p>
            </div>
          </div>

          <dl className="grid gap-x-6 gap-y-4 border-t px-6 py-5 text-sm sm:grid-cols-2" style={{ borderColor: "rgba(0,92,255,0.08)" }}>
            <Info label="ชื่อ-นามสกุล" value={nameTh} />
            <Info label="ชื่อ-นามสกุล (อังกฤษ)" value={employeeNameEn(e) || "-"} />
            <Info label="ชื่อเล่น" value={e.nickName || "-"} />
            <Info label="เบอร์โทร" value={e.phone || "-"} copyable={!!e.phone} />
            <Info label="แผนก" value={departmentLabel} />
            <Info label="ตำแหน่ง" value={e.position || "-"} />
          </dl>
        </section>

        {/* ── Quick actions ──────────────────────────── */}
        <section
          className="rounded-2xl p-5 self-start"
          style={{ background: "#FFFFFF", border: "1px solid rgba(0,92,255,0.10)", boxShadow: "0 2px 8px rgba(13,27,42,0.06)" }}
        >
          <h3 className="mb-4 flex items-center gap-2" style={{ color: "#0D1B2A", fontWeight: 600, fontSize: "15px" }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: "rgba(0,92,255,0.08)", color: "#005CFF" }}>
              <Zap size={14} strokeWidth={2} />
            </span>
            การดำเนินการ
          </h3>
          <div className="flex flex-col gap-2">
            {canEdit ? (
              <>
                <QuickActionLink href={`/dashboard/hrm/employee/edit?id=${e._id}`} label="แก้ไขข้อมูลพนักงาน" ActionIcon={Pencil} />
                {/* Own password only (requires the current one); someone
                    else's is reset with a temporary password on the users
                    page. Suspending is a users_manage action, not here. */}
                {isSelf && <QuickActionLink href="/account/password" label="เปลี่ยนรหัสผ่าน" ActionIcon={KeyRound} />}
                {/* Own signature only (off-site requests are signed with it). */}
                {isSelf && <QuickActionLink href="/dashboard/hrm/employee-profile/signature" label="แก้ไขลายเซ็น" ActionIcon={PenLine} />}
              </>
            ) : (
              <p style={{ color: "#5E6A7E", fontSize: "14px" }}>ไม่มีรายการ</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------- small view helpers (server-safe) ---------- */

function Info({ label, value, copyable = false }) {
  const v = value ?? "-";
  return (
    <div>
      <dt style={{ color: "#5E6A7E", fontSize: "12px", fontWeight: 500 }}>{label}</dt>
      <dd className="mt-1 flex items-center gap-2" style={{ color: "#0D1B2A", fontSize: "15px" }}>
        <span className="truncate">{v}</span>
        {copyable && typeof value === "string" && <CopyBtn text={value} />}
      </dd>
    </div>
  );
}

function QuickActionLink({ href, label, ActionIcon }) {
  return (
    <Link
      href={href}
      className="group/action flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium no-underline transition-all duration-200 hover:-translate-y-0.5"
      style={{ background: "#F8FAFD", border: "1px solid rgba(0,92,255,0.08)", color: "#334155" }}
    >
      {ActionIcon && (
        <span style={{ color: "#5E6A7E" }}>
          <ActionIcon size={15} strokeWidth={1.8} />
        </span>
      )}
      {label}
    </Link>
  );
}
