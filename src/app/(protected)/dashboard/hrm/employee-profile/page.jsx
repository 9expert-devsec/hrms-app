// src/app/(protected)/dashboard/hrm/employee-profile/page.jsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePage } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";

import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import CopyBtn from "./CopyBtn";
import {
  User,
  Briefcase,
  ShieldAlert,
  Lock,
  Zap,
  Pencil,
  KeyRound,
  Ban,
  ArrowLeft,
} from "lucide-react";

export const dynamic = "force-dynamic";

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "2-digit",
      })
    : "-";

const escapeReg = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function EmployeeProfilePage({ searchParams }) {
  const session = await requirePage("self_profile");

  await dbConnect();

  const sp = await searchParams;
  const targetId = sp?.id || null;
  let e = null;

  if (targetId) {
    e = await Employee.findById(targetId).lean();
  } else {
    if (session.user.employeeId) {
      e = await Employee.findById(session.user.employeeId).lean();
    }
    if (!e && session.user.id) {
      e = await Employee.findOne({ userId: session.user.id }).lean();
    }
    if (!e && session.user.email) {
      e = await Employee.findOne({
        email: {
          $regex: new RegExp(`^${escapeReg(session.user.email)}$`, "i"),
        },
      }).lean();
    }
  }

  if (!e) notFound();

  const isSelf =
    String(session.user.employeeId || "") === String(e._id) ||
    session.user.email?.toLowerCase() === e.email?.toLowerCase();

  const canManage = canAccess(session.user, "employees");
  const canSeeSensitive = isSelf || canManage;
  const canEdit = isSelf || canManage;

  const book = e.privateInfo?.bookbank || e.privateInfo || {};
  const bankAccountName =
    book.accountHolderName || book.accountHolder || book.bankAccountName || "-";
  const bankAccountNo = book.accountNumber || book.bankAccountNo || "-";
  const bankName = book.bankName || "-";
  const bankBranch = book.branchName || book.bankBranch || "-";

  const emgPrimary = canSeeSensitive
    ? e.emergency?.primary || e.emergency || null
    : null;

  function normalizeAvatar(u) {
    if (!u) return "/avatar-default.png";
    if (u.startsWith("http") || u.startsWith("data:")) return u;
    return u.startsWith("/") ? u : `/${u}`;
  }
  const avatar = normalizeAvatar(e.photoUrl);

  return (
    <div className="px-6 py-6 container mx-auto space-y-6">
      {/* Breadcrumb + Back */}
      <div className="flex items-center justify-between">
        <h1 style={{ color: "#0D1B2A", fontSize: "1.5rem", fontWeight: 600 }}>Profile</h1>
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
            <ArrowLeft size={14} /> Back
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
              <Pencil size={14} /> Edit
            </Link>
          )}
        </div>
      </div>

      {/* ── Hero Profile Banner ──────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl p-8"
        style={{
          background: "linear-gradient(135deg, #0D1B2A 0%, #005CFF 60%, #2486FF 100%)",
          border: "none",
          boxShadow: "0 4px 24px rgba(0,92,255,0.15)",
        }}
      >
        {/* Decorative elements */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-10"
          style={{ background: "#D4F73F" }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full opacity-[0.06]"
          style={{ background: "#D4F73F" }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Avatar with ring */}
          <div className="relative shrink-0">
            <div
              className="h-28 w-28 rounded-2xl p-[3px]"
              style={{
                background: "linear-gradient(135deg, #D4F73F, #005CFF, #D4F73F)",
              }}
            >
              <div className="relative h-full w-full overflow-hidden rounded-[13px]">
                <Image src={avatar} alt={e.firstName} fill sizes="112px" className="object-cover" />
              </div>
            </div>
            {/* Online dot */}
            <div
              className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-[3px]"
              style={{
                background: "#D4F73F",
                borderColor: "#0D1B2A",
              }}
            />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <h1 style={{ color: "#FFFFFF", fontSize: "20px", fontWeight: 600 }}>
                {e.firstName} {e.lastName}
              </h1>
              {e.nickName && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    background: "rgba(212,247,63,0.15)",
                    color: "#D4F73F",
                  }}
                >
                  {e.nickName}
                </span>
              )}
            </div>
            <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "14px", marginTop: "4px" }}>
              {e.position || "-"}
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs sm:justify-start">
              {[
                { label: "Dept", val: e.department || "-" },
                { label: "Emp ID", val: e.empAutoId || "-" },
                { label: "Joined", val: fmtDate(e.dateOfJoin) },
                { label: "Gender", val: e.gender || "-" },
              ].map((tag) => (
                <span
                  key={tag.label}
                  className="rounded-lg px-3 py-1.5 font-medium"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255,255,255,0.25)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {tag.label}: <span style={{ fontWeight: 600 }}>{tag.val}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Content Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT column */}
        <div className="xl:col-span-2 space-y-6">
          <Card title="Personal Information" Icon={User}>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Info label="Phone" value={e.phone} copyable />
              <Info label="Email" value={e.email} copyable />
              <Info label="Birthday" value={fmtDate(e.birthday)} />
              <Info label="Address" value={e.address || "-"} span />
            </dl>
          </Card>

          <Card title="Employment" Icon={Briefcase}>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Info label="Department" value={e.department || "-"} />
              <Info label="Position" value={e.position || "-"} />
              <Info label="Employee ID" value={e.empAutoId || "-"} />
              <Info label="Date of Join" value={fmtDate(e.dateOfJoin)} />
            </dl>
          </Card>

          <Card title="Emergency Contact" Icon={ShieldAlert}>
            {emgPrimary ? (
              <EmergencyBlock
                title="Emergency Contact"
                data={emgPrimary}
                canView={canSeeSensitive}
              />
            ) : (
              <p style={{ color: "#5E6A7E", fontSize: "14px" }}>
                No emergency contact information available
              </p>
            )}
          </Card>
        </div>

        {/* RIGHT column */}
        <div className="space-y-6">
          <Card
            title="Private Information"
            Icon={Lock}
            right={
              !canSeeSensitive && (
                <span style={{ color: "#5E6A7E", fontSize: "12px" }}>
                  Visible to the owner, HR, and Super Admin only
                </span>
              )
            }
          >
            {canSeeSensitive ? (
              <>
                <dl className="grid gap-3 text-sm">
                  <Info label="Account holder name" value={bankAccountName} />
                  <Info label="Account name / No." value={bankAccountNo} />
                  <Info label="Bank name" value={bankName} />
                  <Info label="Branch name" value={bankBranch} />
                </dl>
                <p style={{ color: "#5E6A7E", fontSize: "12px", marginTop: "12px" }}>
                  Visible to the owner, HR, and Super Admin only
                </p>
              </>
            ) : (
              <p style={{ color: "#5E6A7E", fontSize: "14px" }}>
                You do not have access to this information
              </p>
            )}
          </Card>

          <Card title="Quick actions" Icon={Zap}>
            <div className="flex flex-col gap-2">
              {canEdit ? (
                <>
                  <QuickActionLink
                    href={`/dashboard/hrm/employee/edit?id=${e._id}`}
                    label="Edit employee info"
                    ActionIcon={Pencil}
                  />
                  <QuickActionLink
                    href={`/dashboard/hrm/employee/reset-password?id=${e._id}`}
                    label="Reset password"
                    ActionIcon={KeyRound}
                  />
                  <QuickActionLink
                    href={`/dashboard/hrm/employee/deactivate?id=${e._id}`}
                    label="Deactivate account"
                    ActionIcon={Ban}
                    danger
                  />
                </>
              ) : (
                <p style={{ color: "#5E6A7E", fontSize: "14px" }}>No actions available</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------- small view helpers (server-safe) ---------- */

function Card({ title, children, right, Icon }) {
  return (
    <section
      className="group/card relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(0,92,255,0.10)",
        boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
        style={{
          boxShadow: "0 6px 20px rgba(13,27,42,0.10)",
        }}
      />
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2" style={{ color: "#0D1B2A", fontWeight: 600, fontSize: "15px" }}>
            {Icon && (
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md"
                style={{ background: "rgba(0,92,255,0.08)", color: "#005CFF" }}
              >
                <Icon size={14} strokeWidth={2} />
              </span>
            )}
            {title}
          </h3>
          {right}
        </div>
        {children}
      </div>
    </section>
  );
}

function Info({ label, value, span = false, copyable = false }) {
  const v = value ?? "-";
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <dt style={{ color: "#5E6A7E", fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </dt>
      <dd className="mt-1 flex items-center gap-2" style={{ color: "#334155" }}>
        <span className="truncate">{v}</span>
        {copyable && typeof value === "string" && <CopyBtn text={value} />}
      </dd>
    </div>
  );
}

function QuickActionLink({ href, label, danger = false, ActionIcon }) {
  return (
    <Link
      href={href}
      className="group/action flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium no-underline transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: "#F8FAFD",
        border: "1px solid rgba(0,92,255,0.08)",
        color: danger ? "#DC2626" : "#334155",
      }}
    >
      {ActionIcon && (
        <span style={{ color: danger ? "#DC2626" : "#5E6A7E" }}>
          <ActionIcon size={15} strokeWidth={1.8} />
        </span>
      )}
      {label}
    </Link>
  );
}

function EmergencyBlock({ title, data, canView }) {
  if (!canView) {
    return (
      <div
        className="rounded-xl p-4 text-sm"
        style={{
          background: "#F8FAFD",
          border: "1px solid rgba(0,92,255,0.08)",
          color: "#5E6A7E",
        }}
      >
        Visible to the owner, HR, and Super Admin only
      </div>
    );
  }
  if (!data) {
    return (
      <div
        className="rounded-xl p-4 text-sm"
        style={{
          background: "#F8FAFD",
          border: "1px solid rgba(0,92,255,0.08)",
          color: "#5E6A7E",
        }}
      >
        No data
      </div>
    );
  }
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "#F8FAFD",
        border: "1px solid rgba(0,92,255,0.08)",
      }}
    >
      <h4 style={{ color: "#0D1B2A", fontWeight: 500, marginBottom: "12px" }}>{title}</h4>
      <dl className="grid gap-2 text-sm">
        <Info label="First Name" value={data.firstName || "-"} />
        <Info label="Last Name" value={data.lastName || "-"} />
        <Info label="Relationship" value={data.relationship || "-"} />
        <Info label="Phone" value={data.phone || "-"} />
        <Info label="Email" value={data.email || "-"} />
        <Info label="Address" value={data.address || "-"} />
      </dl>
    </div>
  );
}
