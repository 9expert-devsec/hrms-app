"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Remembers, per browser tab (sessionStorage), that this tab has moved
 * between app pages — so a "กลับ" button knows the previous history entry is
 * an app page and not a new-tab page or another site. Set on any in-app
 * navigation, or on a full page load coming from this origin.
 */
export const IN_APP_NAV_KEY = "hrms:in-app-nav";

export function hasInAppHistory() {
  try {
    return window.history.length > 1 && window.sessionStorage.getItem(IN_APP_NAV_KEY) === "1";
  } catch {
    return false;
  }
}

export default function NavTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    try {
      if (first.current) {
        first.current = false;
        const ref = document.referrer;
        if (ref && new URL(ref).origin === window.location.origin) window.sessionStorage.setItem(IN_APP_NAV_KEY, "1");
        return;
      }
      window.sessionStorage.setItem(IN_APP_NAV_KEY, "1");
    } catch {
      // storage blocked: the back button falls back to /dashboard
    }
  }, [pathname]);
  return null;
}
