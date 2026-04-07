"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, LogOut, LogIn, User } from "lucide-react";
import { useSession, signOut, signIn } from "next-auth/react";

export default function MobileSidebar({ open, onClose }) {
  const { data, status } = useSession();
  const user = data?.user;

  // ล็อก scroll เมื่อเมนูเปิด
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => (document.body.style.overflow = "");
  }, [open]);

  // ปิดเมื่อกด ESC
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 z-50 h-dvh w-72 max-w-[80%] bg-[#0F172B] border-l border-white/10 shadow-2xl md:hidden
        transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        {/* Header in panel */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          <span className="text-lg font-semibold text-slate-100">Menu</span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-300"
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>

        {/* User section */}
        <div className="px-3 py-3 border-b border-white/10">
          {status === "authenticated" ? (
            <div className="flex items-center gap-3">
              {/* Avatar */}
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name || "User avatar"}
                  width={40}
                  height={40}
                  className="rounded-lg object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-white/5 grid place-items-center">
                  <User size={18} className="text-slate-300" />
                </div>
              )}

              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-slate-300 text-sm">You are not signed in.</p>
              <button
                onClick={() => signIn(undefined, { callbackUrl: "/dashboard" })}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors"
              >
                <LogIn size={16} />
                Sign in
              </button>
            </div>
          )}
        </div>

        {/* Links */}
        <nav className="p-3">
          <ul className="flex flex-col gap-1 text-slate-200">
            <li>
              <Link
                href="/login"
                onClick={onClose}
                className="block rounded-lg px-3 py-2 hover:bg-white/5 hover:text-indigo-300"
              >
                Login
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard"
                onClick={onClose}
                className="block rounded-lg px-3 py-2 hover:bg-white/5 hover:text-indigo-300"
              >
                Dashboard
              </Link>
            </li>

            {/* Example group */}
            <li className="mt-2 px-3 pt-3 text-xs uppercase tracking-wider text-slate-400/80 border-t border-white/10">
              HRM
            </li>
            <li>
              <Link
                href="/dashboard/hrm/employee"
                onClick={onClose}
                className="block rounded-lg px-3 py-2 hover:bg-white/5 hover:text-indigo-300"
              >
                Employee
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/hrm/employee-profile"
                onClick={onClose}
                className="block rounded-lg px-3 py-2 hover:bg-white/5 hover:text-indigo-300"
              >
                Employee Profile
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/hrm/attendance"
                onClick={onClose}
                className="block rounded-lg px-3 py-2 hover:bg-white/5 hover:text-indigo-300"
              >
                Attendance
              </Link>
            </li>

            <li className="mt-2 px-3 pt-3 text-xs uppercase tracking-wider text-slate-400/80 border-t border-white/10">
              System
            </li>
            <li>
              <Link
                href="/dashboard/settings"
                onClick={onClose}
                className="block rounded-lg px-3 py-2 hover:bg-white/5 hover:text-indigo-300"
              >
                Settings
              </Link>
            </li>
          </ul>
        </nav>

        {/* Footer (Sign out when authenticated) */}
        <div className="mt-auto p-3 border-t border-white/10">
          {status === "authenticated" ? (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-sm font-medium text-slate-100 transition-colors"
            >
              <LogOut size={16} />
              Sign out
            </button>
          ) : (
            <p className="text-xs text-slate-400 text-center">
              © {new Date().getFullYear()} 9Expert · Internal
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
