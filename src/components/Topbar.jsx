// src/app/components/Topbar.jsx
// Server Component — ไม่มี event handlers (onFocus/onBlur ใช้ CSS แทน)

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import UserMenu from "./UserMenu";
import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";

const session = await getServerSession(authOptions);
let livePhoto = null;
if (session?.user?.email) {
  await dbConnect();
  const emp = await Employee.findOne({ email: session.user.email })
    .select("photoUrl")
    .lean();
  livePhoto = emp?.photoUrl || null;
}

export default async function Topbar() {
  const session = await getServerSession(authOptions);

  return (
    <>
      {/* Inject focus style via <style> tag — no JS needed */}
      <style>{`
        .topbar-search:focus {
          border-color: #005CFF !important;
          box-shadow: 0 0 0 3px rgba(0,92,255,0.12) !important;
          outline: none;
        }
      `}</style>

      <header
        className="sticky top-0 z-40 h-16 flex items-center gap-4 px-4"
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid rgba(0,92,255,0.08)",
          boxShadow: "0 1px 4px rgba(13,27,42,0.06)",
        }}
      >
        {/* Search */}
        <div className="flex-1 max-w-xl">
          <input
            placeholder="Search here…"
            className="topbar-search"
            style={{
              width: "100%",
              height: "38px",
              borderRadius: "10px",
              background: "#F8FAFD",
              border: "1px solid rgba(0,92,255,0.12)",
              padding: "0 1rem",
              fontSize: "13px",
              color: "#0D1B2A",
              outline: "none",
              transition: "border-color 200ms ease, box-shadow 200ms ease",
            }}
          />
        </div>

        {/* User menu (ครบเดิม) */}
        <div className="ml-auto">
          <UserMenu
            user={{
              ...session.user,
              photoUrl: livePhoto || session.user.photoUrl,
            }}
          />
        </div>
      </header>
    </>
  );
}
