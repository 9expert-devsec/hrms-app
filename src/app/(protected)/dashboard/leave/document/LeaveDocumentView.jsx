"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, Printer, Undo2, X } from "lucide-react";
import { BTN_PRIMARY, FOCUS, LINE, MUTED, NAVY, SLATE } from "../../../../../components/hr/hrUi";
import LeaveFormQF, { LEAVE_FORM_CSS } from "../../../../../components/leave/LeaveFormQF";
import CancelRequestDialog from "../../../../../components/leave/CancelRequestDialog";
import { STATUS_CHIPS } from "@/lib/leave/flow";
import { formatLeaveAmount, thaiDateRange, thaiDateTime } from "@/lib/leave/format";

const PAPER_W = 794;
const PAPER_H = 1123;
const GREEN = "#15803D";
const RED = "#B91C1C";
const BTN_REJECT = `inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#F87171] bg-white px-4 text-[14px] font-semibold text-[#B91C1C] transition-colors hover:bg-[#FEF2F2] disabled:opacity-50 ${FOCUS}`;

/**
 * เอกสารการลา — one leave: the QF-HRD-001 form on a "paper" (scaled down to
 * the column on narrow screens) and the status panel. Printing uses the
 * browser's print dialog ("Save as PDF"), the same as the off-site form; a
 * second copy of the form is portalled to <body> and is the only thing that
 * prints (LEAVE_FORM_CSS).
 */
export default function LeaveDocumentView({ doc, onChanged }) {
  const f = doc.form;
  const amount = formatLeaveAmount(f.totalHours, { unit: f.unit, hoursPerDay: doc.hoursPerDay });
  const returnText = formatLeaveAmount(doc.cancelReturnHours, { hoursPerDay: doc.hoursPerDay });
  const chip = STATUS_CHIPS[doc.status] || { label: doc.status, bg: "#EEF2F7", color: "#475569" };
  const [cancelOpen, setCancelOpen] = useState(false);

  // Scale the paper to its column (no sideways scroll on phones).
  const boxRef = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const fit = () => setScale(Math.min(1, el.clientWidth / PAPER_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The print copy lives directly under <body>.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const print = () => {
    // File-name hint for "Save as PDF": the page title becomes the default name.
    const prev = document.title;
    document.title = `ใบลา ${doc.code}`;
    const restore = () => {
      document.title = prev;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  return (
    <div className="mx-auto max-w-[1180px]" data-testid="leave-document">
      <style>{LEAVE_FORM_CSS}</style>
      <div className="mb-4">
        <p className="text-[12px]" style={{ color: SLATE }}>
          <Link href="/dashboard/leave/document" className="hover:underline">การลา</Link> › เอกสารการลา
        </p>
        <h1 className="text-[20px] font-bold md:text-[22px]" style={{ color: NAVY }} data-testid="document-code">ใบลา #{doc.code}</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_296px] lg:items-start">
        {/* Paper */}
        <div ref={boxRef} className="order-2 min-w-0 lg:order-1">
          <div style={{ width: PAPER_W * scale, height: PAPER_H * scale }} className="mx-auto">
            <div
              style={{ width: PAPER_W, height: PAPER_H, transform: `scale(${scale})`, transformOrigin: "top left", border: `1px solid ${LINE}`, borderRadius: 4, boxShadow: "0 4px 18px rgba(13,27,42,0.10)", overflow: "hidden", background: "#fff" }}
            >
              <LeaveFormQF form={f} hoursPerDay={doc.hoursPerDay} />
            </div>
          </div>
        </div>

        {/* Panel */}
        <aside className="order-1 rounded-[18px] bg-white p-5 lg:order-2" style={{ border: `1px solid ${LINE}` }} data-testid="document-panel">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[16px] font-bold" style={{ color: NAVY }}>สถานะ</h2>
            <span className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: chip.bg, color: chip.color }} data-testid="document-status">{chip.label}</span>
          </div>

          <ol className="mt-4 space-y-3" data-testid="document-timeline">
            {doc.timeline.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5" data-tone={t.tone}>
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ background: t.tone === "returned" ? RED : GREEN }}>
                  {t.tone === "returned" ? <X size={14} color="#fff" strokeWidth={3} /> : <Check size={14} color="#fff" strokeWidth={3} />}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold" style={{ color: t.tone === "returned" ? RED : NAVY }}>{t.label}</p>
                  <p className="text-[12px]" style={{ color: SLATE }}>{[t.name, thaiDateTime(t.at)].filter(Boolean).join(" · ")}</p>
                  {t.note && <p className="mt-0.5 break-words text-[12px]" style={{ color: t.tone === "returned" ? RED : SLATE }}>“{t.note}”</p>}
                </div>
              </li>
            ))}
          </ol>

          <hr className="my-4" style={{ borderColor: LINE }} />

          <div className="space-y-2.5">
            <button type="button" onClick={print} className={`${BTN_PRIMARY} w-full`} data-testid="document-print">
              <Printer size={16} /> พิมพ์ / บันทึก PDF
            </button>
            {doc.canRequestCancel && (
              <button type="button" onClick={() => setCancelOpen(true)} className={BTN_REJECT} data-testid="document-cancel">
                <Undo2 size={16} /> ขอยกเลิกใบลา
              </button>
            )}
          </div>

          <p className="mt-4 text-[12px] leading-relaxed" style={{ color: MUTED }}>
            ขอยกเลิกได้เมื่ออนุมัติแล้ว — HR ต้องอนุมัติการยกเลิก แล้วระบบคืนวันลา · ก่อนอนุมัติ ผู้ขอยกเลิกเองได้ทันที
          </p>
          <p className="mt-2 text-[12px]" style={{ color: MUTED }}>ผู้ขอ ผู้อนุมัติ (1)/(2) และ HR เปิดดูใบลานี้ได้</p>
        </aside>
      </div>

      {cancelOpen && (
        <CancelRequestDialog
          leaveId={doc._id}
          summary={`${f.typeName} · ${thaiDateRange(f.startDate, f.endDate)} · ${amount}`}
          returnText={returnText}
          onClose={() => setCancelOpen(false)}
          onDone={onChanged}
        />
      )}

      {mounted &&
        createPortal(
          <div className="lf-print-portal" aria-hidden="true">
            <LeaveFormQF form={f} hoursPerDay={doc.hoursPerDay} testid="leave-form-print" />
          </div>,
          document.body
        )}
    </div>
  );
}
