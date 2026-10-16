/**
 * Bumped whenever the shape of the RBAC fields on the JWT changes. A token
 * without the current version predates RBAC (or an older shape): the
 * middleware sends its holder back to /login to sign in again, and the login
 * page shows the form instead of bouncing them to /dashboard.
 */
// 2: headOfDepartmentIds now come from Department.headOfDepartment only (HOD
//    single store) — everyone signs in again to pick them up.
export const RBAC_VERSION = 2;

/**
 * How old the permissions on a JWT may get before the jwt callback re-reads
 * the user's role from the DB (lib/rbac/sessionPerms.js). This is the
 * revocation window for server guards (requirePage / requirePageApi).
 */
export const ROLE_REFRESH_MS = 5 * 60 * 1000;

/**
 * SessionProvider poll interval (seconds). getServerSession cannot persist a
 * refreshed token (next-auth v4 in the App Router), so the browser's
 * /api/auth/session poll is what rewrites the cookie that the Edge
 * middleware and the sidebar read.
 */
export const SESSION_POLL_SECONDS = 60;
