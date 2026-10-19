"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Crown, Loader2, Pencil, Send, XCircle, FileSignature, MapPin, CalendarDays, Clock } from "lucide-react";
import {
  APPROVAL_ROLE_LABELS,
  TRAVEL_MODE_LABELS,
  formatDateTimeTh,
  formatWorkDateTh,
} from "@/lib/offsiteRules";
import OffsiteProgress from "./OffsiteProgress";
import SignatureConfirm from "./SignatureConfirm";
import { CARD, INPUT_STYLE, NAVY, SLATE, BLUE, Button, ErrorBox, StatusChip, MemberStatusChip, api } from "./ui";

const EVENT_LABELS = {
  created: "สร้างคำขอ",
  updated: "แก้ไขคำขอ",
  invitations_sent: "ส่งคำเชิญ",
  member_accepted: "สมาชิกตอบรับ",
  member_declined: "สมาชิกปฏิเสธ",
  returned: "ส่งกลับให้ผู้สร้างแก้ไข",
  members_ready: "สมาชิกตอบรับครบ",
  step1_signed: "ผู้สร้างลงนาม (ขั้นที่ 1)",
  step2_pending: "รอหัวหน้าฝ่ายบัญชีลงนาม",
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

function Section({ title, children, right }) {
  return (
    <section className="space-y-4 p-6" style={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 style={{ color: NAVY, fontWeight: 600 }}>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** A required-reason box with a confirm button (decline / cancel). */
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

export default function OffsiteDetail({ id }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState(searchParams.get("error") || "");
  const [busy, setBusy] = useState(null);
  const [panel, setPanel] = useState(null); // decline | cancel | submit

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

  const act = async (action, extra = {}) => {
    setBusy(action);
    setError("");
    try {
      setData(await api(`/api/offsite/requests/${id}`, { method: "POST", body: { action, ...extra } }));
      setPanel(null);
      router.refresh(); // menu badge
    } catch (e) {
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

  const notes = [
    `${accepted}/${r.members.length} คน`,
    step(1).status === "approved" ? formatDateTimeTh(step(1).signedAt) : "",
    step(2).status === "pending" ? `รอ ${step(2).approverName}` : step(2).status === "approved" ? step(2).approverName : "",
    step(3).status === "pending" ? `รอ ${step(3).approverName}` : step(3).status === "approved" ? step(3).approverName : "",
    "",
  ];

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
            <div className="text-xs" style={{ color: SLATE }}>{r.docNo} · แบบขออนุญาตปฏิบัติงานนอกสถานที่</div>
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
      {v.isCreator && r.status === "returned" && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E" }}>
          <div className="font-semibold">คำขอถูกส่งกลับ — มีสมาชิกปฏิเสธ</div>
          <ul className="mt-1 list-disc pl-5">
            {declined.map((m) => (
              <li key={m.employee}>{m.nameSnapshot}: {m.declineReason}</li>
            ))}
          </ul>
          <div className="mt-1">แก้ไขรายชื่อหรือรายละเอียด แล้วส่งคำเชิญอีกครั้ง — สมาชิกที่ยอมรับแล้วไม่ต้องตอบใหม่ เว้นแต่ชื่องาน วันที่ เวลา หรือสถานที่เปลี่ยน</div>
        </div>
      )}

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
                <FileSignature size={14} /> ส่งแบบฟอร์ม
              </Button>
            )}
          </div>
          {r.status === "inviting" && <p className="text-xs" style={{ color: SLATE }}>ส่งแบบฟอร์มได้เมื่อสมาชิกทุกคนตอบรับแล้ว ({accepted}/{r.members.length})</p>}
          {panel === "submit" && v.canSubmit && (
            <div className="rounded-xl p-4" style={{ background: "#F8FAFD" }}>
              <SignatureConfirm
                title="ขั้นที่ 1 — ผู้สร้างคำขอลงนาม"
                note="เมื่อยืนยัน แบบฟอร์มจะส่งต่อให้หัวหน้าฝ่ายบัญชีลงนาม (ขั้นที่ 2)"
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
            return (
              <div key={n} className="rounded-xl p-4" style={{ background: "#F8FAFD", border: "1px solid #EEF2F7" }}>
                <div className="text-xs" style={{ color: SLATE }}>ขั้นที่ {n} · {APPROVAL_ROLE_LABELS[a.role]}</div>
                <div className="mt-1 text-sm font-medium" style={{ color: NAVY }}>
                  {a.status === "approved"
                    ? a.approverName
                    : a.status === "pending"
                      ? `รอ${APPROVAL_ROLE_LABELS[a.role]} (${a.approverName})`
                      : "ยังไม่ถึงขั้นนี้"}
                </div>
                <div className="mt-2 flex h-16 items-center justify-center rounded-lg bg-white" style={{ border: "1px dashed #CBD5E1" }}>
                  {a.signature ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.signature} alt={`ลายเซ็นขั้นที่ ${n}`} style={{ maxHeight: 56, width: "auto" }} />
                  ) : (
                    <span className="text-xs" style={{ color: SLATE }}>—</span>
                  )}
                </div>
                {a.signedAt && <div className="mt-1 text-xs" style={{ color: SLATE }}>ลงนาม {formatDateTimeTh(a.signedAt)}</div>}
              </div>
            );
          })}
        </div>
      </Section>

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
