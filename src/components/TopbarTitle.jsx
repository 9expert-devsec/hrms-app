"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { menuConfig, findActiveLink } from "@/app/config/menuConfig";

/**
 * Top-bar title from the menu: the link the current page belongs to (itself
 * or its closest ancestor by href, so create / edit / detail / print routes
 * take their list page's name) and its section above it. แดชบอร์ด has no
 * section line; a route under no menu link shows nothing here (the page keeps
 * its own heading). Phones show the title only.
 */
export default function TopbarTitle() {
  const pathname = usePathname();
  const hit = useMemo(() => findActiveLink(menuConfig, pathname), [pathname]);
  if (!hit) return <div className="min-w-0 flex-1" />;
  return (
    <div className="min-w-0 flex-1 leading-tight" data-testid="topbar-title">
      {hit.section && (
        <p className="m-0 hidden truncate text-xs md:block" style={{ color: "#5E6A7E" }} data-testid="topbar-section">
          {hit.section.label}
        </p>
      )}
      <p className="m-0 truncate text-[17px] font-bold md:text-xl" style={{ color: "#0D1B2A" }} data-testid="topbar-page">
        {hit.link.label}
      </p>
    </div>
  );
}
