// /account/password — change one's own password. Outside /dashboard on
// purpose: a user with a pending password change (temporary password) is
// sent here by the middleware and the server guards, and nothing else works
// until they finish.
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { RBAC_VERSION } from "@/lib/rbac/access";
import { CHANGE_PASSWORD_PATH } from "@/lib/passwordRules";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.rbac !== RBAC_VERSION) {
    redirect(`/login?callbackUrl=${encodeURIComponent(CHANGE_PASSWORD_PATH)}`);
  }
  return (
    <ChangePasswordForm
      forced={session.user.mustChangePassword === true}
      email={session.user.email ?? ""}
    />
  );
}
