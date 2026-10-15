// Server Component — signed-in users skip the form.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { RBAC_VERSION } from "@/lib/rbac/access";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  // A session from before RBAC must sign in again (the middleware sends it
  // here); bouncing it to /dashboard would loop.
  if (session?.user?.rbac === RBAC_VERSION) redirect("/dashboard");

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-9e-ice">
          <p className="text-sm text-[var(--text-muted)]">กำลังโหลด...</p>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
