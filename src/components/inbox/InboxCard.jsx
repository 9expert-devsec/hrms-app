"use client";

import { BellRing } from "lucide-react";
import { useInbox } from "./InboxProvider";
import { InboxLinks } from "./InboxBell";

/** Dashboard: "มี N รายการรอคุณดำเนินการ" with the grouped links — only when N > 0. */
export default function InboxCard() {
  const { total, items } = useInbox();
  if (total <= 0) return null;
  return (
    <section
      className="overflow-hidden rounded-2xl"
      style={{ background: "#FFFFFF", border: "2px solid #005CFF", boxShadow: "0 4px 16px rgba(0,92,255,0.12)" }}
      data-testid="inbox-card"
    >
      <div className="flex items-center gap-3 px-5 py-4" style={{ background: "rgba(0,92,255,0.06)" }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#005CFF", color: "#FFFFFF" }}>
          <BellRing size={18} aria-hidden="true" />
        </span>
        <h2 style={{ color: "#0D1B2A", fontSize: 17, fontWeight: 700 }}>มี {total} รายการรอคุณดำเนินการ</h2>
      </div>
      <InboxLinks items={items} />
    </section>
  );
}
