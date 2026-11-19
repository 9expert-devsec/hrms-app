"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Eye, FileText, Info, Loader2, Paperclip, Search, Undo2, X } from "lucide-react";
import { BLUE, BTN_PRIMARY, BTN_SECONDARY, FOCUS, LINE, MUTED, NAVY, SLATE } from "../../../../../components/hr/hrUi";
import PersonAvatar from "../../../../../components/PersonAvatar";
import MySignaturePicker from "../../../../../components/MySignaturePicker";
import { saveMySignature } from "../../../../../components/offsite/SignatureConfirm";
import { refreshInbox } from "../../../../../components/inbox/InboxProvider";
import { formatLeaveAmount, leavePeriodText, thaiDateRange, thaiDateShort, thaiDateTime } from "@/lib/leave/format";
import { STATUS_CHIPS } from "@/lib/leave/flow";
import { FORM_CATEGORY_LABELS } from "@/lib/leaveRules";

const TAB_LABELS = { approve: "รอฉันอนุมัติ", acknowledge: "รอฉันรับทราบ", hr: "รอ HR ตรวจสอบ", cancel: "คำขอยกเลิก", done: "ดำเนินการแล้ว" };
const ROLE_LABELS = { approver1: "ผู้อนุมัติ (1)", approver2: "ผู้อนุมัติ (2)", acknowledger: "ผู้รับทราบ", hr: "ฝ่ายบุคคล" };
const STAT_LABELS = { ...FORM_CATEGORY_LABELS, other: "ลาอื่นๆ" };
const GREEN = "#15803D";
const RED = "#B91C1C";
const BTN_REJECT = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#F87171] bg-white px-4 text-[14px] font-semibold text-[#B91C1C] transition-colors hover:bg-[#FEF2F2] disabled:opacity-50 ${FOCUS}`;
const TEXTAREA = "w-full rounded-xl border bg-white px-3 py-2.5 text-[14px] text-[#0D1B2A] outline-none placeholder:text-[#8592A6] focus:ring-2 focus:ring-[#005CFF]/30";
const CARD = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 18 };

const roleNo = (role) => (role === "approver2" ? 2 : 1);
const isWide = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

async function callJson(url, init) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.ok !== false, status: res.status, json };
}

/** อนุมัติการลา: tabs, request cards on the left, the selected leave on the right. */
export default function ApproveClient({ initialTab, initialId }) {
  const router = useRouter();
  const [meta, setMeta] = useState(null); // { tabs, counts, isSigner, noSigner, linked }
  const [tab, setTab] = useState(initialTab || null);
  const [items, setItems] = useState([]);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(initialId || null);
  const [detail, setDetail] = useState(null);
  const [detailState, setDetailState] = useState("idle"); // idle | loading | error
  const firstLoad = useRef(true);

  const syncUrl = useCallback(
    (t, id) => {
      const q = new URLSearchParams();
      if (t) q.set("tab", t);
      if (id) q.set("id", id);
      router.replace(`/dashboard/leave/approve${q.toString() ? `?${q}` : ""}`, { scroll: false });
    },
    [router]
  );

  const loadList = useCallback(
    async (t) => {
      setListLoading(true);
      setListError("");
      const { ok, json } = await callJson(`/api/leave/approvals?tab=${t || "approve"}`);
      if (!ok) {
        setListError(json.message || "โหลดรายการไม่สำเร็จ");
        setListLoading(false);
        return null;
      }
      setMeta({ tabs: json.tabs, counts: json.counts, isSigner: json.isSigner, noSigner: json.noSigner, linked: json.linked });
      setHoursPerDay(json.hoursPerDay || 8);
      setItems(json.items || []);
      setListLoading(false);
      return json;
    },
    []
  );

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      setDetailState("idle");
      return;
    }
    setDetailState("loading");
    const { ok, json } = await callJson(`/api/leave/approvals/${id}`);
    if (!ok) {
      setDetail(null);
      setDetailState("error");
      return;
    }
    setDetail(json);
    setDetailState("idle");
  }, []);

  // First load: the tab from the URL when this user has it, else the first.
  useEffect(() => {
    (async () => {
      const json = await loadList(initialTab || "approve");
      if (!json) return;
      const pick = json.tabs.includes(initialTab) ? initialTab : json.tabs[0];
      if (pick !== (initialTab || "approve")) {
        setTab(pick);
        const again = await loadList(pick);
        if (!again) return;
        if (!initialId && isWide() && again.items[0]) setSelectedId(again.items[0]._id);
      } else {
        setTab(pick);
        if (!initialId && isWide() && json.items[0]) setSelectedId(json.items[0]._id);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadDetail(selectedId);
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    syncUrl(tab, selectedId);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchTab = async (t) => {
    if (t === tab) return;
    setTab(t);
    setSearch("");
    const json = await loadList(t);
    const next = json && isWide() ? json.items[0]?._id || null : null;
    setSelectedId(next);
    syncUrl(t, next);
  };

  /** After an action: refresh the counts, the list and the open leave. */
  const afterAction = async () => {
    refreshInbox();
    await loadList(tab);
    await loadDetail(selectedId);
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.employee.name.toLowerCase().includes(q)) : items;
  }, [items, search]);

  const tabs = meta?.tabs || [];
  const showDetailOnly = !!selectedId; // < lg: the detail replaces the list

  return (
    <div>
      <h1 className="sr-only">อนุมัติการลา</h1>

      {/* Tabs */}
      <div className="-mx-1 flex gap-1 overflow-x-auto border-b px-1" style={{ borderColor: LINE }} role="tablist" aria-label="อนุมัติการลา">
        {tabs.map((t) => {
          const active = t === tab;
          const count = meta?.counts?.[t];
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(t)}
              data-testid={`tab-${t}`}
              className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-[14px] ${FOCUS}`}
              style={{ borderColor: active ? BLUE : "transparent", color: active ? BLUE : SLATE, fontWeight: active ? 700 : 500 }}
            >
              {TAB_LABELS[t]}
              {t !== "done" && (
                <span
                  className="grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-bold"
                  style={{ background: active && count ? BLUE : "transparent", color: active && count ? "#fff" : SLATE }}
                  data-testid={`tab-count-${t}`}
                >
                  {count ?? 0}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* List */}
        <section className={showDetailOnly ? "hidden lg:block" : ""} aria-label="รายการใบลา">
          <label className="relative block">
            <span className="sr-only">ค้นหาชื่อพนักงาน</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อพนักงาน"
              className="h-11 w-full rounded-xl border bg-white pl-9 pr-3 text-[14px] outline-none placeholder:text-[#8592A6] focus:ring-2 focus:ring-[#005CFF]/30"
              style={{ borderColor: LINE, color: NAVY }}
              data-testid="approve-search"
            />
          </label>
          <div className="mt-3 space-y-3" data-testid="approve-list">
            {listLoading ? (
              <div className="flex items-center gap-2 p-6 text-[14px]" style={{ color: SLATE }}>
                <Loader2 size={16} className="animate-spin" /> กำลังโหลด…
              </div>
            ) : listError ? (
              <p className="rounded-xl bg-white p-6 text-[14px]" style={{ color: RED, border: `1px solid ${LINE}` }}>{listError}</p>
            ) : shown.length === 0 ? (
              <p className="rounded-[18px] bg-white p-8 text-center text-[14px]" style={{ color: SLATE, border: `1px solid ${LINE}` }} data-testid="approve-empty">
                ไม่มีใบลาที่รอคุณ
              </p>
            ) : (
              shown.map((i) => (
                <LeaveCard key={i._id} item={i} hoursPerDay={hoursPerDay} selected={i._id === selectedId} onSelect={() => setSelectedId(i._id)} />
              ))
            )}
          </div>
        </section>

        {/* Detail */}
        <section className={showDetailOnly ? "" : "hidden lg:block"} aria-label="รายละเอียดใบลา">
          {selectedId && (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className={`mb-3 inline-flex min-h-[44px] items-center gap-2 text-[14px] font-semibold lg:hidden ${FOCUS}`}
              style={{ color: BLUE }}
              data-testid="approve-back"
            >
              <ArrowLeft size={18} /> กลับไปที่รายการ
            </button>
          )}
          {detailState === "loading" && !detail ? (
            <div className="flex items-center gap-2 p-6 text-[14px]" style={{ ...CARD, color: SLATE }}>
              <Loader2 size={16} className="animate-spin" /> กำลังโหลด…
            </div>
          ) : detailState === "error" ? (
            <p className="p-6 text-[14px]" style={{ ...CARD, color: RED }}>ไม่พบใบลา หรือคุณไม่มีสิทธิ์ดูใบลานี้</p>
          ) : detail ? (
            <LeaveDetail key={`${detail.leave._id}-${detail.leave.status}-${detail.leave.revision}`} d={detail} onDone={afterAction} />
          ) : (
            <p className="hidden p-8 text-center text-[14px] lg:block" style={{ ...CARD, color: SLATE }}>เลือกใบลาจากรายการด้านซ้าย</p>
          )}
        </section>
      </div>
    </div>
  );
}

/* ── list card ──────────────────────────────────────────────── */

function LeaveCard({ item, hoursPerDay, selected, onSelect }) {
  const submitted = item.revision > 1 ? `ส่งใหม่หลังแก้ไข · ${thaiDateShort(item.submittedAt, { weekday: false })}` : `ส่งเมื่อ ${thaiDateTime(item.submittedAt)}`;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected || undefined}
      data-testid={`approve-card-${item._id}`}
      className={`block w-full rounded-[16px] p-4 text-left transition-colors ${FOCUS}`}
      style={{ background: selected ? "#F0F6FF" : "#fff", border: `${selected ? 2 : 1}px solid ${selected ? BLUE : LINE}`, margin: selected ? 0 : "1px 0" }}
    >
      <div className="flex items-start gap-3">
        <PersonAvatar src={item.employee.photoUrl} crop={item.employee.photoCrop} name={item.employee.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[15px] font-bold" style={{ color: NAVY }}>{item.employee.name}</p>
            {item.status === "cancel_requested" ? <StatusChip status="cancel_requested" testid="card-cancel-chip" /> : item.myRole && <RoleChip role={item.myRole} />}
          </div>
          <p className="truncate text-[13px]" style={{ color: SLATE }}>{item.employee.department || "-"}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]" style={{ color: NAVY }}>
        <TypeChip name={item.leaveTypeName} />
        <span className="font-semibold">{leavePeriodText(item)}</span>
        <span style={{ color: SLATE }}>· {formatLeaveAmount(item.totalHours, { unit: item.unit, hoursPerDay })}</span>
      </div>
      <p className="mt-2 text-[12px]" style={{ color: MUTED }}>{submitted}</p>
    </button>
  );
}

const RoleChip = ({ role }) => (
  <span className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ background: "#F3E8FF", color: "#7E22CE" }}>
    {ROLE_LABELS[role] || role}
  </span>
);
const TypeChip = ({ name }) => (
  <span className="rounded-md px-2 py-0.5 text-[13px] font-semibold" style={{ background: "#E0EDFF", color: "#1D4ED8" }}>{name}</span>
);
function StatusChip({ status, testid = "detail-status" }) {
  const c = STATUS_CHIPS[status] || { label: status, bg: "#EEF2F7", color: "#475569" };
  return (
    <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: c.bg, color: c.color }} data-testid={testid}>
      {c.label}
    </span>
  );
}

/* ── detail ─────────────────────────────────────────────────── */

function unitText(l) {
  if (l.unit === "half_day") return `ครึ่งวัน${l.halfDayPeriod === "afternoon" ? "บ่าย" : "เช้า"}`;
  if (l.unit === "hourly") return `รายชั่วโมง ${l.startTime || ""}–${l.endTime || ""}`;
  return "เต็มวัน";
}

function LeaveDetail({ d, onDone }) {
  const { leave: l, hoursPerDay } = d;
  const amt = (h, unit) => formatLeaveAmount(h, { unit, hoursPerDay });
  const [showFiles, setShowFiles] = useState(false);
  const range = l.startDate === l.endDate ? thaiDateShort(l.startDate) : `${thaiDateShort(l.startDate)} – ${thaiDateShort(l.endDate)}`;
  const excluded = l.excludedDates.length ? ` (ไม่นับ ${l.excludedDates.map((x) => thaiDateShort(x.date).replace(/ \d{4}$/, "")).join(", ")})` : "";
  const rows = [
    ["ประเภทการลา", `${l.leaveTypeName}${d.quota ? ` (คงเหลือ ${amt(d.quota.before)} → ${amt(d.quota.after)} หลังอนุมัติ)` : ""}`],
    ["รูปแบบ", unitText(l)],
    ["ช่วงวันที่", range],
    ["จำนวน", `${amt(l.totalHours, l.unit)}${excluded}`],
    ["เหตุผล", l.reason || "-"],
    ["ติดต่อระหว่างลา", l.contactDuringLeave || "-"],
    ["ลาครั้งล่าสุด", l.lastLeave ? `${l.lastLeave.leaveTypeName} · ${thaiDateRange(l.lastLeave.startDate, l.lastLeave.endDate)} · ${amt(l.lastLeave.totalHours, l.lastLeave.unit)}` : "-"],
  ];
  const a = d.actions;

  return (
    <article className="p-5 md:p-6" style={CARD} data-testid="approve-detail">
      {/* Header */}
      <header className="flex items-start gap-3">
        <PersonAvatar src={l.employee.photoUrl} crop={l.employee.photoCrop} name={l.employee.name} size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold leading-snug" style={{ color: NAVY }}>{l.employee.name}</h2>
          <p className="text-[13px]" style={{ color: SLATE }}>
            {[l.employee.position, l.employee.department, l.employee.code ? `รหัส ${l.employee.code}` : ""].filter(Boolean).join(" · ") || "-"}
          </p>
        </div>
        <StatusChip status={l.status} />
      </header>

      <Stepper d={d} />

      {/* Info table */}
      <dl className="mt-5 overflow-hidden rounded-2xl" style={{ border: `1px solid ${LINE}` }} data-testid="detail-info">
        {rows.map(([k, v], i) => (
          <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4" style={{ background: i % 2 === 0 ? "#F8FAFD" : "#fff" }}>
            <dt className="text-[13px]" style={{ color: SLATE }}>{k}</dt>
            <dd className="whitespace-pre-line break-words text-[14px]" style={{ color: NAVY }}>{v}</dd>
          </div>
        ))}
      </dl>

      {/* Secondary buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`/dashboard/leave/document?id=${l._id}`} className={BTN_SECONDARY} data-testid="detail-document">
          <FileText size={16} /> ดูใบลา QF-HRD-001
        </a>
        <button type="button" className={BTN_SECONDARY} onClick={() => setShowFiles((s) => !s)} aria-expanded={showFiles} disabled={!l.attachments.length}>
          <Paperclip size={16} /> ไฟล์แนบ ({l.attachments.length})
        </button>
      </div>
      {showFiles && l.attachments.length > 0 && (
        <ul className="mt-2 space-y-1 text-[14px]">
          {l.attachments.map((f) => (
            <li key={f.url}>
              <a
                href={`/api/leave/download?url=${encodeURIComponent(f.url)}&filename=${encodeURIComponent(f.name)}`}
                className="underline"
                style={{ color: BLUE }}
              >
                {f.name}
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* Action panel by role, or the decision summary */}
      {a.step1 ? (
        <Step1Panel d={d} role={a.step1} onDone={onDone} />
      ) : a.acknowledge ? (
        <AckPanel d={d} onDone={onDone} />
      ) : a.hr ? (
        <HrPanel d={d} onDone={onDone} />
      ) : a.cancel ? (
        <CancelPanel d={d} onDone={onDone} />
      ) : (
        <DecisionSummary d={d} />
      )}
    </article>
  );
}

/* ── stepper ────────────────────────────────────────────────── */

function Dot({ state, n }) {
  if (state === "done")
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: GREEN }} aria-label="เสร็จแล้ว">
        <Check size={16} color="#fff" strokeWidth={3} />
      </span>
    );
  if (state === "returned")
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: RED }} aria-label="ส่งกลับ">
        <X size={16} color="#fff" strokeWidth={3} />
      </span>
    );
  const current = state === "current";
  return (
    <span
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold"
      style={{ background: current ? BLUE : "#fff", color: current ? "#fff" : MUTED, border: current ? "none" : `1px solid ${LINE}` }}
      aria-current={current ? "step" : undefined}
    >
      {n}
    </span>
  );
}

function Stepper({ d }) {
  const l = d.leave;
  const s1 = l.step1;
  const ret = l.status === "returned" ? l.returnInfo : null;
  const step1Done = l.autoApproved || s1?.decision === "approved";
  const hrDone = l.hr?.decision === "approved" || l.status === "approved" || l.status === "cancel_requested";

  const st2 = ret?.step === 1 ? "returned" : step1Done ? "done" : l.status === "pending_approval" ? "current" : "future";
  const st3 = ret?.step === 2 ? "returned" : hrDone ? "done" : l.status === "pending_hr" ? "current" : "future";

  let step2Lines;
  if (l.autoApproved) step2Lines = ["อนุมัติอัตโนมัติ (ไม่มีขั้นผู้อนุมัติ)"];
  else if (st2 === "returned") step2Lines = [`ส่งกลับโดย: ${ret.byName}`, thaiDateTime(ret.at)];
  else if (step1Done) {
    const ack = l.ack;
    step2Lines = [`อนุมัติ: ${s1.name}`, thaiDateTime(s1.at)];
    if (ack) step2Lines.push(ack.done ? `${ack.name} รับทราบแล้ว` : `${ack.name} ยังไม่รับทราบ`);
  } else {
    step2Lines = [`รอ: ${l.approvers.map((x) => x.name).join(" / ") || "-"}`];
    if (l.approvers.length > 1) step2Lines.push("อีกคนรับทราบภายหลัง");
  }
  const step3Lines =
    st3 === "returned"
      ? [`ส่งกลับโดย: ${ret.byName}`, thaiDateTime(ret.at)]
      : hrDone && l.hr
        ? [`${l.hr.name}${l.hr.selfApproved ? " (อนุมัติตนเอง)" : ""}`, thaiDateTime(l.hr.at)]
        : [d.hrSigners.length ? d.hrSigners.join(" / ") : "ยังไม่ได้ตั้งผู้ลงนาม"];

  const steps = [
    { n: 1, title: "ส่งใบลา", state: "done", lines: [thaiDateTime(l.submittedAt)] },
    { n: 2, title: l.approvers.length > 1 ? "ผู้อนุมัติ (1) หรือ (2)" : "ผู้อนุมัติ", state: st2, lines: step2Lines },
    { n: 3, title: "ฝ่ายบุคคล", state: st3, lines: step3Lines },
  ];
  return (
    <ol className="mt-5 grid gap-4 sm:grid-cols-3" data-testid="detail-stepper">
      {steps.map((s) => (
        <li key={s.n} data-state={s.state}>
          <div className="flex items-center gap-2">
            <Dot state={s.state} n={s.n} />
            <span className="text-[14px] font-semibold" style={{ color: s.state === "future" ? MUTED : NAVY }}>{s.title}</span>
          </div>
          {s.lines.map((t, i) => (
            <p key={i} className="mt-1 text-[12px] leading-snug" style={{ color: s.state === "returned" && i === 0 ? RED : SLATE }}>{t}</p>
          ))}
        </li>
      ))}
    </ol>
  );
}

/* ── action panels ──────────────────────────────────────────── */

/** Shared: signature (picker only when no profile signature), POST, errors. */
function useAction(d, onDone) {
  const [sig, setSig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (path, body) => {
    if (!d.profileSignature && !sig?.png) {
      setError("กรุณาลงลายเซ็นก่อน");
      return;
    }
    setBusy(true);
    setError("");
    const { ok, json } = await callJson(`/api/leave/${d.leave._id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, revision: d.leave.revision, ...(d.profileSignature ? {} : { signature: sig.png }) }),
    });
    if (!ok) {
      setBusy(false);
      setError(json.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      if (json.message === "ใบลานี้ถูกดำเนินการไปแล้ว") setTimeout(onDone, 1200);
      return;
    }
    if (!d.profileSignature && sig?.saveAsMine) await saveMySignature(sig.png).catch(() => {});
    await onDone();
  };
  const picker = d.profileSignature ? null : (
    <div className="mt-3">
      <MySignaturePicker label="ลายเซ็นของคุณ (ยังไม่มีลายเซ็นในโปรไฟล์)" onChange={setSig} />
    </div>
  );
  return { run, busy, error, setError, picker };
}

const PANEL = "mt-5 rounded-2xl p-4 md:p-5";
const PANEL_BG = { background: "#F5F7FB" };

function ErrorLine({ text }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-2 text-[13px] font-medium" style={{ color: RED }} data-testid="action-error">{text}</p>
  );
}

function ReasonBox({ value, onChange, placeholder, invalid, testid }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      maxLength={1000}
      placeholder={placeholder}
      aria-label="เหตุผล"
      aria-invalid={invalid || undefined}
      className={`${TEXTAREA} mt-3`}
      style={{ borderColor: invalid ? "#F87171" : LINE }}
      data-testid={testid}
    />
  );
}

function Step1Panel({ d, role, onDone }) {
  const [note, setNote] = useState("");
  const [noteErr, setNoteErr] = useState(false);
  const { run, busy, error, setError, picker } = useAction(d, onDone);
  const reject = () => {
    if (!note.trim()) {
      setNoteErr(true);
      setError("กรุณาระบุเหตุผลที่ไม่อนุมัติ");
      return;
    }
    run("step1", { decision: "returned", note });
  };
  return (
    <section className={PANEL} style={PANEL_BG} data-testid="panel-step1">
      <h3 className="text-[15px] font-bold" style={{ color: NAVY }}>ความคิดเห็นของคุณในฐานะผู้อนุมัติ ({roleNo(role)})</h3>
      <ReasonBox
        value={note}
        onChange={(v) => {
          setNote(v);
          if (v.trim()) setNoteErr(false);
        }}
        placeholder="เหตุผล — จำเป็นเมื่อ “ไม่อนุมัติ” (พิมพ์ลงช่องเหตุผลบนใบลา)"
        invalid={noteErr}
        testid="step1-note"
      />
      {picker}
      <ErrorLine text={error} />
      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="flex items-start gap-1.5 text-[12px]" style={{ color: SLATE }}>
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden /> ลงนามด้วยลายเซ็นในโปรไฟล์ · ไม่อนุมัติ = ส่งกลับให้ผู้ขอแก้ไขแล้วส่งใหม่
        </p>
        <div className="flex flex-wrap gap-2 md:shrink-0">
          <button type="button" className={BTN_REJECT} onClick={reject} disabled={busy} data-testid="step1-return">
            <X size={16} /> ไม่อนุมัติ · ส่งกลับแก้ไข
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={() => run("step1", { decision: "approved", note })} disabled={busy} data-testid="step1-approve">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} อนุมัติและลงนาม
          </button>
        </div>
      </div>
    </section>
  );
}

function AckPanel({ d, onDone }) {
  const l = d.leave;
  const { run, busy, error, picker } = useAction(d, onDone);
  const myNo = roleNo(l.ack?.expectedRole);
  return (
    <section className={PANEL} style={PANEL_BG} data-testid="panel-ack">
      <h3 className="text-[15px] font-bold" style={{ color: NAVY }}>ผู้รับทราบ</h3>
      {l.step1 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px]" style={{ background: "#DCFCE7", color: "#166534" }}>
          <Check size={16} className="mt-0.5 shrink-0" aria-hidden />
          {l.step1.name} (ผู้อนุมัติ {roleNo(l.step1.role)}) อนุมัติแล้วเมื่อ {thaiDateTime(l.step1.at)}
        </p>
      )}
      <p className="mt-3 text-[14px]" style={{ color: NAVY }}>
        ในฐานะผู้อนุมัติ ({myNo}) — กดรับทราบเพื่อลงชื่อในช่อง “2. สำหรับผู้จัดการแผนก” ของใบลา
      </p>
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 text-[12px]" style={{ color: SLATE }}>
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
        การรับทราบไม่บล็อก HR — HR อนุมัติได้เลย และคุณยังกดรับทราบได้แม้ HR อนุมัติไปแล้ว
      </p>
      {picker}
      <ErrorLine text={error} />
      <div className="mt-3 flex justify-end">
        <button type="button" className={BTN_PRIMARY} onClick={() => run("acknowledge", {})} disabled={busy} data-testid="ack-submit">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} รับทราบและลงนาม
        </button>
      </div>
    </section>
  );
}

function StepSummaryBox({ l }) {
  const s1 = l.step1;
  const ack = l.ack;
  return (
    <div className="mt-3 space-y-1 rounded-xl bg-white px-3 py-2.5 text-[13px]" data-testid="hr-step1-summary">
      {l.autoApproved ? (
        <p style={{ color: SLATE }}>ไม่มีขั้นผู้อนุมัติ — อนุมัติอัตโนมัติ</p>
      ) : s1?.decision === "approved" ? (
        <p className="flex justify-between gap-3">
          <span style={{ color: SLATE }}>ผู้อนุมัติ ({roleNo(s1.role)}) {s1.name}</span>
          <span className="font-semibold" style={{ color: GREEN }}>อนุมัติ ✓</span>
        </p>
      ) : null}
      {ack && (
        <p className="flex justify-between gap-3">
          <span style={{ color: SLATE }}>ผู้อนุมัติ ({roleNo(ack.expectedRole)}) {ack.name}</span>
          <span style={{ color: ack.done ? GREEN : MUTED }}>{ack.done ? "รับทราบแล้ว" : "ยังไม่รับทราบ · ไม่บังคับ"}</span>
        </p>
      )}
    </div>
  );
}

function StatsTable({ stats, hoursPerDay }) {
  const f = (h) => (h ? formatLeaveAmount(h, { hoursPerDay }) : "–");
  return (
    <div className="mt-2 overflow-x-auto rounded-xl bg-white" style={{ border: `1px solid ${LINE}` }}>
      <table className="w-full min-w-[360px] text-[13px]" data-testid="hr-stats">
        <thead>
          <tr style={{ background: "#F8FAFD", color: SLATE }}>
            <th className="px-3 py-2 text-left font-semibold">ประเภท</th>
            <th className="px-3 py-2 text-center font-semibold">ลามาแล้ว</th>
            <th className="px-3 py-2 text-center font-semibold">ครั้งนี้</th>
            <th className="px-3 py-2 text-center font-semibold">รวมสะสม</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((r) => (
            <tr key={r.category} style={{ borderTop: `1px solid ${LINE}`, color: NAVY }} data-category={r.category}>
              <td className="px-3 py-2">{STAT_LABELS[r.category]}</td>
              <td className="px-3 py-2 text-center">{f(r.before)}</td>
              <td className="px-3 py-2 text-center font-bold" style={{ color: r.now ? BLUE : NAVY }}>{f(r.now)}</td>
              <td className="px-3 py-2 text-center">{f(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HrPanel({ d, onDone }) {
  const l = d.leave;
  const [note, setNote] = useState("");
  const [noteErr, setNoteErr] = useState(false);
  const { run, busy, error, setError, picker } = useAction(d, onDone);
  const reject = () => {
    if (!note.trim()) {
      setNoteErr(true);
      setError("กรุณาระบุเหตุผลที่ไม่อนุมัติ");
      return;
    }
    run("hr", { decision: "returned", note });
  };
  return (
    <section className={PANEL} style={PANEL_BG} data-testid="panel-hr">
      <h3 className="text-[15px] font-bold" style={{ color: NAVY }}>ฝ่ายบุคคล · ตรวจสอบ</h3>
      <StepSummaryBox l={l} />
      {d.stats && (
        <>
          <h4 className="mt-4 text-[14px] font-bold" style={{ color: NAVY }}>สถิติการลาในปีงบประมาณนี้</h4>
          <StatsTable stats={d.stats} hoursPerDay={d.hoursPerDay} />
        </>
      )}
      <div className="mt-4 flex items-baseline justify-between gap-3 text-[13px]">
        <span style={{ color: SLATE }}>ลงนามโดย</span>
        <span className="font-bold" style={{ color: NAVY }} data-testid="hr-signer">{d.viewerName}</span>
      </div>
      <p className="mt-0.5 text-[12px]" style={{ color: MUTED }}>ผู้ลงนาม HR กำหนดใน ตั้งค่าการลา</p>
      {d.actions.hrSelf && (
        <p className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium" style={{ background: "#FEF3C7", color: "#92400E" }} data-testid="hr-self-warning">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          คุณกำลังอนุมัติใบลาของตนเอง — จะบันทึกว่าอนุมัติตนเอง
        </p>
      )}
      <ReasonBox
        value={note}
        onChange={(v) => {
          setNote(v);
          if (v.trim()) setNoteErr(false);
        }}
        placeholder="เหตุผล — จำเป็นเมื่อไม่อนุมัติ"
        invalid={noteErr}
        testid="hr-note"
      />
      {picker}
      <ErrorLine text={error} />
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className={BTN_REJECT} onClick={reject} disabled={busy} data-testid="hr-return">
          <X size={16} /> ไม่อนุมัติ · ส่งกลับ
        </button>
        <button type="button" className={BTN_PRIMARY} onClick={() => run("hr", { decision: "approved", note })} disabled={busy} data-testid="hr-approve">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} อนุมัติ
        </button>
      </div>
    </section>
  );
}

/** คำขอยกเลิกใบลา (HR signers): approve → cancelled, days back; reject → approved. */
function CancelPanel({ d, onDone }) {
  const l = d.leave;
  const cr = l.cancelRequest || {};
  const amt = (h) => formatLeaveAmount(h, { hoursPerDay: d.hoursPerDay });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const decide = async (decision) => {
    setBusy(true);
    setError("");
    const { ok, json } = await callJson(`/api/leave/${l._id}/cancel-decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note, revision: l.revision }),
    });
    if (!ok) {
      setBusy(false);
      setError(json.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      if (json.message === "ใบลานี้ถูกดำเนินการไปแล้ว") setTimeout(onDone, 1200);
      return;
    }
    await onDone();
  };
  return (
    <section className={PANEL} style={PANEL_BG} data-testid="panel-cancel">
      <h3 className="text-[15px] font-bold" style={{ color: NAVY }}>คำขอยกเลิกใบลา</h3>
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 text-[13px]" style={{ color: SLATE }}>
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
        ใบลานี้อนุมัติแล้วเมื่อ {thaiDateShort(l.hr?.at, { weekday: false })} — ผู้ขอยื่นขอยกเลิก {thaiDateShort(cr.requestedAt, { weekday: false })}
      </p>
      <div className="mt-3 rounded-xl bg-white px-3 py-2.5">
        <p className="text-[12px]" style={{ color: SLATE }}>เหตุผลที่ขอยกเลิก</p>
        <p className="mt-0.5 break-words text-[14px] font-semibold" style={{ color: NAVY }} data-testid="cancel-reason-text">{cr.reason || "-"}</p>
      </div>
      <div className="mt-3 rounded-xl px-3 py-2.5 text-[13px]" style={{ background: "#DCFCE7", color: "#166534" }} data-testid="cancel-restore">
        <p className="font-bold">เมื่ออนุมัติการยกเลิก</p>
        <p className="mt-1 flex justify-between gap-3">
          <span>คืนวันลา · {l.leaveTypeName}</span>
          <span className="font-bold">+{amt(l.totalHours)}</span>
        </p>
        {d.quota && (
          <p className="flex justify-between gap-3">
            <span>คงเหลือ</span>
            <span className="font-bold">{amt(d.quota.after)} → {amt(d.quota.before)}</span>
          </p>
        )}
      </div>
      {d.actions.cancelSelf && (
        <p className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium" style={{ background: "#FEF3C7", color: "#92400E" }} data-testid="cancel-self-warning">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          คุณกำลังอนุมัติใบลาของตนเอง — จะบันทึกว่าอนุมัติตนเอง
        </p>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="หมายเหตุถึงผู้ขอ (ถ้ามี)"
        aria-label="หมายเหตุถึงผู้ขอ"
        className={`${TEXTAREA} mt-3`}
        style={{ borderColor: LINE }}
        data-testid="cancel-note"
      />
      <ErrorLine text={error} />
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className={BTN_SECONDARY} onClick={() => decide("rejected")} disabled={busy} data-testid="cancel-reject">
          ปฏิเสธคำขอ
        </button>
        <button type="button" className={BTN_PRIMARY} onClick={() => decide("approved")} disabled={busy} data-testid="cancel-approve">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Undo2 size={16} />} อนุมัติยกเลิก · คืนวันลา
        </button>
      </div>
    </section>
  );
}

/** No action for this viewer: what has been decided so far. */
function DecisionSummary({ d }) {
  const l = d.leave;
  const lines = [];
  if (l.autoApproved) lines.push({ text: "ขั้นผู้อนุมัติ: อนุมัติอัตโนมัติ (ไม่มีผู้อนุมัติ)" });
  else if (l.step1?.decision === "approved") lines.push({ text: `ผู้อนุมัติ (${roleNo(l.step1.role)}) ${l.step1.name} อนุมัติเมื่อ ${thaiDateTime(l.step1.at)}`, color: GREEN });
  if (l.ack) lines.push({ text: l.ack.done ? `ผู้อนุมัติ (${roleNo(l.ack.expectedRole)}) ${l.ack.name} รับทราบเมื่อ ${thaiDateTime(l.ack.at)}` : `ผู้อนุมัติ (${roleNo(l.ack.expectedRole)}) ${l.ack.name} ยังไม่รับทราบ` });
  if (l.hr?.decision === "approved") lines.push({ text: `ฝ่ายบุคคล ${l.hr.name} อนุมัติเมื่อ ${thaiDateTime(l.hr.at)}${l.hr.selfApproved ? " · อนุมัติตนเอง" : ""}`, color: GREEN });
  if (l.status === "returned" && l.returnInfo)
    lines.push({ text: `ส่งกลับโดย ${l.returnInfo.byName} (${l.returnInfo.step === 2 ? "ฝ่ายบุคคล" : "ผู้อนุมัติ"}) เมื่อ ${thaiDateTime(l.returnInfo.at)} — เหตุผล: ${l.returnInfo.reason}`, color: RED });
  if (l.cancelRequest?.requestedAt) lines.push({ text: `ผู้ขอยื่นขอยกเลิกเมื่อ ${thaiDateTime(l.cancelRequest.requestedAt)} — ${l.cancelRequest.reason}` });
  if (l.cancelRequest?.decision === "approved")
    lines.push({ text: `ฝ่ายบุคคล ${l.cancelRequest.decidedByName} อนุมัติการยกเลิกเมื่อ ${thaiDateTime(l.cancelRequest.decidedAt)}${l.cancelRequest.selfApproved ? " · อนุมัติตนเอง" : ""}`, color: GREEN });
  if (l.cancelRequest?.decision === "rejected")
    lines.push({ text: `ฝ่ายบุคคล ${l.cancelRequest.decidedByName} ปฏิเสธคำขอยกเลิกเมื่อ ${thaiDateTime(l.cancelRequest.decidedAt)}${l.cancelRequest.note ? ` — ${l.cancelRequest.note}` : ""}`, color: RED });
  if (l.status === "cancel_requested" && !d.actions.cancel) lines.push({ text: d.noSigner ? "รอผู้ลงนามฝ่ายบุคคลพิจารณาคำขอยกเลิก" : `รอฝ่ายบุคคลพิจารณาคำขอยกเลิก: ${d.hrSigners.join(" / ")}` });
  if (l.status === "cancelled" && !l.cancelRequest?.decision) lines.push({ text: l.withdrawnAt ? `ผู้ขอยกเลิกใบลาเมื่อ ${thaiDateTime(l.withdrawnAt)}` : "ใบลานี้ถูกยกเลิก" });
  if (l.status === "pending_approval") lines.push({ text: `รอผู้อนุมัติ: ${l.approvers.map((x) => x.name).join(" / ") || "-"}` });
  if (l.status === "pending_hr" && !d.noSigner) lines.push({ text: `รอฝ่ายบุคคลลงนาม: ${d.hrSigners.join(" / ")}` });

  return (
    <section className={PANEL} style={PANEL_BG} data-testid="panel-summary">
      <h3 className="text-[15px] font-bold" style={{ color: NAVY }}>สรุปการดำเนินการ</h3>
      {l.status === "pending_hr" && d.noSigner && (
        <p className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium" style={{ background: "#FEF3C7", color: "#92400E" }} data-testid="no-signer-warning">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          ยังไม่ได้ตั้งผู้ลงนามฝ่ายบุคคล — ตั้งได้ที่ ตั้งค่าการลา
        </p>
      )}
      <ul className="mt-3 space-y-1.5 text-[14px]">
        {lines.map((x, i) => (
          <li key={i} style={{ color: x.color || NAVY }}>{x.text}</li>
        ))}
      </ul>
    </section>
  );
}
