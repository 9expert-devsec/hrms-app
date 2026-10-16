"use client";

import { SessionProvider } from "next-auth/react";
import { SESSION_POLL_SECONDS } from "@/lib/rbac/version";

// The poll (and refetch on window focus) is what persists a refreshed JWT:
// /api/auth/session runs the jwt callback AND rewrites the cookie, which the
// Edge middleware and the sidebar read. See lib/rbac/sessionPerms.js.
export default function Providers({ children }) {
  return (
    <SessionProvider refetchInterval={SESSION_POLL_SECONDS} refetchOnWindowFocus>
      {children}
    </SessionProvider>
  );
}
