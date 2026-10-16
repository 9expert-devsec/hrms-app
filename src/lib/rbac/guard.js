import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";
import { getPage } from "@/lib/rbac/pages";
import { canOpenPage, RBAC_VERSION } from "@/lib/rbac/access";
import { CHANGE_PASSWORD_PATH } from "@/lib/passwordRules";

/**
 * Server-side guards. Pure predicates live in access.js.
 * A session from before RBAC (no current version) counts as signed out.
 */

function isCurrent(session) {
  return !!session?.user && session.user.rbac === RBAC_VERSION;
}

/** After a temporary-password reset, nothing works until the user changes it. */
export function mustChangePassword(session) {
  return session?.user?.mustChangePassword === true;
}

/** The 403 every guarded API returns while a password change is pending. */
export function passwordChangeRequiredResponse() {
  return NextResponse.json(
    { error: "ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน", mustChangePassword: true },
    { status: 403 }
  );
}

/**
 * Server Component guard. Signed out → /login (back to this page after);
 * password change pending → the change-password page; forbidden → /403.
 * Returns the session. `pageKey` null = superadmin only.
 */
export async function requirePage(pageKey) {
  const session = await getServerSession(authOptions);
  if (!isCurrent(session)) {
    const href = pageKey ? getPage(pageKey)?.href : null;
    redirect(href ? `/login?callbackUrl=${encodeURIComponent(href)}` : "/login");
  }
  if (mustChangePassword(session)) redirect(CHANGE_PASSWORD_PATH);
  if (!canOpenPage(session.user, pageKey)) redirect("/403");
  return session;
}

/** For pages that have no registry key (deny by default). */
export function requireSuperadminPage() {
  return requirePage(null);
}

/**
 * Route-handler guards. Same shape as requireSessionAPI in lib/authz.js:
 * `{ session }` when allowed, `{ res }` (401/403 JSON) otherwise.
 */
export async function requireAnyPageApi(pageKeys = []) {
  const session = await getServerSession(authOptions);
  if (!isCurrent(session)) {
    return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (mustChangePassword(session)) return { res: passwordChangeRequiredResponse() };
  if (!pageKeys.some((key) => canOpenPage(session.user, key))) {
    return { res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export function requirePageApi(pageKey) {
  return requireAnyPageApi([pageKey]);
}

/** Route-handler guard for superadmin-only endpoints (no registry key). */
export function requireSuperadminApi() {
  return requireAnyPageApi([null]);
}

/**
 * The ONE guard that lets a pending password change through: any signed-in
 * user with a current session (POST /api/account/password only).
 */
export async function requirePasswordChangeApi() {
  const session = await getServerSession(authOptions);
  if (!isCurrent(session)) {
    return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}
