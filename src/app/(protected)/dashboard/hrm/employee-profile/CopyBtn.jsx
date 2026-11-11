"use client";

import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";

/** "คัดลอก" pill: copies `text`, reads "คัดลอกแล้ว" for 2 s (announced politely). */
export default function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      data-testid="profile-copy-phone"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[13px] font-medium transition-colors hover:bg-[#F5F8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005CFF]"
      style={{ border: "1px solid #D6E0F0", color: "#005CFF" }}
    >
      <Copy size={14} aria-hidden />
      <span aria-live="polite">{copied ? "คัดลอกแล้ว" : "คัดลอก"}</span>
    </button>
  );
}
