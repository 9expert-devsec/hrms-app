"use client";

import { Fragment, useEffect, useMemo } from "react";
import Link from "next/link";
import Avatar from "./Avatar";
import { X, LogOut, LogIn, User } from "lucide-react";
import { useSession, signOut, signIn } from "next-auth/react";
import { menuConfig, filterMenu } from "@/app/config/menuConfig";
import { canOpenPage } from "@/lib/rbac/access";
import useMenuBadges from "./useMenuBadges";

export default function MobileSidebar({ open, onClose }) {
  const { data, status } = useSession();
  const user = data?.user;
  // Top-level children of the MAIN group, filtered by the registry.
  const menu = useMemo(
    () => filterMenu(menuConfig, user, canOpenPage).flatMap((n) => n.children ?? []),
    [user]
  );
  const badges = useMenuBadges(user);

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
              <Avatar
                src={user?.image}
                alt={user?.name || "User avatar"}
                size={40}
                radius={8}
                fallback={
                  <div className="h-10 w-10 rounded-lg bg-white/5 grid place-items-center">
                    <User size={18} className="text-slate-300" />
                  </div>
                }
              />

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
            {/* Same registry-filtered menu as the desktop Sidebar */}
            {menu.map((node) =>
              node.type === "group" ? (
                <Fragment key={node.key}>
                  <li className="mt-2 px-3 pt-3 text-xs uppercase tracking-wider text-slate-400/80 border-t border-white/10">
                    {node.label}
                  </li>
                  {node.children
                    .filter((child) => child.type === "link")
                    .map((child) => (
                      <li key={child.key}>
                        <Link href={child.href} onClick={onClose} className="flex items-center rounded-lg px-3 py-2 hover:bg-white/5 hover:text-indigo-300">
                          {child.label}
                          {child.badgeKey && badges[child.badgeKey] > 0 && (
                            <span className="ml-auto rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">{badges[child.badgeKey]}</span>
                          )}
                        </Link>
                      </li>
                    ))}
                </Fragment>
              ) : (
                <li key={node.key}>
                  <Link href={node.href} onClick={onClose} className="block rounded-lg px-3 py-2 hover:bg-white/5 hover:text-indigo-300">
                    {node.label}
                  </Link>
                </li>
              )
            )}
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
