"use client";

import { useState } from "react";
import { Info, Loader2 } from "lucide-react";
import Dialog from "../../app/(protected)/dashboard/leave/settings/ui/Dialog";
import { BTN_PRIMARY, BTN_SECONDARY, LINE, NAVY, SLATE } from "../hr/hrUi";

const RED = "#B91C1C";

/**
 * ขอยกเลิกใบลา — the owner asks to cancel an APPROVED leave (POST
 * /api/leave/[id]/cancel-request); an HR signer decides. Used by เอกสารการลา
 * and ประวัติการลา. `summary`: "<type> · <dates> · <amount>"; `returnText`:
 * the amount that comes back ("2 วัน").
 */
export default function CancelRequestDialog({ leaveId, summary, returnText, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason.trim()) {
      setError("กรุณาระบุเหตุผลที่ขอยกเลิก");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/leave/${leaveId}/cancel-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) throw new Error(j.message || "ส่งคำขอไม่สำเร็จ");
      await onDone?.();
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="ขอยกเลิกใบลา"
      onClose={busy ? () => {} : onClose}
      testid="cancel-dialog"
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={busy}>ปิด</button>
          <button type="button" className={BTN_PRIMARY} onClick={submit} disabled={busy} data-testid="cancel-submit">
            {busy && <Loader2 size={16} className="animate-spin" />} ส่งคำขอยกเลิก
          </button>
        </>
      }
    >
      <p className="-mt-2 text-[14px]" style={{ color: SLATE }}>{summary}</p>
      <p className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px]" style={{ background: "#EFF6FF", color: "#1D4ED8" }}>
        <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
        ใบลานี้อนุมัติแล้ว — การยกเลิกต้องให้ฝ่ายบุคคลอนุมัติ เมื่ออนุมัติแล้วระบบจะคืนวันลา {returnText}
      </p>
      <label htmlFor="cancel-reason" className="mt-4 block text-[14px] font-semibold" style={{ color: NAVY }}>
        เหตุผลที่ขอยกเลิก <span style={{ color: RED }}>*</span>
      </label>
      <textarea
        id="cancel-reason"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          if (e.target.value.trim()) setError("");
        }}
        rows={3}
        maxLength={1000}
        placeholder="เช่น ธุระเลื่อนออกไป"
        className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-[14px] outline-none placeholder:text-[#8592A6] focus:ring-2 focus:ring-[#005CFF]/30"
        style={{ borderColor: error ? "#F87171" : LINE, color: NAVY }}
        data-testid="cancel-reason"
      />
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] font-medium" style={{ color: RED }} data-testid="cancel-error">{error}</p>
      )}
    </Dialog>
  );
}
