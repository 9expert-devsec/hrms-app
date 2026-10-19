"use client";

import { Printer } from "lucide-react";

/** "พิมพ์ / บันทึกเป็น PDF": the browser's print dialog (choose "Save as PDF"). */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
      style={{ background: "linear-gradient(135deg, #005CFF, #2486FF)", color: "#FFFFFF" }}
    >
      <Printer size={14} /> พิมพ์ / บันทึกเป็น PDF
    </button>
  );
}
