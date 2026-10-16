import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { RBAC_VERSION } from "@/lib/rbac/version";
import { mustChangePassword, passwordChangeRequiredResponse } from "@/lib/rbac/guard";

// ------- PAGE HELPERS -------
export async function requireSessionPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return session;
}

export async function requireRolePage(roles = []) {
  const session = await requireSessionPage();
  if (roles.length && !roles.includes(session.user?.role)) redirect("/403");
  return session;
}

// ------- API HELPERS -------
// ชื่อใหม่
// AUTH-ONLY routes use this. Like the registry guards (lib/rbac/guard.js) it
// treats a pre-RBAC or revoked token (suspended / deleted user) as signed
// out, and refuses everything while a password change is pending.
export async function requireSessionAPI() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.rbac !== RBAC_VERSION)
    return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (mustChangePassword(session)) return { res: passwordChangeRequiredResponse() };
  return { session };
}
export async function requireRoleAPI(roles = []) {
  const gate = await requireSessionAPI();
  if (gate.res) return gate;
  const { session } = gate;
  if (roles.length && !roles.includes(session.user?.role))
    return { res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

// ------- alias เพื่อไม่ให้ route เดิมพัง -------
export const requireSessionApi = requireSessionAPI;
export const requireRoleApi = requireRoleAPI;
