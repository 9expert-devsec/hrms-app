"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Header from "./Header";

/**
 * ซ่อน Header เมื่อ:
 *  - มี session (authenticated)  หรือ
 *  - อยู่บนเส้นทาง protected (/dashboard หรือ /(protected))
 */
export default function HeaderGate() {
  const { status } = useSession();
  const pathname = usePathname();

  const inProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/(protected)");

  // กันการกะพริบขณะเช็คเซสชัน (optional)
  if (status === "loading") return null;

  if (status === "authenticated" || inProtected) {
    return null; // ✅ ซ่อน Header
  }

  return <Header />; // แสดงเฉพาะหน้า public
}
