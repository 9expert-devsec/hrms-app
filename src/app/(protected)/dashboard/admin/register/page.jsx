import { requireSuperadminPage } from "@/lib/rbac/guard";
import AdminRegisterForm from "./AdminRegisterForm";

export default async function AdminRegisterPage() {
  // Not in the registry (orphan page): superadmin only.
  await requireSuperadminPage();
  return <AdminRegisterForm />;
}
