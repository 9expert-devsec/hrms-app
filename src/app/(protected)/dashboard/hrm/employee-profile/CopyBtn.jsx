"use client";

import { useState } from "react";

export default function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1000);
        } catch {}
      }}
      className="text-xs rounded-md px-2 py-1 ring-1 ring-white/10 bg-white/5 hover:bg-white/10 text-slate-300"
      aria-label="Copy to clipboard"
      title="คัดลอก"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
