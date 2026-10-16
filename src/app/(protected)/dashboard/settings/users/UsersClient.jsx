"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Search, KeyRound, Ban, CheckCircle2, Check, X, Loader2, LockOpen, Trash2, Mail } from "lucide-react";
import { accountActionBlock, accountDeleteBlock, roleChangeBlock } from "@/lib/rbac/accountRules";
import ResetPasswordDialog from "../../../../../components/ResetPasswordDialog";

/* ── design tokens (same as the other settings pages) ───────── */
const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const SLATE = "#5E6A7E";
const ICE = "#F8FAFD";
const CARD = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,92,255,0.10)",
  borderRadius: "16px",
  boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
};

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(d) {
  return new Date(d).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function Pill({ children, bg, color }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5"
      style={{ background: bg, color, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}
    >
      {children}
    </span>
  );
}

export default function UsersClient({ initial, actor }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  useEffect(() => setData(initial), [initial]);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [linkFilter, setLinkFilter] = useState("all"); // "all" | "unlinked"
  const [deleting, setDeleting] = useState(null); // { user, typed } — superadmin delete dialog
  const [roleFilter, setRoleFilter] = useState("all");

  const [confirm, setConfirm] = useState(null); // { user, action: "suspend" | "activate" | "unlock" }
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState(null); // user — ResetPasswordDialog
  const [editingEmail, setEditingEmail] = useState(null); // { user, value, error }
  const [toast, setToast] = useState(null);

  const roleByKey = useMemo(() => new Map(data.roles.map((r) => [r.key, r])), [data.roles]);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.users.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (linkFilter === "unlinked" && u.employee) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!needle) return true;
      // employee.nameSearch: Thai + English + nickname (lib/employeeName.js)
      return [u.name, u.email, u.employee?.name, u.employee?.nameSearch].some((v) =>
        (v || "").toLowerCase().includes(needle)
      );
    });
  }, [data.users, q, statusFilter, roleFilter, linkFilter]);

  function targetOf(u) {
    return { id: u._id, isSuperadmin: u.isSuperadmin, status: u.status };
  }

  function actionBlock(u, action) {
    return accountActionBlock({
      actor,
      target: targetOf(u),
      action,
      activeSuperadminCount: data.activeSuperadminCount,
    });
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

  async function changeRole(user, role) {
    if (role === user.role) return;
    if (!window.confirm(`เปลี่ยนบทบาทของ ${user.email} เป็น "${roleByKey.get(role)?.name || role}" ?`)) return;
    try {
      const res = await fetch(`/api/users/${user._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) throw new Error(j.message || j.error || "เปลี่ยนบทบาทไม่สำเร็จ");
      showToast("เปลี่ยนบทบาทแล้ว — มีผลภายในประมาณ 5 นาที");
      router.refresh();
    } catch (err) {
      showToast(err.message, "error");
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

  const confirmCopy = {
    suspend: {
      title: "ระงับบัญชี",
      body: "ผู้ใช้จะเข้าสู่ระบบไม่ได้ และการใช้งานที่เปิดอยู่จะถูกตัดภายในประมาณ 5 นาที",
      cta: "ระงับบัญชี",
    },
    activate: {
      title: "เปิดใช้งานบัญชี",
      body: "ผู้ใช้จะกลับมาเข้าสู่ระบบได้ตามปกติ",
      cta: "เปิดใช้งาน",
    },
    unlock: {
      title: "ปลดล็อกบัญชี",
      body: "บัญชีถูกล็อกชั่วคราวเพราะใส่รหัสผ่านผิดหลายครั้ง — ปลดล็อกแล้วผู้ใช้จะเข้าสู่ระบบได้ทันที",
      cta: "ปลดล็อก",
    },
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }} className="space-y-6">
      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "rgba(0,92,255,0.08)", color: BLUE }}
        >
          <Users size={22} strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{ color: NAVY, fontSize: 22, fontWeight: 700 }}>ผู้ใช้</h1>
          <p style={{ color: SLATE, fontSize: 13 }}>
            บัญชีเข้าสู่ระบบทั้งหมด — รีเซ็ตรหัสผ่าน แก้ไขอีเมล ระงับ/เปิดใช้งาน ปลดล็อก
            {actor.isSuperadmin ? " และกำหนดบทบาท" : ""}
          </p>
        </div>
      </div>

      {/* ── Filters ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative" style={{ flex: "1 1 260px" }}>
          <Search
            size={16}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: SLATE }}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อหรืออีเมล…"
            aria-label="ค้นหาชื่อหรืออีเมล"
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle} aria-label="สถานะ">
          <option value="all">ทุกสถานะ</option>
          <option value="active">ใช้งาน</option>
          <option value="suspended">ระงับ</option>
        </select>
        <select value={linkFilter} onChange={(e) => setLinkFilter(e.target.value)} style={selectStyle} aria-label="การผูกพนักงาน">
          <option value="all">ทุกบัญชี</option>
          <option value="unlinked">ไม่ได้ผูกพนักงาน</option>
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={selectStyle} aria-label="บทบาท">
          <option value="all">ทุกบทบาท</option>
          {data.roles.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </select>
        <span style={{ color: SLATE, fontSize: 13 }}>{rows.length} บัญชี</span>
      </div>

      {/* ── Table ──────────────────────────────── */}
      <div style={{ ...CARD, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr style={{ background: ICE }}>
              <th style={thStyle}>ผู้ใช้</th>
              <th style={thStyle}>บทบาท</th>
              <th style={thStyle}>พนักงานที่ผูก</th>
              <th style={thStyle}>สถานะ</th>
              <th style={thStyle}>เข้าสู่ระบบล่าสุด</th>
              <th style={{ ...thStyle, textAlign: "right" }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const role = roleByKey.get(u.role);
              const resetBlock = actionBlock(u, "reset");
              const emailBlock = actionBlock(u, "email");
              const statusAction = u.status === "suspended" ? "activate" : "suspend";
              const statusBlock = actionBlock(u, statusAction);
              const unlockBlock = u.lockedUntil ? actionBlock(u, "unlock") : null;
              const deleteBlock = actor.isSuperadmin
                ? accountDeleteBlock({ actor, target: targetOf(u), activeSuperadminCount: data.activeSuperadminCount })
                : null;
              const roleBlock = actor.isSuperadmin
                ? roleChangeBlock({
                    actor,
                    target: targetOf(u),
                    newRoleIsSuperadmin: false,
                    activeSuperadminCount: data.activeSuperadminCount,
                  })
                : null;
              return (
                <tr key={u._id} style={{ borderBottom: "1px solid rgba(0,92,255,0.08)" }}>
                  <td style={tdStyle}>
                    <div style={{ color: NAVY, fontWeight: 600 }}>{u.name || u.employee?.name || u.email.split("@")[0]}</div>
                    <div style={{ color: SLATE, fontSize: 12 }}>{u.email}</div>
                    {u.mustChangePassword && (
                      <div className="mt-1">
                        <Pill bg="#FEF3C7" color="#92400E">ต้องเปลี่ยนรหัส</Pill>
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {actor.isSuperadmin ? (
                      <span title={roleBlock?.error}>
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u, e.target.value)}
                          disabled={!!roleBlock}
                          style={{ ...selectStyle, padding: "6px 8px", fontSize: 13 }}
                          aria-label={`บทบาทของ ${u.email}`}
                        >
                          {!role && <option value={u.role}>{u.role}</option>}
                          {data.roles.map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13, color: NAVY }}>
                        <span
                          aria-hidden="true"
                          style={{ width: 9, height: 9, borderRadius: 999, background: role?.color || "#6b7280" }}
                        />
                        {role?.name || u.role}
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 13 }}>
                    {u.employee ? (
                      <>
                        <span style={{ color: SLATE }}>#{u.employee.empAutoId ?? "-"}</span>{" "}
                        <span style={{ color: NAVY }}>{u.employee.name || "-"}</span>
                        {u.employee.emailMismatch && (
                          <div className="mt-1" title="อีเมลของบัญชีไม่ตรงกับอีเมลพนักงาน">
                            <Pill bg="#FEF3C7" color="#92400E">อีเมลไม่ตรงกับพนักงาน</Pill>
                          </div>
                        )}
                      </>
                    ) : (
                      <span style={{ color: SLATE }}>ไม่ได้ผูกพนักงาน</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {u.status === "suspended" ? (
                      <Pill bg="#FEE2E2" color="#991B1B">ระงับ</Pill>
                    ) : (
                      <Pill bg="#D1FAE5" color="#065F46">ใช้งาน</Pill>
                    )}
                    {u.lockedUntil && (
                      <div className="mt-1">
                        <Pill bg="#FEF3C7" color="#92400E">ล็อกอยู่ถึง {fmtTime(u.lockedUntil)}</Pill>
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 13, color: SLATE }}>{fmtDateTime(u.lastLoginAt)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <div className="inline-flex gap-2">
                      {u.lockedUntil && (
                        <span title={unlockBlock?.error}>
                          <button
                            onClick={() => setConfirm({ user: u, action: "unlock" })}
                            disabled={!!unlockBlock}
                            style={{ ...actionBtn("#92400E"), opacity: unlockBlock ? 0.45 : 1 }}
                          >
                            <LockOpen size={13} />
                            ปลดล็อก
                          </button>
                        </span>
                      )}
                      <span title={resetBlock?.error}>
                        <button
                          onClick={() => setResetFor(u)}
                          disabled={!!resetBlock}
                          style={{ ...actionBtn(BLUE), opacity: resetBlock ? 0.45 : 1 }}
                        >
                          <KeyRound size={13} />
                          รีเซ็ตรหัสผ่าน
                        </button>
                      </span>
                      <span title={emailBlock?.error}>
                        <button
                          onClick={() => setEditingEmail({ user: u, value: u.email, error: "" })}
                          disabled={!!emailBlock}
                          style={{ ...actionBtn(BLUE), opacity: emailBlock ? 0.45 : 1 }}
                        >
                          <Mail size={13} />
                          แก้ไขอีเมล
                        </button>
                      </span>
                      <span title={statusBlock?.error}>
                        <button
                          onClick={() => setConfirm({ user: u, action: statusAction })}
                          disabled={!!statusBlock}
                          style={{
                            ...actionBtn(statusAction === "suspend" ? "#991B1B" : "#065F46"),
                            opacity: statusBlock ? 0.45 : 1,
                          }}
                        >
                          {statusAction === "suspend" ? <Ban size={13} /> : <CheckCircle2 size={13} />}
                          {statusAction === "suspend" ? "ระงับบัญชี" : "เปิดใช้งาน"}
                        </button>
                      </span>
                      {actor.isSuperadmin && (
                        <span title={deleteBlock?.error}>
                          <button
                            onClick={() => setDeleting({ user: u, typed: "" })}
                            disabled={!!deleteBlock}
                            style={{ ...actionBtn("#991B1B"), opacity: deleteBlock ? 0.45 : 1 }}
                          >
                            <Trash2 size={13} />
                            ลบบัญชี
                          </button>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 40, color: SLATE }}>
                  ไม่พบผู้ใช้ที่ตรงเงื่อนไข
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Confirm dialog ─────────────────────── */}
      {confirm && (
        <Dialog onClose={() => !busy && setConfirm(null)} labelledBy="confirm-title">
          <h3 id="confirm-title" style={{ color: NAVY, fontSize: 18, fontWeight: 700 }}>
            {confirmCopy[confirm.action].title}
          </h3>
          <p style={{ color: NAVY, fontSize: 14, marginTop: 8 }}>{confirm.user.email}</p>
          <p style={{ color: SLATE, fontSize: 14, marginTop: 8 }}>{confirmCopy[confirm.action].body}</p>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setConfirm(null)} disabled={busy} style={secondaryBtn}>
              ยกเลิก
            </button>
            <button
              onClick={runConfirmed}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5"
              style={{
                background: confirm.action === "suspend" ? "#991B1B" : BLUE,
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 600,
                border: "none",
              }}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {confirmCopy[confirm.action].cta}
            </button>
          </div>
        </Dialog>
      )}

      {/* ── Delete account (superadmin; type the email to confirm) ── */}
      {deleting && (
        <Dialog onClose={() => !busy && setDeleting(null)} labelledBy="delete-title">
          <h3 id="delete-title" style={{ color: "#991B1B", fontSize: 18, fontWeight: 700 }}>
            ลบบัญชีผู้ใช้
          </h3>
          <p style={{ color: NAVY, fontSize: 14, marginTop: 8 }}>{deleting.user.email}</p>
          <p style={{ color: SLATE, fontSize: 13, marginTop: 8 }}>
            ข้อมูลพนักงานและประวัติทั้งหมด (การลา OT การอนุมัติ เวลาทำงาน) จะยังอยู่ครบ — บัญชีจะถูกยกเลิกการผูกแล้วลบ
            และจุดที่เคยอ้างถึงบัญชีนี้จะแสดงว่า “บัญชีถูกลบ”
          </p>
          <p
            className="rounded-lg px-3 py-2"
            style={{ background: "#FEF3C7", color: "#92400E", fontSize: 13, marginTop: 10 }}
          >
            พนักงานที่ลาออกแล้ว แนะนำให้ใช้ “ระงับบัญชี” แทน — การลบใช้สำหรับบัญชีที่สร้างผิดหรือซ้ำเท่านั้น และย้อนกลับไม่ได้
          </p>
          <label style={{ display: "block", color: NAVY, fontSize: 13, marginTop: 14 }}>
            พิมพ์อีเมลของบัญชีเพื่อยืนยัน
          </label>
          <input
            value={deleting.typed}
            onChange={(e) => setDeleting((d) => ({ ...d, typed: e.target.value }))}
            placeholder={deleting.user.email}
            aria-label="พิมพ์อีเมลของบัญชีเพื่อยืนยัน"
            style={{ ...inputStyle, marginTop: 6 }}
            autoComplete="off"
          />
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setDeleting(null)} disabled={busy} style={secondaryBtn}>
              ยกเลิก
            </button>
            <button
              onClick={runDelete}
              disabled={
                busy || deleting.typed.trim().toLowerCase() !== deleting.user.email.trim().toLowerCase()
              }
              className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 disabled:opacity-50"
              style={{ background: "#991B1B", color: "#FFFFFF", fontSize: 13, fontWeight: 600, border: "none" }}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              ลบบัญชีถาวร
            </button>
          </div>
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
          <h3 id="email-title" style={{ color: NAVY, fontSize: 18, fontWeight: 700 }}>
            แก้ไขอีเมลเข้าสู่ระบบ
          </h3>
          <p style={{ color: SLATE, fontSize: 13, marginTop: 6 }}>
            ผู้ใช้จะต้องเข้าสู่ระบบด้วยอีเมลใหม่ — อีเมลในข้อมูลพนักงานไม่เปลี่ยนตาม
          </p>
          <label style={{ display: "block", color: NAVY, fontSize: 13, marginTop: 14 }}>อีเมล</label>
          <input
            type="email"
            value={editingEmail.value}
            onChange={(e) => setEditingEmail((d) => ({ ...d, value: e.target.value, error: "" }))}
            aria-label="อีเมลเข้าสู่ระบบ"
            autoComplete="off"
            style={{ ...inputStyle, marginTop: 6 }}
          />
          {editingEmail.user.employee?.emailMismatch && (
            <div
              className="rounded-lg px-3 py-2 mt-3"
              style={{ background: "#FEF3C7", color: "#92400E", fontSize: 13 }}
            >
              อีเมลพนักงาน: <b>{editingEmail.user.employee.email || "—"}</b>
              {editingEmail.user.employee.email && (
                <button
                  type="button"
                  onClick={() =>
                    setEditingEmail((d) => ({ ...d, value: d.user.employee.email, error: "" }))
                  }
                  className="block mt-2 rounded-lg px-3 py-1.5"
                  style={{ border: "1px solid #92400E40", color: "#92400E", fontWeight: 600, background: "#FFFFFF" }}
                >
                  ใช้อีเมลเดียวกับพนักงาน
                </button>
              )}
            </div>
          )}
          {editingEmail.error && (
            <p role="alert" style={{ color: "#991B1B", fontSize: 13, marginTop: 10 }}>
              {editingEmail.error}
            </p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setEditingEmail(null)} disabled={busy} style={secondaryBtn}>
              ยกเลิก
            </button>
            <button
              onClick={saveEmail}
              disabled={busy || !editingEmail.value.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 disabled:opacity-50"
              style={{ background: BLUE, color: "#FFFFFF", fontSize: 13, fontWeight: 600, border: "none" }}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              บันทึกอีเมล
            </button>
          </div>
        </Dialog>
      )}

      {/* ── Toast ─────────────────────────────── */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-5 py-3"
          style={{
            background: toast.type === "error" ? "#991B1B" : "#065F46",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 500,
            boxShadow: "0 8px 32px rgba(13,27,42,0.25)",
          }}
        >
          {toast.type === "error" ? <X size={16} /> : <Check size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function Dialog({ children, onClose, labelledBy }) {
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
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "#FFFFFF", boxShadow: "0 16px 48px rgba(13,27,42,0.2)" }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── styles ─────────────────────────────────────── */
const thStyle = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 600,
  color: "#5E6A7E",
  borderBottom: "1px solid rgba(0,92,255,0.08)",
  whiteSpace: "nowrap",
};
const tdStyle = { padding: "12px 16px", fontSize: 14, verticalAlign: "top" };
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,92,255,0.15)",
  fontSize: 14,
  color: "#0D1B2A",
  background: "#FFFFFF",
};
const selectStyle = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,92,255,0.15)",
  fontSize: 14,
  color: "#0D1B2A",
  background: "#FFFFFF",
};
const secondaryBtn = {
  border: "1px solid rgba(0,92,255,0.10)",
  color: "#0D1B2A",
  fontSize: 13,
  fontWeight: 600,
  background: "#FFFFFF",
  borderRadius: 12,
  padding: "10px 16px",
};
function actionBtn(color) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    border: `1px solid ${color}20`,
    color,
    fontSize: 12,
    fontWeight: 500,
    background: `${color}08`,
    borderRadius: 8,
    padding: "6px 10px",
    whiteSpace: "nowrap",
  };
}
