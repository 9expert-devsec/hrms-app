// src/app/(protected)/layout.jsx
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import dbConnect from "@/lib/mongoose";
import { employeeOfUser } from "@/lib/rbac/scopeQueries";
import Sidebar from "./../../components/Sidebar";
import Topbar from "./../../components/Topbar";
import SelfServiceGate from "./../../components/SelfServiceGate";
import NavTracker from "./../../components/NavTracker";
import InboxProvider from "./../../components/inbox/InboxProvider";
import InboxTitle from "./../../components/inbox/InboxTitle";

export default async function ProtectedLayout({ children }) {
  // Is this account linked to an employee? (Employee.userId — read from the
  // DB, not the token, so a link or unlink shows on the next page load.)
  const session = await getServerSession(authOptions);
  let linked = true;
  if (session?.user?.id) {
    await dbConnect();
    linked = !!(await employeeOfUser(session.user.id, "_id"));
  }

  return (
    // One shared "รอคุณดำเนินการ" count for the sidebar badges, the top-bar bell and the pages.
    <InboxProvider>
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100dvh",
        overflow: "hidden",
        background: "#F8FAFD",
        color: "#0D1B2A",
      }}
    >
      <NavTracker />
      <InboxTitle />
      <Sidebar />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Topbar />
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "24px" }}>
          <Suspense fallback={null}>
            <SelfServiceGate linked={linked}>{children}</SelfServiceGate>
          </Suspense>
        </main>
      </div>
    </div>
    </InboxProvider>
  );
}
