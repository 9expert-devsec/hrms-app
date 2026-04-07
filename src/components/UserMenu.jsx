"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  ChevronDown, User as UserIcon, MessageSquare, Inbox,
  UserPlus, LogOut
} from "lucide-react";


export default function UserMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const avatar = user?.photoUrl || "/avatar-default.png";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-black/5 transition-colors duration-150"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="ml-auto relative h-9 w-9 rounded-full overflow-hidden ring-2 ring-[#005CFF]/20">
          <Image src={avatar} alt="avatar" fill sizes="36px" className="object-cover" />
        </div>
        <div className="hidden md:flex flex-col items-start leading-tight">
          <span className="text-sm font-medium text-[#0D1B2A] truncate max-w-[140px]">
            {user?.name || "User"}
          </span>
          <span className="text-xs text-emerald-600 font-medium">online</span>
        </div>
        <ChevronDown size={18} className="text-[#808A95]" />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            background: "#FFFFFF",
            border: "1px solid rgba(0,92,255,0.10)",
            boxShadow: "0 8px 24px rgba(13,27,42,0.12)",
          }}
          className="absolute right-0 mt-2 w-60 rounded-xl p-1 z-50"
        >
          <MenuItem href="/dashboard/hrm/employee-profile" icon={<UserIcon size={16} />} label="Profile" onClick={() => setOpen(false)} />
          <MenuItem href="/dashboard/chat"    icon={<MessageSquare size={16} />} label="Chat"    onClick={() => setOpen(false)} />
          <MenuItem href="/dashboard/inbox"   icon={<Inbox size={16} />} label="Inbox"          onClick={() => setOpen(false)} />
          {["superadmin", "hr"].includes(user?.role) && (
            <MenuItem href="/dashboard/admin/register" icon={<UserPlus size={16} />} label="Add Account" onClick={() => setOpen(false)} />
          )}
          <hr className="my-1" style={{ borderColor: "rgba(0,92,255,0.08)" }} />
          <button
            onClick={() => signOut({ callbackUrl: "/login" , redirect: true })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors duration-150"
            style={{ color: "#DC2626" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
            role="menuitem"
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({ href, icon, label, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 rounded-lg no-underline transition-colors duration-150"
      style={{ color: "#0D1B2A" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#F8FAFD";
        e.currentTarget.style.color = "#005CFF";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "#0D1B2A";
      }}
      role="menuitem"
    >
      <span style={{ color: "#808A95" }}>{icon}</span> <span>{label}</span>
    </Link>
  );
}
