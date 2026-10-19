"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { canOpenPage } from "@/lib/rbac/access";

/**
 * Counts shown next to menu links (menuConfig `badgeKey`). There is no
 * notification store: each count is a small API read, refreshed on
 * navigation. Today only `offsite_invites` (off-site invitations plus
 * approvals waiting for me; the key name predates the approvals).
 */
export default function useMenuBadges(user) {
  const pathname = usePathname();
  const [badges, setBadges] = useState({});
  const canOffsite = canOpenPage(user, "offsite_self");

  useEffect(() => {
    if (!canOffsite) return;
    let alive = true;
    fetch("/api/offsite/count", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        // Invitations + approvals waiting for me.
        if (alive && j) setBadges((b) => ({ ...b, offsite_invites: (j.invites || 0) + (j.approvals || 0) }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [canOffsite, pathname]);

  return badges;
}
