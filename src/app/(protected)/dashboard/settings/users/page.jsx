// /dashboard/settings/users — ผู้ใช้ (registry key users_manage).
import dbConnect from "@/lib/mongoose";
import { requirePage } from "@/lib/rbac/guard";
import { listUsers } from "@/lib/accounts";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await requirePage("users_manage");
  await dbConnect();
  const data = await listUsers();

  return (
    <UsersClient
      initial={JSON.parse(JSON.stringify(data))}
      actor={{ id: session.user.id, isSuperadmin: session.user.isSuperadmin === true }}
    />
  );
}
