"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { SidebarPanel } from "./Sidebar";

const DESKTOP = "(min-width: 768px)";

/** Lock the page while the drawer is open (the app shell scrolls its <main>, not the window). */
function lockScroll() {
  const saved = [document.body, ...document.querySelectorAll("main")]
    .filter((el) => el === document.body || ["auto", "scroll"].includes(getComputedStyle(el).overflowY))
    .map((el) => ({ el, overflowY: el.style.overflowY, top: el.scrollTop }));
  for (const s of saved) s.el.style.overflowY = "hidden";
  return () => {
    for (const s of saved) {
      s.el.style.overflowY = s.overflowY;
      s.el.scrollTop = s.top;
    }
  };
}

/**
 * Below 768 px the sidebar is hidden; this ☰ button (left of the top bar)
 * opens the same sidebar — same items, same RBAC filtering — as a left
 * drawer. It closes after a link navigates, on the overlay, on Escape and on
 * ✕; focus moves into the drawer and back to the button; the page behind
 * does not scroll.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  const close = useCallback(() => setOpen(false), []);

  // A link tap closes the drawer once the new page is in place.
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const unlock = lockScroll();
    panelRef.current?.querySelector("[data-drawer-close]")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Keep focus inside the drawer.
      const items = [...panelRef.current.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const mq = window.matchMedia(DESKTOP);
    const onMq = () => mq.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    const button = buttonRef.current;
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      button?.focus();
    };
  }, [open]);

  // A link to the page already shown navigates nowhere: close at once.
  const onNavigate = (href) => {
    if (href === pathname) setOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        // display comes from the classes (an inline `display` would beat md:hidden and show ☰ on desktop)
        className="grid place-items-center md:hidden"
        aria-label="เมนู"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        onClick={() => setOpen(true)}
        data-testid="mobile-nav-button"
        style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 10, border: "1px solid rgba(0,92,255,0.12)", background: "#FFFFFF", color: "#0D1B2A" }}
      >
        <Menu size={22} aria-hidden />
      </button>
      {open &&
        createPortal(
          <div className="md:hidden" style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
            <div onClick={close} data-testid="mobile-nav-overlay" style={{ position: "absolute", inset: 0, background: "rgba(13,27,42,0.45)" }} />
            <div
              ref={panelRef}
              id="mobile-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="เมนู"
              data-testid="mobile-nav-drawer"
              style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 280, maxWidth: "85vw", boxShadow: "8px 0 32px rgba(0,0,0,0.25)", overscrollBehavior: "contain" }}
            >
              <SidebarPanel variant="drawer" onClose={close} onNavigate={onNavigate} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
