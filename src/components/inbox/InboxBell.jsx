"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { useInbox } from "./InboxProvider";

const NAVY = "#0D1B2A";
const SLATE = "#5E6A7E";

/** Badge text: hidden at 0 (callers check), "99+" above 99. */
export function inboxBadgeText(n) {
  return n > 99 ? "99+" : String(n);
}

/** The grouped "รอคุณดำเนินการ" links (bell dropdown and dashboard card). */
export function InboxLinks({ items, onNavigate }) {
  return (
    <ul>
      {items.map((it, i) => (
        <li key={it.key} style={i > 0 ? { borderTop: "1px solid rgba(0,92,255,0.08)" } : undefined}>
          <Link
            href={it.href}
            onClick={onNavigate}
            className="flex items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-slate-50"
            data-testid={`inbox-item-${it.key}`}
          >
            <span className="flex-1 text-sm" style={{ color: NAVY }}>
              {it.label}
            </span>
            <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: "#FEE2E2", color: "#B91C1C" }}>
              {it.count}
            </span>
            <ChevronRight size={16} style={{ color: SLATE }} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Top-bar bell: red count (hidden at 0, "99+" cap) and a "รอคุณดำเนินการ"
 * dropdown grouped by type. The panel is fixed under the top bar at the right
 * edge, so it fits on a phone too.
 */
export default function InboxBell() {
  const { total, items } = useInbox();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={total > 0 ? `รอคุณดำเนินการ ${total} รายการ` : "รอคุณดำเนินการ"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150 hover:bg-black/5"
        data-testid="inbox-bell"
      >
        <Bell size={20} style={{ color: NAVY }} aria-hidden="true" />
        {total > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ring-2 ring-white"
            data-testid="inbox-badge"
          >
            {inboxBadgeText(total)}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="รอคุณดำเนินการ"
          className="overflow-hidden rounded-2xl"
          style={{
            position: "fixed",
            top: 64,
            right: 16,
            zIndex: 50,
            width: "min(360px, calc(100vw - 32px))",
            background: "#FFFFFF",
            border: "1px solid rgba(0,92,255,0.12)",
            boxShadow: "0 12px 32px rgba(13,27,42,0.16)",
          }}
          data-testid="inbox-dropdown"
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(0,92,255,0.08)" }}>
            <span style={{ color: NAVY, fontWeight: 700, fontSize: 15 }}>รอคุณดำเนินการ</span>
            {total > 0 && <span style={{ color: SLATE, fontSize: 12 }}>{total} รายการ</span>}
          </div>
          {items.length ? (
            <InboxLinks items={items} onNavigate={() => setOpen(false)} />
          ) : (
            <p className="px-4 py-6 text-center text-sm" style={{ color: SLATE }} data-testid="inbox-empty">
              ไม่มีรายการที่รอคุณ
            </p>
          )}
        </div>
      )}
    </div>
  );
}
