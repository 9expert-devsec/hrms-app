"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Info, LayoutGrid, Loader2, Lock, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { NEW_ROLE_PAGES, DEFAULT_ROLE_COLOR, SUPERADMIN_KEY, isEditableRole, validateRoleInput } from "@/lib/rbac/roleRules";
import { roleDataScope, roleDisplay, rolePageCount, sortRoles } from "@/lib/rbac/roleDisplay";
import PersonAvatar from "../../../../../components/PersonAvatar";
import { BLUE, BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, FOCUS, INPUT, LINE, NAVY, PAGE, PAGE_BG, SLATE } from "../../../../../components/hr/hrUi";

function Badge({ children, tone = "blue" }) {
  const tones = {
    blue: { background: "#EEF4FF", color: BLUE },
    slate: { background: "#F1F4F8", color: SLATE },
  };
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={tones[tone]}>
      {children}
    </span>
  );
}

function Fact({ Icon, label, value, testid }) {
  return (
    <div className="min-w-0 rounded-xl px-3 py-2.5" style={{ background: "#F5F8FF" }} data-testid={testid}>
      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: SLATE }}>
        <Icon size={14} aria-hidden /> {label}
      </div>
      <div className="mt-0.5 text-[14px] font-semibold" style={{ color: NAVY }} data-testid={`${testid}-value`}>{value}</div>
    </div>
  );
}

export default function RolesClient({ initialRoles, groups, holders = {} }) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [editor, setEditor] = useState(null); // { mode: "create" | "edit", readOnly, key, name, color, pages: [], deletable, userCount }
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);
  const [toast, setToast] = useState(null);

  const ordered = useMemo(() => sortRoles(roles), [roles]);

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
    setEditor({ mode: "create", readOnly: false, key: "", name: "", color: DEFAULT_ROLE_COLOR, pages: [...NEW_ROLE_PAGES] });
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
      // Same rule as before: custom roles only, and only while nobody holds them.
      deletable: !role.isSystem && role.key !== SUPERADMIN_KEY,
      userCount: role.userCount,
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
      setEditor(null);
      showToast("ลบบทบาทแล้ว");
      await reload();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <div className={PAGE} style={PAGE_BG}>
      <div className="mx-auto max-w-[1360px] space-y-4 md:space-y-5">
        {/* ── Header ─────────────────────────────── */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="max-w-[760px] text-[14px]" style={{ color: SLATE }}>
            กำหนดว่าแต่ละบทบาทเปิดหน้าไหนได้ และเห็นข้อมูลของใครได้บ้าง การเปลี่ยนสิทธิ์มีผลกับผู้ใช้ที่ล็อกอินอยู่ภายใน 5 นาที
          </p>
          <button type="button" onClick={openCreate} className={`${BTN_PRIMARY} shrink-0`} data-testid="role-create">
            <Plus size={16} aria-hidden /> สร้างบทบาทใหม่
          </button>
        </div>

        {/* ── Cards ──────────────────────────────── */}
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ordered.map((role) => {
            const d = roleDisplay(role.key, role);
            const pages = rolePageCount(role);
            const scope = roleDataScope(role);
            const people = holders[role.key] || [];
            return (
              <li
                key={role.key}
                className="flex flex-col gap-3.5 rounded-[18px] bg-white px-5 py-[18px]"
                style={{ border: `1px solid ${LINE}` }}
                data-testid="role-card"
                data-key={role.key}
              >
                <div className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-[17px] font-bold" style={{ color: NAVY }} data-testid="role-name">{d.name}</h2>
                    <p className="text-[12px]" style={{ color: SLATE }}>{role.key}</p>
                    {role.source === "seed" && <p className="mt-0.5 text-[12px]" style={{ color: SLATE }} data-testid="role-seed">ใช้ค่าตั้งต้นของระบบ</p>}
                  </div>
                  {role.isSystem && <Badge tone="slate">บทบาทระบบ</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Fact Icon={LayoutGrid} label="เข้าถึง" value={pages === null ? "ทุกหน้า" : `${pages} หน้า`} testid="role-pages" />
                  <Fact Icon={ShieldCheck} label="ขอบเขตข้อมูล" value={scope.label} testid="role-scope" />
                </div>

                <div className="mt-auto flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {people.length > 0 && (
                      <div className="flex -space-x-2" aria-hidden>
                        {people.map((p) => (
                          <span key={p.id} className="rounded-full" style={{ boxShadow: "0 0 0 2px #FFFFFF" }}>
                            <PersonAvatar src={p.photoUrl} crop={p.photoCrop} name={p.name} size={28} />
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="text-[13px]" style={{ color: SLATE }} data-testid="role-users">{role.userCount} คน</span>
                  </div>
                  {role.isSuperadmin ? (
                    <button
                      type="button"
                      onClick={() => openEdit(role)}
                      className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[13px] font-semibold md:min-h-[36px] ${FOCUS}`}
                      style={{ border: "1px solid #D6E0F0", color: SLATE }}
                      data-testid="role-edit"
                    >
                      <Lock size={14} aria-hidden /> ดูสิทธิ์
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEdit(role)}
                      className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[13px] font-semibold md:min-h-[36px] ${FOCUS}`}
                      style={{ border: "1px solid #D6E0F0", color: BLUE }}
                      data-testid="role-edit"
                    >
                      <Pencil size={14} aria-hidden /> แก้ไขสิทธิ์
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Editor ─────────────────────────────── */}
      {editor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13,27,42,0.6)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditor(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-editor-title"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[20px] bg-white p-5 md:p-6"
            style={{ border: `1px solid ${LINE}`, boxShadow: "0 16px 48px rgba(13,27,42,0.2)" }}
            data-testid="role-editor"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 id="role-editor-title" className="text-[17px] font-bold" style={{ color: NAVY }}>
                {editor.mode === "create" ? "สร้างบทบาทใหม่" : editor.readOnly ? "ดูสิทธิ์" : "แก้ไขสิทธิ์"}
              </h3>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className={`grid h-11 w-11 place-items-center rounded-[10px] md:h-9 md:w-9 ${FOCUS}`}
                style={{ background: "#F5F8FF", color: SLATE }}
                aria-label="ปิด"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="block">
                  <span className="mb-1 block text-[13px] font-semibold" style={{ color: NAVY }}>ชื่อบทบาท</span>
                  <input
                    value={editor.name}
                    onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                    disabled={editor.readOnly}
                    className={`${INPUT} disabled:bg-[#F5F7FB]`}
                    placeholder="เช่น หัวหน้าทีมขาย"
                    data-testid="role-editor-name"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-semibold" style={{ color: NAVY }}>รหัสบทบาท</span>
                  <input
                    value={editor.key}
                    onChange={(e) => setEditor({ ...editor, key: e.target.value.toLowerCase() })}
                    disabled={editor.mode !== "create"}
                    className={`${INPUT} font-mono disabled:bg-[#F5F7FB]`}
                    placeholder="เช่น sales_lead"
                  />
                  <span className="text-[11px]" style={{ color: SLATE }}>
                    {editor.mode === "create" ? "a–z, 0–9, _ — เปลี่ยนภายหลังไม่ได้" : "เปลี่ยนรหัสไม่ได้"}
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-semibold" style={{ color: NAVY }}>สี</span>
                  <input
                    type="color"
                    value={editor.color}
                    onChange={(e) => setEditor({ ...editor, color: e.target.value })}
                    disabled={editor.readOnly}
                    className="h-11 w-16 rounded-xl border border-[#D6E0F0] bg-white p-1"
                  />
                </label>
              </div>

              {editor.readOnly ? (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-[14px] font-medium" style={{ background: "#FEF3C7", color: "#92400E" }}>
                  <Lock size={16} aria-hidden />
                  มีสิทธิ์ทุกหน้าโดยอัตโนมัติ
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map((g) => {
                    const allOn = g.pages.every((p) => pageSet.has(p.key));
                    return (
                      <section key={g.group} className="overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }}>
                        <div className="flex items-center justify-between px-4 py-2" style={{ background: "#F8FAFD" }}>
                          <span className="text-[14px] font-semibold" style={{ color: NAVY }}>{g.group}</span>
                          <button type="button" onClick={() => toggleGroup(g.pages, allOn)} className={`min-h-[36px] rounded-lg px-2 text-[12px] font-semibold ${FOCUS}`} style={{ color: BLUE }}>
                            {allOn ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                          </button>
                        </div>
                        <div className="grid gap-1 p-3 sm:grid-cols-2">
                          {g.pages.map((p) => (
                            <label key={p.key} className="flex min-h-[36px] cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-[#F5F8FF]" style={{ color: NAVY }}>
                              <input type="checkbox" checked={pageSet.has(p.key)} onChange={() => togglePage(p.key)} className="h-4 w-4 accent-[#005CFF]" />
                              <span>{p.label}</span>
                              {p.scope && <Badge>ขอบเขตข้อมูล</Badge>}
                              {p.inDevelopment && <Badge tone="slate">กำลังพัฒนา</Badge>}
                            </label>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              <p className="flex items-center gap-2 text-[12px]" style={{ color: SLATE }}>
                <Info size={14} aria-hidden />
                การเปลี่ยนสิทธิ์จะมีผลกับผู้ใช้ที่เข้าสู่ระบบอยู่ภายในประมาณ 5 นาที
              </p>

              {error && (
                <div role="alert" className="rounded-xl px-4 py-3 text-[13px]" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" }}>
                  {error}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                {editor.mode === "edit" && editor.deletable && (editor.userCount > 0 ? (
                  <span className="text-[12px]" style={{ color: SLATE }}>ยังมีผู้ใช้ {editor.userCount} คนในบทบาทนี้ — ย้ายผู้ใช้ออกก่อนจึงจะลบได้</span>
                ) : (
                  <button type="button" onClick={() => handleDelete(editor)} disabled={deletingKey === editor.key} className={BTN_DANGER} data-testid="role-delete">
                    {deletingKey === editor.key ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} aria-hidden />}
                    ลบบทบาท
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditor(null)} className={BTN_SECONDARY}>
                  {editor.readOnly ? "ปิด" : "ยกเลิก"}
                </button>
                {!editor.readOnly && (
                  <button type="button" onClick={handleSave} disabled={saving} className={BTN_PRIMARY} data-testid="role-save">
                    {saving && <Loader2 size={15} className="animate-spin" />}
                    {editor.mode === "create" ? "สร้างบทบาท" : "บันทึก"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────── */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-medium text-white"
          style={{ background: toast.type === "error" ? "#991B1B" : "#065F46", boxShadow: "0 8px 32px rgba(13,27,42,0.25)" }}
        >
          {toast.type === "error" ? <X size={16} aria-hidden /> : <Check size={16} aria-hidden />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
