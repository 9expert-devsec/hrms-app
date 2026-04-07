"use client";

import Link from "next/link";
import Image from "next/image";
import Navbar from "./Navbar";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 h-16 flex items-center justify-between px-8 border-b border-white/10 bg-[#0F172B]/90 backdrop-blur supports-[backdrop-filter]:bg-[#0F172B]/75">
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/logo-9-w.png"
          alt="9Expert Logo"
          width={100}
          height={40}
          priority
        />
      </Link>

      <Navbar />
    </header>
  );
}
