// Server Component — signed-in users skip the form.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

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
