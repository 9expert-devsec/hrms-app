"use client";

import { useInbox } from "./inbox/InboxProvider";

/**
 * Counts shown next to menu links (menuConfig `badgeKey`), read from the
 * shared inbox hook (GET /api/inbox/count) instead of a fetch of their own.
 * Today only `offsite_invites` (off-site invitations plus approvals waiting
 * for me; the key name predates the approvals).
 */
export default function useMenuBadges() {
  const { items } = useInbox();
  const countOf = (key) => items.find((i) => i.key === key)?.count || 0;
  return { offsite_invites: countOf("offsite_invites") + countOf("offsite_approvals") };
}
