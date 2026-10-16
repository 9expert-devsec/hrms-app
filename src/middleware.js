import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccessPath, RBAC_VERSION } from "@/lib/rbac/access";
import { CHANGE_PASSWORD_PATH } from "@/lib/passwordRules";

/**
 * Runs on every /dashboard request (it never ran from src/app/).
 * Reads isSuperadmin / pages / headOfDepartmentIds straight off the JWT —
 * authOptions puts them there at sign-in.
 *   - no token, or a token from before RBAC → /login?callbackUrl=…
 *   - password change pending (temporary password) → the change-password page
 *   - path not allowed (unregistered paths are superadmin-only) → /403
 * The server guards repeat the same checks (lib/rbac/guard.js).
 */
export async function middleware(req) {
  const { pathname, search } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || token.rbac !== RBAC_VERSION) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
  }

  if (token.mustChangePassword === true) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, req.url));
  }

  if (!canAccessPath(token, pathname)) {
    return NextResponse.redirect(new URL("/403", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
