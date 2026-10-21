"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { PRINT_READY_EVENT } from "./PrintFit";

/**
 * "พิมพ์ / บันทึกเป็น PDF": the browser's print dialog (choose "Save as PDF").
 * Disabled until PrintFit has prepared the signatures, loaded the fonts and
 * fitted the values (data-print-ready on .pf-doc).
 */
export default function PrintButton() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onReady = () => setReady(true);
    if (document.querySelector('.pf-doc[data-print-ready="true"]')) onReady();
    window.addEventListener(PRINT_READY_EVENT, onReady);
    return () => window.removeEventListener(PRINT_READY_EVENT, onReady);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      disabled={!ready}
      aria-busy={!ready}
      title={ready ? undefined : "กำลังเตรียมเอกสาร…"}
      className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
      style={{
        background: "linear-gradient(135deg, #005CFF, #2486FF)",
        color: "#FFFFFF",
        opacity: ready ? 1 : 0.55,
        cursor: ready ? "pointer" : "wait",
      }}
    >
      <Printer size={14} /> พิมพ์ / บันทึกเป็น PDF
    </button>
  );
}
