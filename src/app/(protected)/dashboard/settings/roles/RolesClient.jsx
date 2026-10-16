"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Trash2, Plus, Loader2, X, Check, Lock, Info } from "lucide-react";
import {
  NEW_ROLE_PAGES,
  DEFAULT_ROLE_COLOR,
  SUPERADMIN_KEY,
  isEditableRole,
  validateRoleInput,
} from "@/lib/rbac/roleRules";

/* ── design tokens (same as Settings › กำหนด HOD) ───────────── */
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

function Badge({ children, tone = "blue" }) {
  const tones = {
    blue: { background: "rgba(0,92,255,0.08)", color: BLUE },
    slate: { background: "#F1F5F9", color: "#475569" },
    amber: { background: "#FEF3C7", color: "#92400E" },
  };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5"
      style={{ ...tones[tone], fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}
    >
      {children}
    </span>
  );
}

export default function RolesClient({ initialRoles, groups }) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [editor, setEditor] = useState(null); // { mode: "create" | "edit", readOnly, key, name, color, pages: [] }
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function reload() {
    try {
      const res = await fetch("/api/roles", { cache: "no-store" });
      const j = await res.json();
      if (j.ok) setRoles(j.items);
    } catch {}
    router.refresh();
  }

  function openCreate() {
    setError("");
    setEditor({
      mode: "create",
      readOnly: false,
      key: "",
      name: "",
      color: DEFAULT_ROLE_COLOR,
      pages: [...NEW_ROLE_PAGES],
    });
  }

  function openEdit(role) {
    setError("");
    setEditor({
      mode: "edit",
      readOnly: !isEditableRole(role),
      isSystem: role.isSystem,
      key: role.key,
      name: role.name,
      color: role.color || DEFAULT_ROLE_COLOR,
      pages: [...role.pages],
    });
  }

  const pageSet = useMemo(() => new Set(editor?.pages ?? []), [editor]);

  function togglePage(key) {
    setEditor((e) => {
      const set = new Set(e.pages);
      set.has(key) ? set.delete(key) : set.add(key);
      return { ...e, pages: [...set] };
    });
  }

  function toggleGroup(groupPages, allOn) {
    setEditor((e) => {
      const set = new Set(e.pages);
      for (const p of groupPages) allOn ? set.delete(p.key) : set.add(p.key);
      return { ...e, pages: [...set] };
    });
  }

  async function handleSave() {
    if (!editor || editor.readOnly) return;
    const payload = { name: editor.name, color: editor.color, pages: editor.pages };
    if (editor.mode === "create") payload.key = editor.key.trim();

    // Same rules as the server (lib/rbac/roleRules.js); the API re-checks.
    const checked = validateRoleInput(payload, {
      mode: editor.mode === "create" ? "create" : "update",
      currentKey: editor.mode === "edit" ? editor.key : null,
      existingKeys: roles.map((r) => r.key),
    });
    if (!checked.ok) {
      setError(checked.error);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(editor.mode === "create" ? "/api/roles" : `/api/roles/${editor.key}`, {
        method: editor.mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.message || "บันทึกไม่สำเร็จ");
      setEditor(null);
      showToast(editor.mode === "create" ? "สร้างบทบาทแล้ว" : "บันทึกแล้ว");
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role) {
    if (!confirm(`ต้องการลบบทบาท "${role.name}" (${role.key}) หรือไม่?`)) return;
    setDeletingKey(role.key);
    try {
      const res = await fetch(`/api/roles/${role.key}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.message || "ลบไม่สำเร็จ");
      showToast("ลบบทบาทแล้ว");
      await reload();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }} className="space-y-6">
      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "rgba(0,92,255,0.08)", color: BLUE }}
          >
            <KeyRound size={22} strokeWidth={1.8} />
          </div>
          <div>
            <h1 style={{ color: NAVY, fontSize: 22, fontWeight: 700 }}>บทบาทและสิทธิ์</h1>
            <p style={{ color: SLATE, fontSize: 13 }}>กำหนดว่าแต่ละบทบาทเข้าถึงหน้าใดและข้อมูลขอบเขตใดได้บ้าง</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
          style={{ background: BLUE, color: "#FFFFFF", border: "none" }}
        >
          <Plus size={16} />
          สร้างบทบาทใหม่
        </button>
      </div>

      {/* ── List ───────────────────────────────── */}
      <div style={{ ...CARD, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: ICE }}>
              <th style={thStyle}>บทบาท</th>
              <th style={thStyle}>รหัส</th>
              <th style={{ ...thStyle, textAlign: "right", width: 110 }}>ผู้ใช้</th>
              <th style={{ ...thStyle, textAlign: "center", width: 190 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => {
              const deletable = !role.isSystem && role.key !== SUPERADMIN_KEY;
              const blocked = deletable && role.userCount > 0;
              return (
                <tr key={role.key} style={{ borderBottom: "1px solid rgba(0,92,255,0.08)" }}>
                  <td style={tdStyle}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        aria-hidden="true"
                        style={{ width: 10, height: 10, borderRadius: 999, background: role.color || DEFAULT_ROLE_COLOR }}
                      />
                      <span style={{ color: NAVY, fontWeight: 600 }}>{role.name}</span>
                      {role.isSystem && <Badge tone="slate">ระบบ</Badge>}
                      {role.isSuperadmin && <Badge tone="amber">ทุกหน้า</Badge>}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: SLATE, fontFamily: "ui-monospace, monospace", fontSize: 13 }}>
                    {role.key}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", color: NAVY }}>{role.userCount} คน</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <div className="inline-flex gap-2">
                      <button onClick={() => openEdit(role)} style={actionBtn(BLUE)}>
                        {role.isSuperadmin ? <Lock size={13} /> : <Pencil size={13} />}
                        {role.isSuperadmin ? "ดู" : "แก้ไข"}
                      </button>
                      {deletable && (
                        <span
                          title={blocked ? `ยังมีผู้ใช้ ${role.userCount} คนในบทบาทนี้ — ย้ายผู้ใช้ออกก่อนจึงจะลบได้` : undefined}
                        >
                          <button
                            onClick={() => handleDelete(role)}
                            disabled={blocked || deletingKey === role.key}
                            style={{ ...actionBtn("#991B1B"), opacity: blocked ? 0.45 : 1 }}
                          >
                            {deletingKey === role.key ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            ลบ
                          </button>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Editor ─────────────────────────────── */}
      {editor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13,27,42,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditor(null); }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl p-6"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 16px 48px rgba(13,27,42,0.2)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: NAVY, fontSize: 18, fontWeight: 700 }}>
                {editor.mode === "create" ? "สร้างบทบาทใหม่" : editor.readOnly ? "ดูบทบาท" : "แก้ไขบทบาท"}
              </h3>
              <button
                onClick={() => setEditor(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: ICE, color: SLATE, border: "none" }}
                aria-label="ปิด"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }} className="space-y-4 pr-1">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="block">
                  <span style={labelStyle}>ชื่อบทบาท</span>
                  <input
                    value={editor.name}
                    onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                    disabled={editor.readOnly}
                    style={inputStyle}
                    placeholder="เช่น หัวหน้าทีมขาย"
                  />
                </label>
                <label className="block">
                  <span style={labelStyle}>รหัสบทบาท</span>
                  <input
                    value={editor.key}
                    onChange={(e) => setEditor({ ...editor, key: e.target.value.toLowerCase() })}
                    disabled={editor.mode !== "create"}
                    style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }}
                    placeholder="เช่น sales_lead"
                  />
                  <span style={{ color: SLATE, fontSize: 11 }}>
                    {editor.mode === "create" ? "a–z, 0–9, _ — เปลี่ยนภายหลังไม่ได้" : "เปลี่ยนรหัสไม่ได้"}
                  </span>
                </label>
                <label className="block">
                  <span style={labelStyle}>สี</span>
                  <input
                    type="color"
                    value={editor.color}
                    onChange={(e) => setEditor({ ...editor, color: e.target.value })}
                    disabled={editor.readOnly}
                    style={{ ...inputStyle, width: 64, height: 42, padding: 4 }}
                  />
                </label>
              </div>

              {editor.readOnly ? (
                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-3"
                  style={{ background: "#FEF3C7", color: "#92400E", fontSize: 14, fontWeight: 500 }}
                >
                  <Lock size={16} />
                  มีสิทธิ์ทุกหน้าโดยอัตโนมัติ
                </div>
              ) : (
                <div className="space-y-4">
                  {groups.map((g) => {
                    const allOn = g.pages.every((p) => pageSet.has(p.key));
                    return (
                      <section key={g.group} style={{ border: "1px solid rgba(0,92,255,0.08)", borderRadius: 12 }}>
                        <div
                          className="flex items-center justify-between px-4 py-2"
                          style={{ background: ICE, borderRadius: "12px 12px 0 0" }}
                        >
                          <span style={{ color: NAVY, fontWeight: 600, fontSize: 14 }}>{g.group}</span>
                          <button
                            type="button"
                            onClick={() => toggleGroup(g.pages, allOn)}
                            style={{ color: BLUE, fontSize: 12, fontWeight: 600, background: "none", border: "none" }}
                          >
                            {allOn ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                          </button>
                        </div>
                        <div className="grid gap-1 p-3 sm:grid-cols-2">
                          {g.pages.map((p) => (
                            <label
                              key={p.key}
                              className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                              style={{ cursor: "pointer", fontSize: 13, color: NAVY }}
                            >
                              <input
                                type="checkbox"
                                checked={pageSet.has(p.key)}
                                onChange={() => togglePage(p.key)}
                              />
                              <span>{p.label}</span>
                              {p.scope && <Badge>ขอบเขตข้อมูล</Badge>}
                            </label>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              <p className="flex items-center gap-2" style={{ color: SLATE, fontSize: 12 }}>
                <Info size={14} />
                การเปลี่ยนสิทธิ์จะมีผลกับผู้ใช้ที่เข้าสู่ระบบอยู่ภายในประมาณ 5 นาที
              </p>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl px-4 py-3"
                  style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 13 }}
                >
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setEditor(null)} style={secondaryBtn}>
                {editor.readOnly ? "ปิด" : "ยกเลิก"}
              </button>
              {!editor.readOnly && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 disabled:opacity-50"
                  style={{ background: BLUE, color: "#FFFFFF", fontSize: 13, fontWeight: 600, border: "none" }}
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  {editor.mode === "create" ? "สร้างบทบาท" : "บันทึก"}
                </button>
              )}
            </div>
          </div>
        </div>
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

/* ── styles ─────────────────────────────────────── */
const thStyle = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 600,
  color: "#5E6A7E",
  borderBottom: "1px solid rgba(0,92,255,0.08)",
};
const tdStyle = { padding: "14px 16px", fontSize: 14 };
const labelStyle = { display: "block", color: "#0D1B2A", fontSize: 13, fontWeight: 600, marginBottom: 4 };
const inputStyle = {
  width: "100%",
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
    padding: "6px 12px",
  };
}
