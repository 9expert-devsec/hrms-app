"use client";

import { useEffect } from "react";
import { useInbox } from "./InboxProvider";
import { inboxBadgeText } from "./InboxBell";

const PREFIX = /^\(\d+\+?\)\s/;

/**
 * Browser tab title prefix while something waits: "(3) 9Expert HRMS".
 * Next rewrites <title> on navigation, so the prefix is re-applied whenever
 * the title changes. Renders nothing.
 */
export default function InboxTitle() {
  const { total } = useInbox();
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(PREFIX, "");
      const want = total > 0 ? `(${inboxBadgeText(total)}) ${base}` : base;
      if (document.title !== want) document.title = want;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = document.title.replace(PREFIX, "");
    };
  }, [total]);
  return null;
}
