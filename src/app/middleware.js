import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// กำหนด path prefix -> roles ที่อนุญาต
const ROLE_MAP = [
  { prefix: "/dashboard/hrm", roles: ["superadmin", "hr", "manager"] },
  { prefix: "/dashboard/payroll", roles: ["superadmin", "payroll"] },
  { prefix: "/dashboard/it", roles: ["superadmin", "it"] },
  // เพิ่มได้เรื่อย ๆ
];

function requiredRolesForPath(pathname) {
  for (const r of ROLE_MAP) {
    if (pathname.startsWith(r.prefix)) return r.roles;
  }
  return null; // ไม่ได้กำหนด = อนุญาตตามปกติ (แค่ต้องล็อกอิน)
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req });
  const isAuth = !!token;

  // ปกป้องเส้นทางภายใน
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/(protected)");
  if (isProtected && !isAuth) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // เช็คสิทธิ์ตาม ROLE_MAP
  if (isAuth) {
    const required = requiredRolesForPath(pathname);
    if (required && !required.includes(token.role)) {
      // ไม่มีสิทธิ์ → ไปหน้า 403
      return NextResponse.redirect(new URL("/403", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // อย่าจับ /api/auth, _next, static
  matcher: ["/dashboard/:path*", "/(protected)/:path*"],
};
