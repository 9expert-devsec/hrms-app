"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import useVisibilityPoll from "../useVisibilityPoll";

/**
 * The one client source for "รอคุณดำเนินการ" (GET /api/inbox/count): the
 * top-bar bell, the dashboard card, the tab title and the sidebar badges all
 * read useInbox(). Fresh on load, on navigation, right after an action that
 * changes a count (refreshInbox(), called by the off-site / leave / OT
 * action handlers), and on the shared polling rule (useVisibilityPoll):
 * every 15 s while the tab is visible, at once on return / focus, backing
 * off after errors, stopping when signed out.
 */

const EMPTY = { total: 0, items: [], loaded: false };
const InboxContext = createContext({ ...EMPTY, refresh: () => {} });
const REFRESH_EVENT = "hrms:inbox:refresh";

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

  // "ok" | "error" | "stop" (signed out / no access) — the polling rule's outcome.
  const refresh = useCallback(async () => {
    if (inFlight.current) return "ok";
    inFlight.current = true;
    try {
      const res = await fetch("/api/inbox/count", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) return "stop";
      if (!res.ok) return "error";
      const j = await res.json();
      setState({ total: Number(j.total) || 0, items: Array.isArray(j.items) ? j.items : [], loaded: true });
      return "ok";
    } catch {
      return "error"; // keep the last known counts
    } finally {
      inFlight.current = false;
    }
  }, []);

  // On load and on every navigation.
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  // Every 15 s while visible, at once on return / focus (the shared rule); and on refreshInbox().
  useVisibilityPoll(refresh);
  useEffect(() => {
    const onRefresh = () => refresh();
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
  }, [refresh]);

  return <InboxContext.Provider value={{ ...state, refresh }}>{children}</InboxContext.Provider>;
}
