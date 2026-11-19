"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import useModalLayer from "../../../../../../components/useModalLayer";
import { FOCUS, LINE, NAVY, SLATE } from "../../../../../../components/hr/hrUi";

/**
 * Dialog shell for ตั้งค่าการลา: rendered on document.body (useModalLayer —
 * focus trap, scroll lock, focus return), Escape and the backdrop close it.
 */
// Open dialogs, innermost last: only the top one answers Escape.
const openStack = [];

export default function Dialog({ title, onClose, children, footer, testid, width = 480, z = 60 }) {
  const ref = useRef(null);
  const { portal, trapTab } = useModalLayer(ref);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape on the document, not the dialog: after a failed save the focused
  // button may have been disabled, which moves focus to <body>.
  useEffect(() => {
    const token = {};
    openStack.push(token);
    const onKey = (e) => {
      if (e.key !== "Escape" || openStack[openStack.length - 1] !== token) return;
      e.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      openStack.splice(openStack.indexOf(token), 1);
    };
  }, []);

  return portal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(13,27,42,0.6)", zIndex: z }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        // A nested dialog (e.g. the employee picker) is another portal but
        // still a React child: its key events bubble here — leave them alone.
        if (!e.currentTarget.contains(e.target)) return;
        if (e.key === "Tab") trapTab(e);
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex w-full flex-col rounded-[20px] bg-white p-5 md:p-6"
        style={{ maxWidth: width, maxHeight: "88vh", border: `1px solid ${LINE}`, boxShadow: "0 16px 48px rgba(13,27,42,0.2)" }}
        data-testid={testid}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-[17px] font-bold" style={{ color: NAVY }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="ปิด" className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] md:h-9 md:w-9 ${FOCUS}`} style={{ background: "#F5F8FF", color: SLATE }}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="mt-4 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
