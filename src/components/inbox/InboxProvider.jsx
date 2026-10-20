"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * The one client source for "รอคุณดำเนินการ" (GET /api/inbox/count): the
 * top-bar bell, the dashboard card, the tab title and the sidebar badges all
 * read useInbox(). Fresh on load, on navigation, every 60 s while the tab is
 * visible, when the window regains focus, and right after an action that
 * changes a count (refreshInbox(), called by the off-site / leave / OT
 * action handlers).
 */

const EMPTY = { total: 0, items: [], loaded: false };
const InboxContext = createContext({ ...EMPTY, refresh: () => {} });
const REFRESH_EVENT = "hrms:inbox:refresh";
const POLL_MS = 60_000;

/** Ask the provider to re-count now (after accept / decline / approve / reject / reconfirm). */
export function refreshInbox() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(REFRESH_EVENT));
}

export function useInbox() {
  return useContext(InboxContext);
}

export default function InboxProvider({ children }) {
  const [state, setState] = useState(EMPTY);
  const pathname = usePathname();
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/inbox/count", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setState({ total: Number(j.total) || 0, items: Array.isArray(j.items) ? j.items : [], loaded: true });
      }
    } catch {
      // keep the last known counts
    } finally {
      inFlight.current = false;
    }
  }, []);

  // On load and on every navigation.
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  // Every 60 s while visible; on focus / becoming visible; on refreshInbox().
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(REFRESH_EVENT, refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(REFRESH_EVENT, refresh);
    };
  }, [refresh]);

  return <InboxContext.Provider value={{ ...state, refresh }}>{children}</InboxContext.Provider>;
}
