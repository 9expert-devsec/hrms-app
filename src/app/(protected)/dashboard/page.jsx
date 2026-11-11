// src/app/(protected)/dashboard/page.jsx
// Server component: real data only (lib/dashboard.js). Every block shows only
// to users who can open the page it summarises.
import Image from "next/image";
import Link from "next/link";
import {
  Users,
  Building2,
  UserPlus,
  MapPin,
  Mail,
  PenLine,
  ClipboardCheck,
  Clock,
  ChevronRight,
  Plus,
  UserCircle2,
  KeyRound,
  Briefcase,
  UserCog,
} from "lucide-react";
import { requirePage } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import dbConnect from "@/lib/mongoose";
import { dashboardData } from "@/lib/dashboard";
import Avatar from "../../../components/Avatar";

export const dynamic = "force-dynamic";

const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const LIME = "#D4F73F";
const SLATE = "#5E6A7E";
const LINE = "#E3EAF5";
const TINT = "#EEF4FF";
const ROW = "#F5F8FF";

const CARD = { background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 16 };

const INBOX_META = {
  offsite_invites: { Icon: Mail, sub: "ตอบรับและเซ็นชื่อยืนยันการไปปฏิบัติงาน" },
  offsite_approvals: { Icon: PenLine, sub: "ลงนามหรือยืนยันอีกครั้ง" },
  leave_approvals: { Icon: ClipboardCheck, sub: "ตรวจและอนุมัติใบลา" },
  ot_approvals: { Icon: Clock, sub: "" },
};

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const first = (w) => (w.replace(/^[เแโใไ]/, "")[0] || w[0] || "").toUpperCase();
  return parts.slice(0, 2).map(first).join("") || "?";
}

function IconTile({ Icon, size = 36, bg = TINT }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[10px]" style={{ width: size, height: size, background: bg, color: BLUE }}>
      <Icon size={18} aria-hidden />
    </span>
  );
}

function CardHeader({ title, href, linkLabel = "ดูทั้งหมด" }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold" style={{ color: NAVY }}>{title}</h2>
      {href && (
        <Link href={href} className="text-sm font-medium no-underline hover:underline" style={{ color: BLUE }}>
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

/* ── A. greeting band ─────────────────────────────────────────── */
function Greeting({ d }) {
  const tiles = [{ value: d.inbox.total, label: "รอคุณดำเนินการ", testid: "tile-inbox" }];
  if (d.monthMine !== null) tiles.push({ value: d.monthMine, label: "งานนอกสถานที่เดือนนี้", testid: "tile-offsite-month" });
  return (
    <section
      className="relative overflow-hidden rounded-[20px] p-5 md:rounded-[24px] md:px-8 md:py-7"
      style={{ background: "linear-gradient(135deg, #0D1B2A 0%, #005CFF 65%, #2486FF 100%)" }}
      data-testid="greeting"
    >
      <Image
        src="/brand/symbol-statelight.png"
        alt=""
        aria-hidden
        width={380}
        height={468}
        sizes="(min-width: 768px) 380px, 230px"
        priority
        className="pointer-events-none absolute -top-12 right-[-24px] h-auto w-[230px] select-none md:-top-20 md:right-[-8px] md:w-[380px]"
        style={{ opacity: 0.14 }}
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm" style={{ color: "#AFC4E6" }} data-testid="greeting-date">{d.dateTh}</p>
          <h1 className="mt-1 text-[22px] font-bold leading-tight text-white md:text-[30px]">
            Welcome back, <span style={{ color: LIME }} data-testid="greeting-name">{d.firstName}</span>
          </h1>
          {d.chip && (
            <span className="mt-3 inline-block rounded-full px-3 py-1 text-[13px] text-white" style={{ background: "rgba(255,255,255,0.12)" }} data-testid="greeting-chip">
              {d.chip}
            </span>
          )}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-3 lg:flex">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl px-4 py-3 lg:min-w-[156px]" style={{ background: "rgba(255,255,255,0.10)" }} data-testid={t.testid}>
              <div className="text-[28px] font-bold leading-none" style={{ color: LIME }}>{t.value}</div>
              <div className="mt-1.5 text-[13px]" style={{ color: "#DCE6F7" }}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── B. stat cards ────────────────────────────────────────────── */
function Stats({ s }) {
  if (!s) return null;
  const cards = [
    s.employees && { key: "employees", label: "พนักงานทั้งหมด", Icon: Users, value: s.employees.value, sub: "คนในระบบ" },
    s.departments && { key: "departments", label: "แผนก", Icon: Building2, value: s.departments.value, sub: "แผนกที่มีพนักงาน" },
    s.newThisMonth && {
      key: "new",
      label: "พนักงานใหม่เดือนนี้",
      Icon: UserPlus,
      value: s.newThisMonth.value,
      sub: s.newThisMonth.latest ? `เริ่มงาน ${s.newThisMonth.latest}` : "ยังไม่มีในเดือนนี้",
    },
    s.offsiteThisMonth && {
      key: "offsite",
      label: "คำขอนอกสถานที่เดือนนี้",
      Icon: MapPin,
      value: s.offsiteThisMonth.value,
      sub: `อนุมัติแล้ว ${s.offsiteThisMonth.approved} · กำลังดำเนินการ ${s.offsiteThisMonth.inProgress}`,
    },
  ].filter(Boolean);
  if (!cards.length) return null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="stats">
      {cards.map((c) => (
        <div key={c.key} className="p-5" style={CARD} data-testid={`stat-${c.key}`}>
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm font-medium" style={{ color: SLATE }}>{c.label}</span>
            <IconTile Icon={c.Icon} />
          </div>
          <div className="mt-2 text-[34px] font-bold leading-none" style={{ color: NAVY }} data-testid="stat-value">{c.value}</div>
          <div className="mt-2 text-[13px]" style={{ color: SLATE }} data-testid="stat-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ── C1. รอคุณดำเนินการ ─────────────────────────────────────────── */
function Inbox({ inbox }) {
  return (
    <section className="p-5 md:p-6" style={CARD} data-testid="dash-inbox">
      <CardHeader title="รอคุณดำเนินการ" />
      {inbox.items.length ? (
        <ul className="space-y-3">
          {inbox.items.map((it) => {
            const meta = INBOX_META[it.key] || { Icon: Mail, sub: "" };
            return (
              <li key={it.key}>
                <Link href={it.href} className="flex min-h-[56px] items-center gap-3 rounded-xl px-4 py-3 no-underline transition-colors hover:bg-[#EAF1FF]" style={{ background: ROW }} data-testid={`dash-inbox-${it.key}`}>
                  <IconTile Icon={meta.Icon} bg="#FFFFFF" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold" style={{ color: NAVY }}>{it.label}</span>
                    {meta.sub && <span className="block text-[13px]" style={{ color: SLATE }}>{meta.sub}</span>}
                  </span>
                  <span className="min-w-[26px] rounded-full px-2 py-0.5 text-center text-xs font-bold" style={{ background: LIME, color: NAVY }}>{it.count}</span>
                  <ChevronRight size={18} style={{ color: SLATE }} aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex items-center gap-4 rounded-xl px-5 py-5" style={{ background: ROW }} data-testid="dash-inbox-empty">
          <Image src="/brand/symbol-cloud.png" alt="" aria-hidden width={36} height={44} className="h-11 w-auto shrink-0" />
          <div>
            <p className="text-[15px] font-semibold" style={{ color: NAVY }}>ไม่มีงานค้าง</p>
            <p className="text-[13px]" style={{ color: SLATE }}>เมื่อมีคำเชิญหรือคำขอที่รอคุณ จะแสดงที่นี่</p>
          </div>
        </div>
      )}
    </section>
  );
}

function Chip({ children, tone }) {
  const tones = {
    blue: { background: TINT, color: BLUE },
    grey: { background: "#F1F3F7", color: SLATE },
    amber: { background: "#FFF4D6", color: "#9A5B00" },
    green: { background: "#E6F7EC", color: "#157F3D" },
  };
  return <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium" style={tones[tone]}>{children}</span>;
}

/* ── C2. งานนอกสถานที่ที่กำลังจะถึง ─────────────────────────────── */
function Upcoming({ rows }) {
  if (rows === null) return null;
  return (
    <section className="p-5 md:p-6" style={CARD} data-testid="dash-upcoming">
      <CardHeader title="งานนอกสถานที่ที่กำลังจะถึง" href="/dashboard/offsite" />
      {rows.length ? (
        <ul>
          {rows.map((r, i) => {
            const meta = [r.placeName, r.time, `${r.memberCount} คน`].filter(Boolean).join(" · ");
            const statusTone = r.status === "approved" ? "green" : "amber";
            return (
              <li key={r.id} style={i > 0 ? { borderTop: `1px solid ${LINE}` } : undefined}>
                <Link href={`/dashboard/offsite/${r.id}`} className="flex items-center gap-4 rounded-xl py-3 no-underline transition-colors hover:bg-[#F8FAFE]" data-testid="dash-upcoming-row">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-center leading-none" style={{ background: TINT }}>
                    <span>
                      <span className="block text-[22px] font-bold" style={{ color: BLUE }}>{r.day}</span>
                      <span className="mt-1 block text-xs" style={{ color: BLUE }}>{r.month}</span>
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold" style={{ color: NAVY }} data-testid="dash-upcoming-name">{r.jobName}</span>
                    <span className="block text-[13px]" style={{ color: SLATE }}>{meta}</span>
                    <span className="block text-[13px] md:hidden" style={{ color: statusTone === "green" ? "#157F3D" : "#9A5B00" }}>{r.statusLabel}</span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-2 md:flex">
                    <Chip tone={r.isLeader ? "blue" : "grey"}>{r.isLeader ? "หัวหน้าทีม" : "สมาชิก"}</Chip>
                    <Chip tone={statusTone}>{r.statusLabel}</Chip>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl px-5 py-5 text-sm" style={{ background: ROW, color: SLATE }}>ยังไม่มีงานนอกสถานที่ที่กำลังจะถึง</p>
      )}
    </section>
  );
}

/* ── C3. คำขอของฉันที่กำลังดำเนินการ ─────────────────────────────── */
function MyRequests({ rows }) {
  if (!rows?.length) return null;
  return (
    <section className="p-5 md:p-6" style={CARD} data-testid="dash-myrequests">
      <CardHeader title="คำขอของฉันที่กำลังดำเนินการ" href="/dashboard/offsite" />
      <ul className="space-y-3">
        {rows.map((r) => {
          const { position, done } = r.progress;
          return (
            <li key={r.id}>
              <Link href={`/dashboard/offsite/${r.id}`} className="block rounded-xl p-4 no-underline transition-colors hover:bg-[#F8FAFE]" style={{ border: `1px solid ${LINE}` }} data-testid="dash-myrequest-row">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[15px] font-semibold" style={{ color: NAVY }}>{r.jobName}</span>
                  {r.docNo && <span className="shrink-0 text-xs" style={{ color: SLATE }}>{r.docNo}</span>}
                </span>
                <span className="mt-3 flex gap-1.5" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: done || i < position ? BLUE : i === position ? LIME : LINE }} />
                  ))}
                </span>
                <span className="mt-2 block text-[13px]" style={{ color: SLATE }} data-testid="dash-myrequest-caption">{r.caption}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── D1. ข้อมูลของฉัน ──────────────────────────────────────────── */
function Profile({ p }) {
  if (!p) return null;
  const rows = [
    { Icon: Building2, label: "แผนก", value: p.department },
    { Icon: Briefcase, label: "ตำแหน่ง", value: p.position },
    { Icon: UserCog, label: "หัวหน้าแผนก", value: p.head },
  ];
  return (
    <section className="hidden p-5 md:block md:p-6" style={CARD} data-testid="dash-profile">
      <CardHeader title="ข้อมูลของฉัน" />
      <div className="flex items-center gap-4">
        <Avatar
          src={p.photoUrl}
          size={56}
          alt=""
          fallback={
            <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-lg font-bold text-white" style={{ background: BLUE }}>
              {initials(p.initialsFrom)}
            </span>
          }
        />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold" style={{ color: NAVY }}>{p.name}</p>
          <p className="text-[13px]" style={{ color: SLATE }}>ชื่อเล่น: {p.nickName || "—"}</p>
        </div>
      </div>
      <dl className="mt-4 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 text-sm">
            <r.Icon size={16} style={{ color: SLATE }} aria-hidden />
            <dt style={{ color: SLATE }}>{r.label}</dt>
            <dd className="ml-auto text-right font-medium" style={{ color: NAVY }}>{r.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ── D2. เมนูลัด ───────────────────────────────────────────────── */
function QuickLinks({ user, linked }) {
  const links = [
    linked && canAccess(user, "offsite_self") && { href: "/dashboard/offsite/new", label: "สร้างคำขอทำงานนอกสถานที่", Icon: Plus },
    linked && canAccess(user, "self_profile") && { href: "/dashboard/hrm/employee-profile/signature", label: "ลายเซ็นของฉัน", Icon: PenLine },
    linked && canAccess(user, "self_profile") && { href: "/dashboard/hrm/employee-profile/edit", label: "แก้ไขโปรไฟล์ของฉัน", Icon: UserCircle2 },
    { href: "/account/password", label: "เปลี่ยนรหัสผ่าน", Icon: KeyRound },
  ].filter(Boolean);
  return (
    <section className="p-5 md:p-6" style={CARD} data-testid="dash-quicklinks">
      <CardHeader title="เมนูลัด" />
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex min-h-[48px] items-center gap-3 rounded-xl px-2 py-1.5 no-underline transition-colors hover:bg-[#F5F8FF]" data-testid="dash-quicklink">
              <IconTile Icon={l.Icon} />
              <span className="flex-1 text-[15px]" style={{ color: NAVY }}>{l.label}</span>
              <ChevronRight size={18} style={{ color: SLATE }} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function DashboardPage() {
  const session = await requirePage("dashboard");
  await dbConnect();
  const d = await dashboardData(session);

  return (
    <div className="mx-auto max-w-[1360px] space-y-5 md:space-y-6">
      <Greeting d={d} />
      <Stats s={d.stats} />
      <div className="grid grid-cols-1 gap-5 md:gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 space-y-5 md:space-y-6">
          <Inbox inbox={d.inbox} />
          <Upcoming rows={d.upcoming} />
          <MyRequests rows={d.myRequests} />
        </div>
        <div className="min-w-0 space-y-5 md:space-y-6">
          <Profile p={d.profile} />
          <QuickLinks user={session.user} linked={d.linked} />
        </div>
      </div>
    </div>
  );
}
