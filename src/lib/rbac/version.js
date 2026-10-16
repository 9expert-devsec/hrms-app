/**
 * Bumped whenever the shape of the RBAC fields on the JWT changes. A token
 * without the current version predates RBAC (or an older shape): the
 * middleware sends its holder back to /login to sign in again, and the login
 * page shows the form instead of bouncing them to /dashboard.
 */
// 2: headOfDepartmentIds now come from Department.headOfDepartment only (HOD
//    single store) — everyone signs in again to pick them up.
export const RBAC_VERSION = 2;
