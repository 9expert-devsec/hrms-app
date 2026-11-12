"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Shared modal plumbing for dialogs that may be opened from inside a card the
 * global hover-lift rule transforms (globals.css: section.rounded-2xl.border
 * :hover). A transformed ancestor becomes the containing block of a fixed
 * overlay and traps it under later content, so the dialog is rendered on
 * document.body instead.
 *
 * While the dialog is mounted: the page behind does not scroll (window and the
 * app shell's <main>); on unmount focus returns to the control that opened it.
 *
 *   const dialogRef = useRef(null);
 *   const { portal, trapTab } = useModalLayer(dialogRef);
 *   return portal(<div onKeyDown={(e) => e.key === "Tab" && trapTab(e)}>…<div ref={dialogRef} role="dialog">…);
 */
export default function useModalLayer(dialogRef) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const opener = document.activeElement;
    const main = document.querySelector("main main");
    const prev = { body: document.body.style.overflow, main: main?.style.overflowY };
    document.body.style.overflow = "hidden";
    if (main) main.style.overflowY = "hidden";
    return () => {
      document.body.style.overflow = prev.body;
      if (main) main.style.overflowY = prev.main;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  /** Tab / Shift+Tab stay inside the dialog. */
  const trapTab = useCallback(
    (e) => {
      const root = dialogRef.current;
      const items = [...(root?.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]') || [])];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = root.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    },
    [dialogRef]
  );

  const portal = (node) => (mounted ? createPortal(node, document.body) : null);
  return { mounted, portal, trapTab };
}
