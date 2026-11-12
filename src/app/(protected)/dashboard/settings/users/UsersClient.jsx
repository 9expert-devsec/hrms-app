"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  KeyRound,
  Link2,
  Loader2,
  LockOpen,
  Mail,
  MoreHorizontal,
  Search,
  Trash2,
  Unlink,
  UserCog,
  UserPlus,
  X,
} from "lucide-react";
import { accountActionBlock, accountDeleteBlock, linkActionBlock, roleChangeBlock } from "@/lib/rbac/accountRules";
import { roleDisplay, sortRoles } from "@/lib/rbac/roleDisplay";
import { fullDateTimeTh, lastSeenTh, timeTh } from "@/lib/relativeTimeTh";
import ResetPasswordDialog from "../../../../../components/ResetPasswordDialog";
import TempPasswordDialog from "../../../../../components/TempPasswordDialog";
import PersonAvatar from "../../../../../components/PersonAvatar";
import {
  BLUE,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FOCUS,
  INPUT,
  LINE,
  MUTED,
  NAVY,
  PAGE,
  PAGE_BG,
  SLATE,
} from "../../../../../components/hr/hrUi";

const RED = "#B91C1C";

/** First match wins: ระงับ → ล็อกอยู่ (lock still ahead) → ต้องเปลี่ยนรหัส → ใช้งาน. */
function accountState(u, now = Date.now()) {
  if (u.status === "suspended") return "suspended";
  if (u.lockedUntil && new Date(u.lockedUntil).getTime() > now) return "locked";
  if (u.mustChangePassword) return "mustChange";
  return "active";
}

const TABS = [
  { key: "all", label: "ทั้งหมด", test: () => true },
  { key: "active", label: "ใช้งาน", test: (u, s) => s === "active" },
  { key: "suspended", label: "ระงับ", test: (u, s) => s === "suspended" },
  { key: "locked", label: "ล็อกอยู่", test: (u, s) => s === "locked" },
  { key: "unlinked", label: "ไม่ได้ผูกพนักงาน", test: (u) => !u.employee },
];

function StatusPill({ u, state }) {
  const map = {
    suspended: { bg: "#FEE2E2", color: RED, text: "ระงับ" },
    locked: { bg: "#FEF3C7", color: "#92400E", text: `ล็อกอยู่ ถึง ${u.lockedUntil ? timeTh(u.lockedUntil) : ""}` },
    mustChange: { bg: "#EEF4FF", color: BLUE, text: "ต้องเปลี่ยนรหัส" },
    active: { bg: "#DCFCE7", color: "#15803D", text: "ใช้งาน" },
  };
  const s = map[state];
  return (
    <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: s.bg, color: s.color }} data-testid="user-status" data-state={state}>
      {s.text}
    </span>
  );
}

function RolePill({ roleKey, role }) {
  const d = roleDisplay(roleKey, role);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-medium" style={{ background: "#F5F7FB", color: NAVY }} data-testid="user-role" data-role={roleKey}>
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
      {d.name}
    </span>
  );
}

export default function UsersClient({ initial, actor }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  useEffect(() => setData(initial), [initial]);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const [confirm, setConfirm] = useState(null); // { user, action: "suspend" | "activate" | "unlock" | "unlink" }
  const [deleting, setDeleting] = useState(null); // { user, typed } — superadmin delete dialog
  const [roleFor, setRoleFor] = useState(null); // { user, role } — role change dialog (superadmin)
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState(null); // user — ResetPasswordDialog
  const [editingEmail, setEditingEmail] = useState(null); // { user, value, error }
  const [picker, setPicker] = useState(null); // { mode: "create" } | { mode: "link", user } — EmployeePicker
  const [created, setCreated] = useState(null); // { email, tempPassword } — shown once
  const [toast, setToast] = useState(null);

  const roles = useMemo(() => sortRoles(data.roles), [data.roles]);
  const roleByKey = useMemo(() => new Map(data.roles.map((r) => [r.key, r])), [data.roles]);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // State per user, from one clock reading per render.
  const now = Date.now();
  const withState = useMemo(() => data.users.map((u) => ({ u, state: accountState(u, now) })), [data.users, now]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, withState.filter(({ u, state }) => t.test(u, state)).length])), [withState]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const tabTest = TABS.find((t) => t.key === tab).test;
    return withState.filter(({ u, state }) => {
      if (!tabTest(u, state)) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!needle) return true;
      // employee.nameSearch: Thai + English + nickname (lib/employeeName.js)
      return [u.name, u.email, u.employee?.name, u.employee?.fullNameTh, u.employee?.nameSearch].some((v) => (v || "").toLowerCase().includes(needle));
    });
  }, [withState, q, tab, roleFilter]);

  function targetOf(u) {
    return { id: u._id, isSuperadmin: u.isSuperadmin, status: u.status };
  }

  function actionBlock(u, action) {
    return accountActionBlock({ actor, target: targetOf(u), action, activeSuperadminCount: data.activeSuperadminCount });
  }

  /** The row's menu: only what this viewer may do on this account, in the design's order. */
  function menuItems(u, state) {
    const statusAction = u.status === "suspended" ? "activate" : "suspend";
    const roleBlock = actor.isSuperadmin
      ? roleChangeBlock({ actor, target: targetOf(u), newRoleIsSuperadmin: false, activeSuperadminCount: data.activeSuperadminCount })
      : true;
    const linkBlock = linkActionBlock({ actor, target: targetOf(u), action: u.employee ? "unlink" : "link" });
    const deleteBlock = actor.isSuperadmin ? accountDeleteBlock({ actor, target: targetOf(u), activeSuperadminCount: data.activeSuperadminCount }) : true;
    return [
      !roleBlock && { key: "role", label: "เปลี่ยนบทบาท", Icon: UserCog, onClick: () => setRoleFor({ user: u, role: u.role }) },
      !actionBlock(u, "email") && { key: "email", label: "แก้ไขอีเมล", Icon: Mail, onClick: () => setEditingEmail({ user: u, value: u.email, error: "" }) },
      !linkBlock &&
        (u.employee
          ? { key: "unlink", label: "ยกเลิกผูกพนักงาน", Icon: Unlink, onClick: () => setConfirm({ user: u, action: "unlink" }) }
          : { key: "link", label: "ผูกพนักงาน", Icon: Link2, onClick: () => setPicker({ mode: "link", user: u }) }),
      state === "locked" && !actionBlock(u, "unlock") && { key: "unlock", label: "ปลดล็อก", Icon: LockOpen, onClick: () => setConfirm({ user: u, action: "unlock" }) },
      !actionBlock(u, statusAction) && {
        key: "status",
        label: statusAction === "suspend" ? "ระงับบัญชี" : "เปิดใช้งานบัญชี",
        Icon: statusAction === "suspend" ? Ban : CheckCircle2,
        tone: statusAction === "suspend" ? "danger" : undefined,
        onClick: () => setConfirm({ user: u, action: statusAction }),
      },
      !deleteBlock && { key: "delete", label: "ลบบัญชี", Icon: Trash2, tone: "danger", divider: true, onClick: () => setDeleting({ user: u, typed: "" }) },
    ].filter(Boolean);
  }

  async function runConfirmed() {
    if (!confirm) return;
    const { user, action } = confirm;
    setBusy(true);
    try {
      if (action === "unlock") {
        const res = await fetch(`/api/users/${user._id}/unlock`, { method: "POST" });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) throw new Error(j.message || j.error || "ปลดล็อกไม่สำเร็จ");
        setConfirm(null);
        showToast("ปลดล็อกบัญชีแล้ว");
      } else if (action === "unlink") {
        const res = await fetch(`/api/employees/${user.employee._id}/account`, { method: "DELETE" });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) throw new Error(j.message || j.error || "ยกเลิกการผูกไม่สำเร็จ");
        setConfirm(null);
        showToast("ยกเลิกการผูกแล้ว — บัญชียังอยู่ พร้อมบทบาทเดิม");
      } else {
        const res = await fetch(`/api/users/${user._id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action === "suspend" ? "suspended" : "active" }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) throw new Error(j.message || j.error || "บันทึกไม่สำเร็จ");
        setConfirm(null);
        showToast(action === "suspend" ? "ระงับบัญชีแล้ว" : "เปิดใช้งานบัญชีแล้ว");
      }
      router.refresh();
    } catch (err) {
      setConfirm(null);
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function runDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${deleting.user._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: deleting.typed }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.message || j.error || "ลบบัญชีไม่สำเร็จ");
      setDeleting(null);
      showToast("ลบบัญชีแล้ว — ข้อมูลพนักงานและประวัติยังอยู่ครบ");
      router.refresh();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveRole() {
    if (!roleFor) return;
    const { user, role } = roleFor;
    if (role === user.role) return setRoleFor(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${user._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) throw new Error(j.message || j.error || "เปลี่ยนบทบาทไม่สำเร็จ");
      setRoleFor(null);
      showToast("เปลี่ยนบทบาทแล้ว — มีผลภายในประมาณ 5 นาที");
      router.refresh();
    } catch (err) {
      setRoleFor(null);
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveEmail() {
    if (!editingEmail) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${editingEmail.user._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: editingEmail.value }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) throw new Error(j.message || j.error || "บันทึกอีเมลไม่สำเร็จ");
      setEditingEmail(null);
      showToast("เปลี่ยนอีเมลแล้ว — ผู้ใช้ต้องเข้าสู่ระบบด้วยอีเมลใหม่");
      router.refresh();
    } catch (err) {
      setEditingEmail((d) => (d ? { ...d, error: err.message } : d));
    } finally {
      setBusy(false);
    }
  }

  /** Picker choice: create an account for the employee, or link them to `picker.user`. */
  async function runPicked(emp) {
    if (!picker) return;
    setBusy(true);
    try {
      const res =
        picker.mode === "create"
          ? await fetch(`/api/employees/${emp._id}/account`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}), // employee's email, role employee
            })
          : await fetch(`/api/employees/${emp._id}/account`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: picker.user._id }),
            });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.message || j.error || "บันทึกไม่สำเร็จ");
      setPicker(null);
      if (picker.mode === "create") setCreated({ email: j.account?.email || emp.email, tempPassword: j.tempPassword });
      else showToast(`ผูก ${picker.user.email} กับ ${emp.name} แล้ว`);
      router.refresh();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const confirmCopy = {
    unlink: { title: "ยกเลิกการผูกพนักงาน", body: "บัญชีจะยังอยู่พร้อมบทบาทเดิม แต่จะไม่เห็นข้อมูลของพนักงานคนนี้อีก — ผูกใหม่ได้ภายหลัง", cta: "ยกเลิกการผูก", danger: true },
    suspend: { title: "ระงับบัญชี", body: "ผู้ใช้จะเข้าสู่ระบบไม่ได้ และการใช้งานที่เปิดอยู่จะถูกตัดภายในประมาณ 5 นาที", cta: "ระงับบัญชี", danger: true },
    activate: { title: "เปิดใช้งานบัญชี", body: "ผู้ใช้จะกลับมาเข้าสู่ระบบได้ตามปกติ", cta: "เปิดใช้งาน" },
    unlock: { title: "ปลดล็อกบัญชี", body: "บัญชีถูกล็อกชั่วคราวเพราะใส่รหัสผ่านผิดหลายครั้ง — ปลดล็อกแล้วผู้ใช้จะเข้าสู่ระบบได้ทันที", cta: "ปลดล็อก" },
  };

  const displayName = (u) => u.name || u.employee?.fullNameTh || u.employee?.name || u.email.split("@")[0];

  const cells = (u, state) => {
    const items = menuItems(u, state);
    const resetBlock = actionBlock(u, "reset");
    return {
      account: (
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar src={u.employee?.photoUrl} name={u.employee?.name || displayName(u)} size={36} />
          <div className="min-w-0">
            <div className="break-words text-[15px] font-semibold" style={{ color: NAVY }} data-testid="user-name">{displayName(u)}</div>
            {/* One line: an address too long for the column ends in "…", never breaks mid-word. */}
            <div className="truncate text-[13px]" style={{ color: SLATE }} title={u.email} data-testid="user-email">{u.email}</div>
            {u.employee?.emailMismatch && (
              <div className="mt-0.5 flex items-center gap-1 text-[12px] font-medium" style={{ color: "#B45309" }} data-testid="user-email-mismatch">
                <AlertTriangle size={13} aria-hidden /> อีเมลไม่ตรงกับพนักงาน
              </div>
            )}
          </div>
        </div>
      ),
      role: <RolePill roleKey={u.role} role={roleByKey.get(u.role)} />,
      employee: u.employee ? (
        <div className="min-w-0" data-testid="user-employee">
          <Link href={`/dashboard/hrm/employee-profile?id=${u.employee._id}`} className={`inline-flex items-center gap-1.5 text-[14px] font-medium no-underline hover:underline ${FOCUS}`} style={{ color: BLUE }}>
            <Link2 size={14} aria-hidden className="shrink-0" /> <span className="break-words">{u.employee.fullNameTh || u.employee.name || "-"}</span>
          </Link>
          {u.employee.position && <div className="text-[12px]" style={{ color: SLATE }}>{u.employee.position}</div>}
        </div>
      ) : (
        <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: "#FEF3C7", color: "#92400E" }} data-testid="user-unlinked">
          ไม่ได้ผูกพนักงาน
        </span>
      ),
      status: <StatusPill u={u} state={state} />,
      lastLogin: (
        <span className="text-[13px]" style={{ color: SLATE }} title={u.lastLoginAt ? fullDateTimeTh(u.lastLoginAt) : undefined} data-testid="user-last-login" suppressHydrationWarning>
          {lastSeenTh(u.lastLoginAt)}
        </span>
      ),
      actions: (
        <div className="flex items-center justify-end gap-2">
          {!resetBlock && (
            <button
              type="button"
              onClick={() => setResetFor(u)}
              className={`inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-white px-3 text-[13px] font-semibold md:min-h-[36px] ${FOCUS}`}
              style={{ border: "1px solid #D6E0F0", color: BLUE }}
              data-testid="user-reset"
            >
              <KeyRound size={14} aria-hidden /> รีเซ็ตรหัส
            </button>
          )}
          {items.length > 0 && <RowMenu label={`การดำเนินการเพิ่มเติมสำหรับ ${u.email}`} items={items} />}
        </div>
      ),
    };
  };

  return (
    <div className={PAGE} style={PAGE_BG}>
      <div className="mx-auto max-w-[1360px] space-y-4 md:space-y-5">
        {/* ── Tabs + create ─────────────────────── */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <div role="tablist" aria-label="สถานะบัญชี" className="inline-flex gap-1 rounded-xl bg-white p-1" style={{ border: `1px solid ${LINE}` }}>
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.key)}
                    className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 text-[14px] font-medium ${FOCUS}`}
                    style={active ? { background: NAVY, color: "#FFFFFF" } : { color: NAVY }}
                    data-testid="user-tab"
                    data-tab={t.key}
                  >
                    {t.label}
                    <span className="text-[13px] font-semibold" style={{ color: active ? "#D4F73F" : SLATE }} data-testid="user-tab-count">{counts[t.key]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <button type="button" onClick={() => setPicker({ mode: "create" })} className={`${BTN_PRIMARY} shrink-0`} data-testid="create-account-for-employee">
            <UserPlus size={16} aria-hidden /> สร้างบัญชีให้พนักงาน
          </button>
        </div>

        {/* ── Toolbar ───────────────────────────── */}
        <div className="flex flex-col gap-2 md:flex-row">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">ค้นหาชื่อหรืออีเมล</span>
            <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อหรืออีเมล" className={`${INPUT} pl-10`} data-testid="user-search" />
          </label>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="บทบาท" className={`${INPUT} md:w-60`} data-testid="user-role-filter">
            <option value="all">ทุกบทบาท</option>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>{roleDisplay(r.key, r).name}</option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center text-[14px]" style={{ border: `1px solid ${LINE}`, color: SLATE }} data-testid="user-empty">
            ไม่พบบัญชีที่ตรงกับการค้นหา
          </div>
        ) : (
          <>
            {/* tablet / desktop */}
            <div className="hidden overflow-hidden rounded-2xl bg-white md:block" style={{ border: `1px solid ${LINE}` }} data-testid="user-table">
              <table className="w-full table-fixed border-collapse text-left">
                {/* At 1280 px the account column gets ~240 px — room for a typical
                    name.x@9expert.co.th on one line; longer addresses truncate. */}
                <colgroup>
                  <col />
                  <col className="w-[144px]" />
                  <col className="w-[156px]" />
                  <col className="w-[140px]" />
                  <col className="w-[104px]" />
                  <col className="w-[168px]" />
                </colgroup>
                <thead>
                  <tr className="text-[13px]" style={{ background: "#F8FAFD", color: SLATE }}>
                    <th className="py-4 pl-4 pr-3 font-semibold">บัญชี</th>
                    <th className="px-3 py-4 font-semibold">บทบาท</th>
                    <th className="px-3 py-4 font-semibold">พนักงานที่ผูก</th>
                    <th className="px-3 py-4 font-semibold">สถานะ</th>
                    <th className="px-3 py-4 font-semibold">เข้าสู่ระบบล่าสุด</th>
                    <th className="py-4 pl-3 pr-4"><span className="sr-only">จัดการ</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ u, state }) => {
                    const c = cells(u, state);
                    return (
                      <tr key={u._id} style={{ borderTop: "1px solid #EEF2F8" }} data-testid="user-row" data-email={u.email}>
                        <td className="py-4 pl-4 pr-3 align-middle">{c.account}</td>
                        <td className="px-3 py-4 align-middle">{c.role}</td>
                        <td className="px-3 py-4 align-middle">{c.employee}</td>
                        <td className="px-3 py-4 align-middle">{c.status}</td>
                        <td className="px-3 py-4 align-middle">{c.lastLogin}</td>
                        <td className="py-4 pl-3 pr-4 align-middle">{c.actions}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* phone */}
            <div className="space-y-3 md:hidden" data-testid="user-cards">
              {rows.map(({ u, state }) => {
                const c = cells(u, state);
                return (
                  <div key={u._id} className="space-y-3 rounded-2xl bg-white p-4" style={{ border: `1px solid ${LINE}` }} data-testid="user-card" data-email={u.email}>
                    {c.account}
                    <div className="flex flex-wrap items-center gap-2">
                      {c.role}
                      {c.status}
                    </div>
                    <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
                      <dt style={{ color: SLATE }}>พนักงาน</dt>
                      <dd className="min-w-0">{c.employee}</dd>
                      <dt style={{ color: SLATE }}>เข้าล่าสุด</dt>
                      <dd>{c.lastLogin}</dd>
                    </dl>
                    {c.actions}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Confirm dialog ─────────────────────── */}
      {confirm && (
        <Dialog onClose={() => !busy && setConfirm(null)} labelledBy="confirm-title">
          <h3 id="confirm-title" className="text-[17px] font-bold" style={{ color: NAVY }}>{confirmCopy[confirm.action].title}</h3>
          <p className="mt-2 break-all text-[14px]" style={{ color: NAVY }}>
            {confirm.user.email}
            {confirm.action === "unlink" && confirm.user.employee ? ` ↔ ${confirm.user.employee.name}` : ""}
          </p>
          <p className="mt-2 text-[14px]" style={{ color: SLATE }}>{confirmCopy[confirm.action].body}</p>
          <DialogActions>
            <button type="button" onClick={() => setConfirm(null)} disabled={busy} className={BTN_SECONDARY}>ยกเลิก</button>
            <button type="button" onClick={runConfirmed} disabled={busy} className={confirmCopy[confirm.action].danger ? DANGER_SOLID : BTN_PRIMARY} data-testid="confirm-ok">
              {busy && <Loader2 size={15} className="animate-spin" />}
              {confirmCopy[confirm.action].cta}
            </button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── Change role (superadmin) ───────────── */}
      {roleFor && (
        <Dialog onClose={() => !busy && setRoleFor(null)} labelledBy="role-title">
          <h3 id="role-title" className="text-[17px] font-bold" style={{ color: NAVY }}>เปลี่ยนบทบาท</h3>
          <p className="mt-2 break-all text-[14px]" style={{ color: NAVY }}>{roleFor.user.email}</p>
          <label className="mt-4 block text-[13px] font-semibold" style={{ color: NAVY }} htmlFor="role-select">บทบาทใหม่</label>
          <select
            id="role-select"
            value={roleFor.role}
            onChange={(e) => setRoleFor((d) => ({ ...d, role: e.target.value }))}
            className={`${INPUT} mt-1`}
            data-testid="role-select"
          >
            {!roleByKey.get(roleFor.user.role) && <option value={roleFor.user.role}>{roleFor.user.role}</option>}
            {roles.map((r) => (
              <option key={r.key} value={r.key}>{roleDisplay(r.key, r).name} ({r.key})</option>
            ))}
          </select>
          <p className="mt-2 text-[12px]" style={{ color: SLATE }}>มีผลกับผู้ใช้ที่ล็อกอินอยู่ภายในประมาณ 5 นาที</p>
          <DialogActions>
            <button type="button" onClick={() => setRoleFor(null)} disabled={busy} className={BTN_SECONDARY}>ยกเลิก</button>
            <button type="button" onClick={saveRole} disabled={busy || roleFor.role === roleFor.user.role} className={BTN_PRIMARY} data-testid="role-save">
              {busy && <Loader2 size={15} className="animate-spin" />}
              เปลี่ยนเป็น {roleDisplay(roleFor.role, roleByKey.get(roleFor.role)).name}
            </button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── Delete account (superadmin; type the email to confirm) ── */}
      {deleting && (
        <Dialog onClose={() => !busy && setDeleting(null)} labelledBy="delete-title">
          <h3 id="delete-title" className="text-[17px] font-bold" style={{ color: RED }}>ลบบัญชีผู้ใช้</h3>
          <p className="mt-2 break-all text-[14px]" style={{ color: NAVY }}>{deleting.user.email}</p>
          <p className="mt-2 text-[13px]" style={{ color: SLATE }}>
            ข้อมูลพนักงานและประวัติทั้งหมด (การลา OT การอนุมัติ เวลาทำงาน) จะยังอยู่ครบ — บัญชีจะถูกยกเลิกการผูกแล้วลบ
            และจุดที่เคยอ้างถึงบัญชีนี้จะแสดงว่า “บัญชีถูกลบ”
          </p>
          <p className="mt-2.5 rounded-xl px-3 py-2 text-[13px]" style={{ background: "#FEF3C7", color: "#92400E" }}>
            พนักงานที่ลาออกแล้ว แนะนำให้ใช้ “ระงับบัญชี” แทน — การลบใช้สำหรับบัญชีที่สร้างผิดหรือซ้ำเท่านั้น และย้อนกลับไม่ได้
          </p>
          <label className="mt-3.5 block text-[13px] font-semibold" style={{ color: NAVY }}>พิมพ์อีเมลของบัญชีเพื่อยืนยัน</label>
          <input
            value={deleting.typed}
            onChange={(e) => setDeleting((d) => ({ ...d, typed: e.target.value }))}
            placeholder={deleting.user.email}
            aria-label="พิมพ์อีเมลของบัญชีเพื่อยืนยัน"
            className={`${INPUT} mt-1.5`}
            autoComplete="off"
          />
          <DialogActions>
            <button type="button" onClick={() => setDeleting(null)} disabled={busy} className={BTN_SECONDARY}>ยกเลิก</button>
            <button
              type="button"
              onClick={runDelete}
              disabled={busy || deleting.typed.trim().toLowerCase() !== deleting.user.email.trim().toLowerCase()}
              className={DANGER_SOLID}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              ลบบัญชีถาวร
            </button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── Reset password (typed or random) ───── */}
      {resetFor && (
        <ResetPasswordDialog
          user={resetFor}
          onClose={() => setResetFor(null)}
          onDone={(mode) => {
            if (mode === "typed") showToast("ตั้งรหัสผ่านแล้ว — ผู้ใช้ต้องเปลี่ยนรหัสเมื่อเข้าสู่ระบบครั้งถัดไป");
            router.refresh();
          }}
        />
      )}

      {/* ── Edit sign-in email ─────────────────── */}
      {editingEmail && (
        <Dialog onClose={() => !busy && setEditingEmail(null)} labelledBy="email-title">
          <h3 id="email-title" className="text-[17px] font-bold" style={{ color: NAVY }}>แก้ไขอีเมลเข้าสู่ระบบ</h3>
          <p className="mt-1.5 text-[13px]" style={{ color: SLATE }}>ผู้ใช้จะต้องเข้าสู่ระบบด้วยอีเมลใหม่ — อีเมลในข้อมูลพนักงานไม่เปลี่ยนตาม</p>
          <label className="mt-3.5 block text-[13px] font-semibold" style={{ color: NAVY }}>อีเมล</label>
          <input
            type="email"
            value={editingEmail.value}
            onChange={(e) => setEditingEmail((d) => ({ ...d, value: e.target.value, error: "" }))}
            aria-label="อีเมลเข้าสู่ระบบ"
            autoComplete="off"
            className={`${INPUT} mt-1.5`}
          />
          {editingEmail.user.employee?.emailMismatch && (
            <div className="mt-3 rounded-xl px-3 py-2 text-[13px]" style={{ background: "#FEF3C7", color: "#92400E" }}>
              อีเมลพนักงาน: <b className="break-all">{editingEmail.user.employee.email || "—"}</b>
              {editingEmail.user.employee.email && (
                <button
                  type="button"
                  onClick={() => setEditingEmail((d) => ({ ...d, value: d.user.employee.email, error: "" }))}
                  className={`mt-2 block min-h-[36px] rounded-[10px] bg-white px-3 font-semibold ${FOCUS}`}
                  style={{ border: "1px solid #92400E40", color: "#92400E" }}
                >
                  ใช้อีเมลเดียวกับพนักงาน
                </button>
              )}
            </div>
          )}
          {editingEmail.error && (
            <p role="alert" className="mt-2.5 text-[13px]" style={{ color: RED }}>{editingEmail.error}</p>
          )}
          <DialogActions>
            <button type="button" onClick={() => setEditingEmail(null)} disabled={busy} className={BTN_SECONDARY}>ยกเลิก</button>
            <button type="button" onClick={saveEmail} disabled={busy || !editingEmail.value.trim()} className={BTN_PRIMARY}>
              {busy && <Loader2 size={15} className="animate-spin" />}
              บันทึกอีเมล
            </button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── Employee picker: create an account / link to this account ── */}
      {picker && (
        <EmployeePicker
          title={picker.mode === "create" ? "สร้างบัญชีให้พนักงาน" : `ผูกพนักงานกับ ${picker.user.email}`}
          note={
            picker.mode === "create"
              ? "เลือกพนักงานที่ยังไม่มีบัญชี — บัญชีใหม่ใช้อีเมลของพนักงาน บทบาท employee และรหัสผ่านชั่วคราว (ผู้ใช้ต้องเปลี่ยนเมื่อเข้าสู่ระบบครั้งแรก)"
              : "เลือกพนักงานที่ยังไม่มีบัญชี — ผู้ใช้จะเห็นข้อมูลของพนักงานคนนี้หลังผูก"
          }
          cta={picker.mode === "create" ? "สร้างบัญชี" : "ผูกพนักงาน"}
          employees={data.employeesWithoutAccount || []}
          busy={busy}
          onPick={runPicked}
          onClose={() => !busy && setPicker(null)}
        />
      )}

      {/* ── New account's temporary password (shown once) ── */}
      {created && <TempPasswordDialog email={created.email} tempPassword={created.tempPassword} onClose={() => setCreated(null)} />}

      {/* ── Toast ─────────────────────────────── */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-medium text-white"
          style={{ background: toast.type === "error" ? "#991B1B" : "#065F46", boxShadow: "0 8px 32px rgba(13,27,42,0.25)" }}
          data-testid="user-toast"
        >
          {toast.type === "error" ? <X size={16} aria-hidden /> : <Check size={16} aria-hidden />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

const DANGER_SOLID = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#B91C1C] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#991B1B] disabled:opacity-50 ${FOCUS}`;

/**
 * "···" menu of a row's actions. Positioned `fixed` from the button so no
 * container clips it. Keyboard: opens on the first item; ↑/↓/Home/End move;
 * Escape closes and returns focus to the button; Tab or an outside click,
 * scroll or resize closes. Danger items are red; a divider precedes ลบบัญชี.
 */
function RowMenu({ label, items }) {
  const [pos, setPos] = useState(null); // { top, right } while open
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const close = (focusButton = false) => {
    setPos(null);
    if (focusButton) btnRef.current?.focus();
  };

  const open = !!pos;
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setPos(null);
    };
    // Scrolling keeps the menu on its button; it closes once the button leaves the screen.
    const onScroll = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) return setPos(null);
      setPos(place(r));
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function place(r) {
    const height = items.length * 44 + 16;
    const below = r.bottom + 4 + height <= window.innerHeight;
    return { top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - height), right: Math.max(8, window.innerWidth - r.right) };
  }

  function toggle() {
    if (pos) return close();
    setPos(place(btnRef.current.getBoundingClientRect()));
  }

  function onMenuKey(e) {
    const list = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
    const i = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); list.at(-1)?.focus(); }
    else if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "Tab") close();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !pos) { e.preventDefault(); toggle(); }
        }}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-white md:h-9 md:w-9 ${FOCUS}`}
        style={{ border: "1px solid #D6E0F0", color: SLATE }}
        data-testid="row-menu"
      >
        <MoreHorizontal size={18} aria-hidden />
      </button>
      {pos && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="rounded-xl bg-white py-1.5 text-left"
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 40, minWidth: 210, border: `1px solid ${LINE}`, boxShadow: "0 12px 32px rgba(13,27,42,0.16)" }}
          data-testid="row-menu-list"
        >
          {items.map((item) => (
            <div key={item.key}>
              {item.divider && <div role="separator" className="my-1.5 h-px" style={{ background: "#EEF2F8" }} />}
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  close();
                  item.onClick();
                }}
                className="flex min-h-[40px] w-full items-center gap-2.5 px-3.5 text-[14px] outline-none hover:bg-[#F5F8FF] focus:bg-[#EEF4FF]"
                style={{ color: item.tone === "danger" ? RED : NAVY, fontWeight: item.tone === "danger" ? 600 : 500 }}
                data-testid="row-menu-item"
                data-key={item.key}
              >
                <item.Icon size={16} aria-hidden />
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Pick one employee with no account (search: Thai / English name, nickname). */
function EmployeePicker({ title, note, cta, employees, busy, onPick, onClose }) {
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState(null);
  const needle = q.trim().toLowerCase();
  const list = needle ? employees.filter((e) => (e.nameSearch || e.name || "").toLowerCase().includes(needle)) : employees;
  return (
    <Dialog onClose={onClose} labelledBy="picker-title">
      <h3 id="picker-title" className="text-[17px] font-bold" style={{ color: NAVY }}>{title}</h3>
      <p className="mt-1.5 text-[13px]" style={{ color: SLATE }}>{note}</p>
      <label className="relative mt-3.5 block">
        <span className="sr-only">ค้นหาพนักงาน</span>
        <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อไทย / อังกฤษ / ชื่อเล่น" className={`${INPUT} pl-10`} autoFocus />
      </label>
      <ul className="mt-3 max-h-[280px] overflow-y-auto rounded-xl" style={{ border: `1px solid ${LINE}` }} role="listbox" aria-label="พนักงานที่ยังไม่มีบัญชี">
        {list.map((e) => (
          <li key={e._id}>
            <button
              type="button"
              role="option"
              aria-selected={chosen?._id === e._id}
              onClick={() => setChosen(e)}
              className={`min-h-[48px] w-full px-3.5 py-2 text-left ${FOCUS}`}
              style={{ background: chosen?._id === e._id ? "#EEF4FF" : "#FFFFFF", borderBottom: "1px solid #EEF2F8" }}
            >
              <div className="text-[14px] font-semibold" style={{ color: NAVY }}>
                {e.name || "-"}
                {e.nickName ? <span className="font-normal" style={{ color: SLATE }}> ({e.nickName})</span> : null}
              </div>
              <div className="text-[12px]" style={{ color: SLATE }}>
                {[e.nameEn !== e.name ? e.nameEn : null, e.department, e.position, e.email].filter(Boolean).join(" · ")}
              </div>
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="p-4 text-center text-[13px]" style={{ color: SLATE }}>{employees.length ? "ไม่พบพนักงานที่ตรงคำค้น" : "พนักงานทุกคนมีบัญชีแล้ว"}</li>
        )}
      </ul>
      <DialogActions>
        <button type="button" onClick={onClose} disabled={busy} className={BTN_SECONDARY}>ยกเลิก</button>
        <button type="button" onClick={() => chosen && onPick(chosen)} disabled={busy || !chosen} className={BTN_PRIMARY}>
          {busy && <Loader2 size={15} className="animate-spin" />}
          {cta}
        </button>
      </DialogActions>
    </Dialog>
  );
}

function DialogActions({ children }) {
  return <div className="mt-6 flex flex-wrap justify-end gap-2">{children}</div>;
}

function Dialog({ children, onClose, labelledBy }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
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
        aria-labelledby={labelledBy}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[20px] bg-white p-5 md:p-6"
        style={{ border: `1px solid ${LINE}`, boxShadow: "0 16px 48px rgba(13,27,42,0.2)" }}
        data-testid="user-dialog"
      >
        {children}
      </div>
    </div>
  );
}
