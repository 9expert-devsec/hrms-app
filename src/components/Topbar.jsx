// src/components/Topbar.jsx
// Server Component: reads the signed-in person's employee record once (photo
// for the profile control, name / department for the phone drawer).

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import UserMenu from "./UserMenu";
import InboxBell from "./inbox/InboxBell";
import MobileNav from "./MobileNav";
import TopbarTitle from "./TopbarTitle";
import dbConnect from "@/lib/mongoose";
import { employeeOfUser } from "@/lib/rbac/scopeQueries";
import Department from "@/models/Department";
import { normalizePhotoCrop } from "@/lib/photoCrop";

export default async function Topbar() {
  const session = await getServerSession(authOptions);

  // The linked employee (Employee.userId), never an email match.
  let emp = null;
  let departmentName = "";
  if (session?.user?.id) {
    await dbConnect();
    emp = await employeeOfUser(session.user.id, "photoUrl photoCrop firstNameTh lastNameTh department departmentId");
    if (emp?.departmentId) {
      const dept = await Department.findById(emp.departmentId).select("name").lean();
      departmentName = dept?.name || "";
    }
    departmentName = departmentName || emp?.department || "";
  }
  const livePhoto = emp?.photoUrl || null;
  const thaiName = [emp?.firstNameTh, emp?.lastNameTh].filter(Boolean).join(" ");
  const account = {
    name: thaiName || session?.user?.name || "",
    department: departmentName,
    photoUrl: session?.user?.id ? livePhoto : session?.user?.photoUrl,
    // The chosen frame goes with the live photo only.
    photoCrop: livePhoto ? normalizePhotoCrop(emp?.photoCrop) : null,
  };

  return (
    <header
      className="sticky top-0 z-40 flex h-16 items-center gap-3 px-4 md:px-6"
      style={{
        background: "#FFFFFF",
        borderBottom: "1px solid rgba(0,92,255,0.08)",
        boxShadow: "0 1px 4px rgba(13,27,42,0.06)",
      }}
    >
      {/* Phones: ☰ opens the sidebar as a drawer (the rail is hidden below 768 px). */}
      <MobileNav account={account} />

      {/* Section name over the page title, from the menu. */}
      <TopbarTitle />

      {/* "รอคุณดำเนินการ" bell, then the profile control (desktop / tablet; phones use the drawer). */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <InboxBell />
        <div className="hidden md:block">
          <UserMenu
            user={{
              ...session.user,
              photoUrl: account.photoUrl,
              photoCrop: account.photoCrop,
            }}
          />
        </div>
      </div>
    </header>
  );
}
