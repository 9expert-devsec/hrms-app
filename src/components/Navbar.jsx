"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import MobileSidebar from "./MobileSidebar";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      {/* Desktop menu */}
      <div className="hidden md:flex items-center gap-6 text-slate-300">
        <Link href="/login" className="hover:text-indigo-300 transition">Login</Link>
        <Link href="/dashboard" className="hover:text-indigo-300 transition">Dashboard</Link>
      </div>

      {/* Mobile toggle */}
      <button
        className="md:hidden text-slate-300 hover:text-indigo-300"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Menu size={24} />
      </button>

      {/* Off-canvas sidebar for mobile */}
      <MobileSidebar open={open} onClose={close} />
    </>
  );
}
