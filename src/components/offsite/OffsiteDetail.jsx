"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Crown,
  Loader2,
  Pencil,
  Send,
  XCircle,
  FileSignature,
  MapPin,
  CalendarDays,
  Clock,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import {
  APPROVAL_ASK_LABELS,
  APPROVAL_ROLE_LABELS,
  CHANGE_FIELD_LABELS,
  DEFAULT_ALLOWANCE_PER_PERSON,
  SELF_APPROVAL_LABEL,
  TRAVEL_MODE_LABELS,
  formatDateTimeTh,
  formatWorkDateTh,
  validateHrSummary,
} from "@/lib/offsiteRules";
import OffsiteProgress from "./OffsiteProgress";
import SignatureConfirm from "./SignatureConfirm";
import HrSection from "./HrSection";
import { CARD, INPUT_STYLE, NAVY, SLATE, BLUE, Button, Chip, ErrorBox, StatusChip, MemberStatusChip, api } from "./ui";

const EVENT_LABELS = {
  created: "สร้างคำขอ",
  updated: "แก้ไขคำขอ",
  invitations_sent: "ส่งคำเชิญ",
  member_accepted: "สมาชิกตอบรับ",
  member_declined: "สมาชิกปฏิเสธ",
  returned: "ส่งกลับให้ผู้สร้างแก้ไข",
  members_ready: "สมาชิกตอบรับครบ",
  approvals_reset: "ปรับขั้นการอนุมัติหลังส่งใหม่",
  step1_signed: "ผู้สร้างลงนาม (ขั้นที่ 1)",
  step2_pending: "รอหัวหน้าฝ่ายบัญชีลงนาม",
  step3_pending: "รอหัวหน้าฝ่ายบุคคลลงนาม",
  step2_reconfirm_pending: "รอหัวหน้าฝ่ายบัญชียืนยันอีกครั้ง",
  step3_reconfirm_pending: "รอหัวหน้าฝ่ายบุคคลยืนยันอีกครั้ง",
  step2_approved: "หัวหน้าฝ่ายบัญชีอนุมัติ",
  step3_approved: "หัวหน้าฝ่ายบุคคลอนุมัติ",
  step2_reconfirmed: "หัวหน้าฝ่ายบัญชียืนยันอีกครั้ง",
  step3_reconfirmed: "หัวหน้าฝ่ายบุคคลยืนยันอีกครั้ง",
  step2_rejected: "หัวหน้าฝ่ายบัญชีไม่อนุมัติ",
  step3_rejected: "หัวหน้าฝ่ายบุคคลไม่อนุมัติ",
  hr_summary_saved: "บันทึกส่วนสำหรับฝ่ายบุคคล",
  approved: "อนุมัติครบทุกขั้น",
  cancelled: "ยกเลิกคำขอ",
};

function Info({ label, children }) {
  return (
    <div>
      <dt className="text-xs" style={{ color: SLATE }}>{label}</dt>
      <dd className="text-sm" style={{ color: NAVY }}>{children || "-"}</dd>
    </div>
  );
}

function Section({ title, children, right, highlight = false }) {
  return (
    <section className="space-y-4 p-6" style={{ ...CARD, ...(highlight ? { border: `2px solid ${BLUE}` } : {}) }}>
      <div className="flex items-center justify-between gap-3">
        <h2 style={{ color: NAVY, fontWeight: 600 }}>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function SelfTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#FEF3C7", color: "#92400E" }} data-testid="self-approval-tag">
      <UserCheck size={11} /> {SELF_APPROVAL_LABEL}
    </span>
  );
}

/** A required-reason box with a confirm button (decline / reject / cancel). */
function ReasonForm({ label, confirmLabel, onSubmit, onClose, busy }) {
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const missing = tried && !reason.trim();
  return (
    <div className="space-y-2 rounded-xl p-4" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
      <label className="block text-sm font-medium" style={{ color: NAVY }}>
        {label}
        <span className="text-red-500"> *</span>
        <textarea
          rows={3}
          className="mt-1"
          style={{ ...INPUT_STYLE, ...(missing ? { border: "1px solid #EF4444" } : {}) }}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-required
          aria-invalid={missing || undefined}
        />
      </label>
      {missing && <p className="text-xs text-red-500">กรุณาระบุเหตุผล</p>}
      <div className="flex gap-2">
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            setTried(true);
            if (reason.trim()) onSubmit(reason.trim());
          }}
        >
          {busy && <Loader2 size={14} className="animate-spin" />} {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          ปิด
        </Button>
      </div>
    </div>
  );
}

/** "สิ่งที่เปลี่ยนจากครั้งก่อน" — fields changed and members added/removed. */
function ChangeSummary({ summary }) {
  const nothing = !summary.fields.length && !summary.membersAdded.length && !summary.membersRemoved.length;
  return (
    <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E3A8A" }} data-testid="change-summary">
      <div className="font-semibold">สิ่งที่เปลี่ยนจากครั้งก่อน (ครั้งที่ {summary.fromRevision} → {summary.toRevision})</div>
      {nothing ? (
        <div className="mt-1">ไม่มีการเปลี่ยนแปลงข้อมูล — ส่งใหม่เพื่อขอพิจารณาอีกครั้ง</div>
      ) : (
        <ul className="mt-1 list-disc pl-5">
          {summary.fields.map((f) => (
            <li key={f}>แก้ไข{CHANGE_FIELD_LABELS[f] || f}</li>
          ))}
          {summary.membersAdded.map((n) => (
            <li key={`+${n}`}>เพิ่มสมาชิก: {n}</li>
          ))}
          {summary.membersRemoved.map((n) => (
            <li key={`-${n}`}>นำสมาชิกออก: {n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Small line under a progress step / in a step card. */
function stepNote(a) {
  if (!a) return "";
  if (a.status === "approved") return a.approverName;
  if (a.status === "pending") return `รอ ${a.approverName}`;
  if (a.status === "needs_reconfirm") return `รอยืนยันอีกครั้ง (${a.approverName})`;
  if (a.status === "needs_resign") return "ต้องเซ็นใหม่";
  if (a.status === "rejected") return "ไม่อนุมัติ";
  return "";
}

export default function OffsiteDetail({ id }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState(searchParams.get("error") || "");
  const [busy, setBusy] = useState(null);
  const [panel, setPanel] = useState(null); // decline | cancel | submit | reject
  const [hr, setHr] = useState(null);
  const [hrErrors, setHrErrors] = useState({});

  const load = useCallback(async () => {
    try {
      setData(await api(`/api/offsite/requests/${id}`));
    } catch (e) {
      setLoadError(e.status === 403 ? "คุณไม่มีสิทธิ์ดูคำขอนี้" : e.status === 404 ? "ไม่พบคำขอ" : e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // The HR approver edits a local copy, pre-filled with the company default.
  useEffect(() => {
    if (data?.viewer?.canEditHr && hr === null) {
      const s = data.request.hrSummary || {};
      setHr({ allowanceOption: s.allowanceOption || null, amountPerPerson: s.amountPerPerson ?? DEFAULT_ALLOWANCE_PER_PERSON, note: s.note || "" });
    }
  }, [data, hr]);

  const act = async (action, extra = {}) => {
    setBusy(action);
    setError("");
    try {
      setData(await api(`/api/offsite/requests/${id}`, { method: "POST", body: { action, ...extra } }));
      setPanel(null);
      router.refresh(); // menu badge
    } catch (e) {
      if (e.body?.errors && (action === "approve" || action === "hr_summary")) setHrErrors(e.body.errors);
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (loadError) return <ErrorBox>{loadError}</ErrorBox>;
  if (!data) return <Loader2 className="animate-spin" size={18} />;

  const { request: r, viewer: v } = data;
  const step = (n) => r.approvals.find((a) => a.step === n) || {};
  const declined = r.members.filter((m) => m.status === "declined");
  const accepted = r.members.filter((m) => m.status === "accepted").length;
  const mine = r.members.find((m) => m.employee === v.employeeId);
  const active = v.activeStep ? step(v.activeStep) : null;
  const isApproverHere = v.canApprove || v.canReconfirm;
  const showChanges = r.changeSummary && r.changeSummary.toRevision === r.revision && r.status !== "returned" && r.status !== "draft";

  const notes = [`${accepted}/${r.members.length} คน`, step(1).status === "approved" ? formatDateTimeTh(step(1).signedAt) : stepNote(step(1)), stepNote(step(2)), stepNote(step(3)), ""];

  const approveWithHr = () => {
    if (v.activeStep === 3) {
      const errs = validateHrSummary(hr || {});
      setHrErrors(errs);
      if (Object.keys(errs).length) {
        setError("กรุณากรอกส่วนสำหรับฝ่ายบุคคลให้ครบก่อนอนุมัติ");
        return;
      }
      return act("approve", { step: 3, hrSummary: hr });
    }
    return act("approve", { step: v.activeStep });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/offsite" className="inline-flex items-center gap-1 text-sm" style={{ color: SLATE }}>
          <ArrowLeft size={14} /> กลับ
        </Link>
        <div className="flex flex-wrap gap-2">
          {v.canEdit && (
            <Button variant="secondary" onClick={() => router.push(`/dashboard/offsite/${r._id}/edit`)}>
              <Pencil size={14} /> แก้ไข
            </Button>
          )}
          {v.canCancel && (
            <Button variant="ghost" onClick={() => setPanel(panel === "cancel" ? null : "cancel")}>
              <XCircle size={14} /> ยกเลิกคำขอ
            </Button>
          )}
        </div>
      </div>

      {/* ── Header + progress ─────────────────────── */}
      <section className="space-y-5 p-6" style={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs" style={{ color: SLATE }}>
              {r.docNo || "ยังไม่ออกเลข"} · แบบขออนุญาตปฏิบัติงานนอกสถานที่{r.revision > 1 ? ` · ส่งครั้งที่ ${r.revision}` : ""}
            </div>
            <h1 style={{ color: NAVY, fontSize: "1.35rem", fontWeight: 700 }}>{r.jobName}</h1>
            <div className="mt-1 flex flex-wrap gap-4 text-sm" style={{ color: SLATE }}>
              <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> {formatWorkDateTh(r.workDate)}</span>
              <span className="inline-flex items-center gap-1"><Clock size={14} /> {r.startTime}–{r.endTime} น.</span>
              <span className="inline-flex items-center gap-1"><MapPin size={14} /> {r.placeName}</span>
            </div>
          </div>
          <StatusChip status={r.status} />
        </div>
        <OffsiteProgress progress={r.progress} notes={notes} />
      </section>

      <ErrorBox>{error}</ErrorBox>

      {panel === "cancel" && (
        <ReasonForm label="เหตุผลที่ยกเลิก" confirmLabel="ยืนยันการยกเลิก" busy={busy === "cancel"} onClose={() => setPanel(null)} onSubmit={(reason) => act("cancel", { reason })} />
      )}

      {/* ── Returned: the reason, prominently ─────── */}
      {r.status === "returned" && r.returnInfo && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#FEF2F2", border: "2px solid #FCA5A5", color: "#991B1B" }} role="alert">
          <div className="flex items-center gap-2 text-base font-bold">
            <AlertTriangle size={18} />
            {r.returnInfo.step ? `ไม่อนุมัติที่ขั้นที่ ${r.returnInfo.step} (${APPROVAL_ROLE_LABELS[step(r.returnInfo.step).role]})` : "คำขอถูกส่งกลับ — มีสมาชิกปฏิเสธ"}
          </div>
          <div className="mt-1">
            <b>{r.returnInfo.byName}</b>: {r.returnInfo.reason}
            <span className="ml-2 text-xs" style={{ color: "#B91C1C" }}>{formatDateTimeTh(r.returnInfo.at)}</span>
          </div>
          {!r.returnInfo.step && declined.length > 1 && (
            <ul className="mt-1 list-disc pl-5">
              {declined.map((m) => (
                <li key={m.employee}>{m.nameSnapshot}: {m.declineReason}</li>
              ))}
            </ul>
          )}
          {v.isCreator && (
            <div className="mt-2" style={{ color: "#7F1D1D" }}>
              แก้ไขแล้วส่งอีกครั้ง — ถ้าเปลี่ยนรายชื่อสมาชิก ทุกขั้นต้องเซ็นใหม่; ถ้ารายชื่อเหมือนเดิม ขั้นที่อนุมัติแล้วเพียงยืนยันอีกครั้ง
            </div>
          )}
        </div>
      )}

      {showChanges && <ChangeSummary summary={r.changeSummary} />}

      {/* ── Approver panel (steps 2–3) ────────────── */}
      {isApproverHere && active && (
        <Section title={`ขั้นที่ ${active.step} — ${APPROVAL_ROLE_LABELS[active.role]}`} highlight right={<Chip tone={v.canReconfirm ? "amber" : "blue"}>{v.canReconfirm ? APPROVAL_ASK_LABELS.needs_reconfirm : "รอคุณอนุมัติ"}</Chip>}>
          {v.inRequest && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "#92400E" }}>
              <SelfTag /> คุณอยู่ในกลุ่มของคำขอนี้ — การอนุมัติจะถูกระบุไว้ในเอกสาร
            </div>
          )}

          {v.canReconfirm && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: NAVY }}>
                คุณอนุมัติคำขอนี้ไปแล้วเมื่อ {formatDateTimeTh(active.signedAt)} แต่คำขอถูกส่งกลับและส่งใหม่ — กรุณาตรวจสอบสิ่งที่เปลี่ยนแล้วยืนยันอีกครั้ง (ใช้ลายเซ็นเดิม ไม่ต้องเซ็นใหม่)
              </p>
              {active.signature && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={active.signature} alt="ลายเซ็นเดิม" style={{ height: 48, width: "auto", background: "#fff" }} />
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => act("reconfirm", { step: active.step })} disabled={!!busy} data-testid="reconfirm">
                  {busy === "reconfirm" ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} ยืนยันอีกครั้ง
                </Button>
                <Button variant="ghost" onClick={() => setPanel("reject")} disabled={!!busy}>
                  <XCircle size={14} /> ไม่อนุมัติ
                </Button>
              </div>
            </div>
          )}

          {v.canApprove && (
            <div className="space-y-4">
              {v.canEditHr && hr && (
                <div className="space-y-3 rounded-xl p-4" style={{ background: "#F8FAFD", border: "1px solid #E2E8F0" }} data-testid="hr-section">
                  <div style={{ color: NAVY, fontWeight: 600 }}>สำหรับฝ่ายบุคคล</div>
                  <HrSection value={hr} onChange={setHr} editable errors={hrErrors} memberCount={r.members.length} />
                  <Button variant="secondary" onClick={() => act("hr_summary", { hrSummary: hr })} disabled={!!busy}>
                    {busy === "hr_summary" && <Loader2 size={14} className="animate-spin" />} บันทึกส่วนฝ่ายบุคคล (ยังไม่อนุมัติ)
                  </Button>
                </div>
              )}
              <div className="grid gap-6 md:grid-cols-[1fr_auto]">
                <SignatureConfirm
                  title="อนุมัติ"
                  note={active.step === 3 ? "กรอกส่วนสำหรับฝ่ายบุคคลให้ครบก่อนยืนยัน" : "เมื่อยืนยัน คำขอจะส่งต่อให้หัวหน้าฝ่ายบุคคล (ขั้นที่ 3)"}
                  confirmLabel={active.step === 3 ? "ยืนยัน (อนุมัติขั้นสุดท้าย)" : "ยืนยัน (อนุมัติ)"}
                  busy={busy === "approve"}
                  onConfirm={approveWithHr}
                />
                <div>
                  <Button variant="ghost" onClick={() => setPanel("reject")} disabled={!!busy}>
                    <XCircle size={14} /> ไม่อนุมัติ
                  </Button>
                </div>
              </div>
            </div>
          )}

          {panel === "reject" && (
            <ReasonForm label="เหตุผลที่ไม่อนุมัติ" confirmLabel="ยืนยันไม่อนุมัติ" busy={busy === "reject"} onClose={() => setPanel(null)} onSubmit={(reason) => act("reject", { step: active.step, reason })} />
          )}
        </Section>
      )}

      {/* ── Invitation for me ─────────────────────── */}
      {v.canRespond && (
        <Section title="คำเชิญของคุณ">
          <p className="text-sm" style={{ color: NAVY }}>
            {r.creatorNameTh} เชิญคุณไปปฏิบัติงานนอกสถานที่ หน้าที่ของคุณ: <b>{mine?.duty || "-"}</b>
            <br />
            <span style={{ color: SLATE }}>อ่านรายละเอียดด้านล่าง แล้วลงนามเพื่อยอมรับ หรือปฏิเสธพร้อมเหตุผล</span>
          </p>
          <div className="grid gap-6 md:grid-cols-[1fr_auto]">
            <SignatureConfirm title="ลงนามยอมรับ" confirmLabel="ยืนยัน (ยอมรับคำเชิญ)" busy={busy === "accept"} onConfirm={() => act("accept")} />
            <div>
              {panel !== "decline" && (
                <Button variant="ghost" onClick={() => setPanel("decline")}>
                  <XCircle size={14} /> ปฏิเสธ
                </Button>
              )}
            </div>
          </div>
          {panel === "decline" && (
            <ReasonForm label="เหตุผลที่ปฏิเสธ" confirmLabel="ยืนยันการปฏิเสธ" busy={busy === "decline"} onClose={() => setPanel(null)} onSubmit={(reason) => act("decline", { reason })} />
          )}
        </Section>
      )}

      {/* ── Creator actions ───────────────────────── */}
      {v.isCreator && ["draft", "returned", "inviting", "members_ready"].includes(r.status) && (
        <Section title="การดำเนินการของผู้สร้าง">
          <div className="flex flex-wrap gap-3">
            {v.canSend && (
              <Button onClick={() => act("send")} disabled={!!busy}>
                {busy === "send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {r.status === "returned" ? "ส่งคำเชิญอีกครั้ง" : "ส่งคำเชิญ"}
              </Button>
            )}
            {["inviting", "members_ready"].includes(r.status) && (
              <Button onClick={() => setPanel("submit")} disabled={!v.canSubmit || panel === "submit"} data-testid="submit-form">
                <FileSignature size={14} /> {step(1).status === "needs_resign" ? "เซ็นใหม่และส่งแบบฟอร์ม" : "ส่งแบบฟอร์ม"}
              </Button>
            )}
          </div>
          {r.status === "inviting" && <p className="text-xs" style={{ color: SLATE }}>ส่งแบบฟอร์มได้เมื่อสมาชิกทุกคนตอบรับแล้ว ({accepted}/{r.members.length})</p>}
          {panel === "submit" && v.canSubmit && (
            <div className="rounded-xl p-4" style={{ background: "#F8FAFD" }}>
              <SignatureConfirm
                title={step(1).status === "needs_resign" ? "ขั้นที่ 1 — ผู้สร้างคำขอเซ็นใหม่ (รายชื่อสมาชิกเปลี่ยน)" : "ขั้นที่ 1 — ผู้สร้างคำขอลงนาม"}
                note="เมื่อยืนยัน แบบฟอร์มจะส่งต่อให้หัวหน้าฝ่ายบัญชี (ขั้นที่ 2)"
                confirmLabel="ยืนยันและส่งแบบฟอร์ม"
                busy={busy === "submit"}
                onConfirm={() => act("submit")}
              />
            </div>
          )}
        </Section>
      )}

      {/* ── Details ───────────────────────────────── */}
      <Section title="รายละเอียด">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Info label="ข้าพเจ้า">{r.creatorNameTh}</Info>
          <Info label="ตำแหน่ง">{r.creatorPosition}</Info>
          <Info label="แผนก">{r.creatorDepartment}</Info>
          <Info label="สถานที่">{r.placeName}</Info>
          <Info label="ที่อยู่">{r.address}</Info>
          <Info label="การเดินทาง">{TRAVEL_MODE_LABELS[r.travelMode]}</Info>
        </dl>
        <dl className="grid gap-4">
          <Info label="รายละเอียดงาน"><span style={{ whiteSpace: "pre-wrap" }}>{r.description}</span></Info>
          {r.note && <Info label="หมายเหตุ"><span style={{ whiteSpace: "pre-wrap" }}>{r.note}</span></Info>}
        </dl>
      </Section>

      {/* ── Members ───────────────────────────────── */}
      <Section title="สมาชิก" right={<span className="text-xs" style={{ color: SLATE }}>ตอบรับแล้ว {accepted}/{r.members.length}</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: SLATE }}>
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">ชื่อ</th>
                <th className="py-2 pr-3">หน้าที่</th>
                <th className="py-2 pr-3">สถานะ</th>
                <th className="py-2 pr-3">เวลา</th>
                <th className="py-2">ลายเซ็น</th>
              </tr>
            </thead>
            <tbody>
              {r.members.map((m, i) => (
                <tr key={m.employee} className="border-t align-top" style={{ borderColor: "#EEF2F7", color: NAVY }}>
                  <td className="py-2 pr-3">{i + 1}</td>
                  <td className="py-2 pr-3">
                    {m.nameSnapshot}
                    {r.leader === m.employee && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs" style={{ color: "#B45309" }}><Crown size={12} /> หัวหน้าทีม</span>
                    )}
                    {m.employee === r.createdBy && <span className="ml-2 text-xs" style={{ color: BLUE }}>(ผู้สร้าง)</span>}
                  </td>
                  <td className="py-2 pr-3">{m.duty}</td>
                  <td className="py-2 pr-3">
                    {r.status === "draft" ? <span className="text-xs" style={{ color: SLATE }}>ยังไม่ส่งคำเชิญ</span> : <MemberStatusChip status={m.status} />}
                    {m.status === "declined" && m.declineReason && <div className="mt-1 text-xs" style={{ color: "#991B1B" }}>เหตุผล: {m.declineReason}</div>}
                  </td>
                  <td className="py-2 pr-3 text-xs" style={{ color: SLATE }}>{formatDateTimeTh(m.respondedAt)}</td>
                  <td className="py-2">
                    {m.signature ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.signature} alt={`ลายเซ็น ${m.nameSnapshot}`} style={{ height: 36, width: "auto", background: "#fff" }} />
                    ) : (
                      <span style={{ color: SLATE }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Approvals ─────────────────────────────── */}
      <Section title="การลงนามอนุมัติ">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((n) => {
            const a = step(n);
            const ask = APPROVAL_ASK_LABELS[a.status];
            return (
              <div key={n} className="rounded-xl p-4" style={{ background: "#F8FAFD", border: v.activeStep === n ? `2px solid ${BLUE}` : "1px solid #EEF2F7" }} data-testid={`step-${n}`}>
                <div className="flex items-center justify-between gap-2 text-xs" style={{ color: SLATE }}>
                  <span>ขั้นที่ {n} · {APPROVAL_ROLE_LABELS[a.role]}</span>
                  {ask && <Chip tone={a.status === "needs_reconfirm" ? "amber" : "red"}>{ask}</Chip>}
                  {a.status === "approved" && <CheckCircle2 size={14} style={{ color: "#16A34A" }} />}
                </div>
                <div className="mt-1 text-sm font-medium" style={{ color: NAVY }}>
                  {a.status === "approved" || a.status === "needs_reconfirm"
                    ? a.approverName
                    : a.status === "pending"
                      ? `รอ${APPROVAL_ROLE_LABELS[a.role]} (${a.approverName})`
                      : a.status === "rejected"
                        ? `${a.approverName} — ไม่อนุมัติ`
                        : a.status === "needs_resign"
                          ? "ต้องเซ็นใหม่ (เมื่อถึงขั้นนี้)"
                          : "ยังไม่ถึงขั้นนี้"}
                </div>
                {a.selfApproval && (
                  <div className="mt-1">
                    <SelfTag />
                  </div>
                )}
                <div className="mt-2 flex h-16 items-center justify-center rounded-lg bg-white" style={{ border: "1px dashed #CBD5E1" }}>
                  {a.signature ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.signature} alt={`ลายเซ็นขั้นที่ ${n}`} style={{ maxHeight: 56, width: "auto" }} />
                  ) : (
                    <span className="text-xs" style={{ color: SLATE }}>—</span>
                  )}
                </div>
                {a.signedAt && <div className="mt-1 text-xs" style={{ color: SLATE }}>ลงนาม {formatDateTimeTh(a.signedAt)}</div>}
                {a.confirmedAt && a.signedAt && new Date(a.confirmedAt).getTime() !== new Date(a.signedAt).getTime() && (
                  <div className="text-xs" style={{ color: SLATE }}>ยืนยันอีกครั้ง {formatDateTimeTh(a.confirmedAt)}</div>
                )}
                {a.status === "rejected" && a.reason && <div className="mt-1 text-xs" style={{ color: "#991B1B" }}>เหตุผล: {a.reason}</div>}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── HR section (read-only) ────────────────── */}
      {!v.canEditHr && (r.hrSummary?.allowanceOption || step(3).status !== "waiting") && (
        <Section title="สำหรับฝ่ายบุคคล" right={r.status === "approved" ? <span className="text-xs" style={{ color: SLATE }}>อนุมัติแล้ว — แก้ไขไม่ได้</span> : null}>
          <HrSection value={r.hrSummary} memberCount={r.members.length} />
        </Section>
      )}

      {/* ── History ───────────────────────────────── */}
      <Section title="ประวัติ">
        <ol className="space-y-1 text-xs" style={{ color: SLATE }}>
          {[...r.events].reverse().map((e, i) => (
            <li key={i}>
              <span style={{ color: NAVY }}>{formatDateTimeTh(e.at)}</span> — {EVENT_LABELS[e.type] || e.type}
              {e.detail ? `: ${e.detail}` : ""}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
