// src/components/Sidebar.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, KeyRound, LogOut, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { menuConfig, filterMenu, flattenMenu, findActiveLink } from "@/app/config/menuConfig";
import { canOpenPage } from "@/lib/rbac/access";
import Avatar from "./Avatar";
import useMenuBadges from "./useMenuBadges";

/* ── Tokens (Figma "แผงเมนู — Redesign") ───────────────────────── */
const NAVY = "#0D1B2A";
const FLYOUT_BG = "#13243A";
const LIME = "#D4F73F";
const BLUE = "#005CFF";
const MUTED = "#8592A6"; // icons, brand subtitle — 5.52:1 on NAVY
const LABEL = "#AEB9C9"; // item labels — 8.77:1 on NAVY
// Section headers. The Figma value #6F7D92 is 4.16:1 on NAVY (3.75:1 on the
// flyout), under WCAG AA; #7D8BA0 is the nearest shade on the same hue that
// passes on both (5.03:1 / 4.53:1).
const HEAD = "#7D8BA0";
const FOOT = "#8592A6"; // © line — 5.52:1 on NAVY
const RED = "#E5484D";
const LOGOUT = "#FF8A8D";

const EXPANDED_W = 264;
const RAIL_W = 72;
/** At most this many visible links: sections stay flat (no chevrons, never collapsed). */
const FLAT_LIMIT = 8;

/* ── Keys ──────────────────────────────────────────────────────── */
const SECTIONS_KEY = "sb:sections"; // { [sectionKey]: open? }
const COLLAPSE_KEY = "sb:collapsed"; // desktop (≥ 1024 px) choice
const TABLET_KEY = "sb:tablet"; // "expanded" once the user widened the rail on a 768–1023 px screen
const TABLET = "(min-width: 768px) and (max-width: 1023px)";

const CSS = `
.nv-item{position:relative;display:flex;align-items:center;gap:12px;padding:0 10px 0 12px;border-radius:10px;color:${LABEL};font-size:14px;line-height:1.3;text-decoration:none;transition:background-color 150ms ease,color 150ms ease;width:100%;border:0;background:transparent;cursor:pointer;text-align:left;font-family:inherit}
.nv-item .nv-icon{color:${MUTED};flex-shrink:0;transition:color 150ms ease}
.nv-item:hover{background:rgba(255,255,255,0.06);color:#fff}
.nv-item:hover .nv-icon{color:#fff}
.nv-item[data-active]{background:rgba(0,92,255,0.18);color:#fff;font-weight:600}
.nv-item[data-active] .nv-icon{color:${LIME}}
.nv-item.nv-out,.nv-item.nv-out .nv-icon{color:${LOGOUT}}
.nv-item.nv-out:hover{background:rgba(255,138,141,0.10)}
.nv-bar{position:absolute;left:0;top:50%;width:3px;height:20px;margin-top:-10px;border-radius:0 3px 3px 0;background:${LIME}}
.nv-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nv-sec{display:flex;align-items:center;gap:8px;width:100%;padding:16px 12px 6px;border:0;background:transparent;color:${HEAD};font-size:12px;font-weight:600;letter-spacing:0.04em;text-align:left;font-family:inherit;border-radius:8px}
button.nv-sec{cursor:pointer}
button.nv-sec:hover{color:#C3CCD8}
.nv-tag{font-size:11px;font-weight:600;letter-spacing:0;color:${LIME};background:rgba(212,247,63,0.14);border-radius:9999px;padding:1px 8px;line-height:16px;white-space:nowrap}
.nv-rail{position:relative;display:grid;place-items:center;width:44px;height:44px;border-radius:12px;border:0;background:transparent;color:${MUTED};cursor:pointer;text-decoration:none;transition:background-color 150ms ease,color 150ms ease}
.nv-rail:hover{background:rgba(255,255,255,0.06);color:#fff}
.nv-rail[data-open]{background:rgba(255,255,255,0.10);color:#fff}
.nv-rail[data-current]{background:${LIME};color:${NAVY}}
.nv-icon-btn{display:grid;place-items:center;border:0;border-radius:10px;background:transparent;color:${MUTED};cursor:pointer;transition:background-color 150ms ease,color 150ms ease}
.nv-icon-btn:hover{background:rgba(255,255,255,0.06);color:#fff}
.nv-item:focus-visible,.nv-sec:focus-visible,.nv-rail:focus-visible,.nv-icon-btn:focus-visible{outline:2px solid ${LIME};outline-offset:-2px}
`;

/* ── Helpers ───────────────────────────────────────────────────── */
const sectionCount = (section, badges) =>
  (section.children ?? []).reduce((sum, c) => sum + (c.badgeKey ? badges[c.badgeKey] || 0 : 0), 0);

/** Initials for the avatar fallback (Thai leading vowels skipped: "เกศินี" → "ก"). */
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const first = (w) => (w.replace(/^[เแโใไ]/, "")[0] || w[0] || "").toUpperCase();
  return parts.slice(0, 2).map(first).join("") || "?";
}

function Badge({ count, dot }) {
  if (!count) return null;
  const common = { background: RED, color: "#FFFFFF", fontWeight: 700, borderRadius: 9999, textAlign: "center" };
  if (dot) {
    return (
      <span
        aria-hidden
        style={{ ...common, position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, padding: "0 4px", fontSize: 10, lineHeight: "16px", boxShadow: `0 0 0 2px ${NAVY}` }}
      >
        {count > 9 ? "9+" : count}
      </span>
    );
  }
  return (
    <span aria-label={`${count} รายการรอ`} style={{ ...common, flexShrink: 0, minWidth: 18, padding: "0 6px", fontSize: 11, lineHeight: "18px" }}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Menu model shared by every shape: RBAC-filtered items, badges, the active link. */
function useNavModel() {
  const { data: session } = useSession();
  const user = session?.user;
  const pathname = usePathname();
  // Registry-driven: a link shows when canOpenPage(user, pageKey) is true;
  // empty sections disappear.
  const items = useMemo(() => filterMenu(menuConfig, user, canOpenPage), [user]);
  const badges = useMenuBadges(user);
  const active = useMemo(() => findActiveLink(items, pathname), [items, pathname]);
  const flat = useMemo(() => flattenMenu(items).length <= FLAT_LIMIT, [items]);
  return { pathname, items, badges, active, flat };
}

/** Which sections are open, remembered across pages (default: open unless `defaultCollapsed`). */
function useSections(items, activeSectionKey, flat) {
  const [stored, setStored] = useState({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SECTIONS_KEY);
      if (raw) setStored(JSON.parse(raw) || {});
    } catch {}
  }, []);
  const save = (next) => {
    try {
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(next));
    } catch {}
    return next;
  };
  const isOpen = useCallback(
    (section) => flat || (stored[section.key] ?? !section.defaultCollapsed),
    [flat, stored]
  );
  const toggle = (section) => setStored((s) => save({ ...s, [section.key]: !(s[section.key] ?? !section.defaultCollapsed) }));
  // Landing on a page inside a closed section opens it, so the current page is never hidden.
  useEffect(() => {
    if (!activeSectionKey || flat) return;
    const section = items.find((n) => n.key === activeSectionKey);
    if (section && !isOpen(section)) setStored((s) => save({ ...s, [section.key]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the current section changes
  }, [activeSectionKey]);
  return { isOpen, toggle };
}

/* ── One menu link (expanded sidebar, drawer, flyout) ──────────── */
function NavItem({ link, active, height, badges, onNavigate }) {
  const Icon = link.icon;
  const count = link.badgeKey ? badges[link.badgeKey] || 0 : 0;
  return (
    <Link
      href={link.href}
      className="nv-item"
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate?.(link.href)}
      style={{ height }}
    >
      {active && <span className="nv-bar" aria-hidden />}
      {Icon && <Icon size={18} className="nv-icon" aria-hidden />}
      <span className="nv-label">{link.label}</span>
      <Badge count={count} />
    </Link>
  );
}

/* ── Expanded menu: แดชบอร์ด + sections with collapsible headers ─ */
function ExpandedNav({ model, itemHeight, onNavigate }) {
  const { items, badges, active, flat } = model;
  const { isOpen, toggle } = useSections(items, active?.section?.key, flat);
  return (
    <nav aria-label="เมนูหลัก" style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
      {items.map((node) => {
        if (node.type === "link") {
          return (
            <div key={node.key} style={{ padding: "1px 0" }}>
              <NavItem link={node} active={active?.link.key === node.key} height={itemHeight} badges={badges} onNavigate={onNavigate} />
            </div>
          );
        }
        const open = isOpen(node);
        const count = open ? 0 : sectionCount(node, badges);
        const listId = `nv-sec-${node.key}`;
        const head = (
          <>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.label}</span>
            {node.inDevelopment && <span className="nv-tag">กำลังพัฒนา</span>}
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              {!flat && <Badge count={count} />}
              {!flat && (open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />)}
            </span>
          </>
        );
        return (
          <section key={node.key} aria-label={node.label}>
            {flat ? (
              <div className="nv-sec">{head}</div>
            ) : (
              <button type="button" className="nv-sec" aria-expanded={open} aria-controls={listId} onClick={() => toggle(node)} data-section={node.key}>
                {head}
              </button>
            )}
            {open && (
              <ul id={listId} style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {node.children.map((child) => (
                  <li key={child.key} style={{ padding: "1px 0" }}>
                    <NavItem link={child} active={active?.link.key === child.key} height={itemHeight} badges={badges} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </nav>
  );
}

/* ── Collapsed rail: one button per entry, sections open a flyout ─ */
function Flyout({ section, anchorRef, model, onClose, focusFirst }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      const el = ref.current;
      if (!anchor || !el) return;
      const a = anchor.getBoundingClientRect();
      const panel = anchor.closest("[data-sb-panel]")?.getBoundingClientRect();
      const h = el.offsetHeight;
      const top = Math.max(8, Math.min(a.top - 8, window.innerHeight - h - 8));
      setPos({ left: (panel ? panel.right : a.right) + 10, top });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchorRef]);
  useEffect(() => {
    if (focusFirst && pos) ref.current?.querySelector("a")?.focus();
  }, [focusFirst, pos]);
  const { badges, active } = model;
  return (
    <div
      ref={ref}
      id={`nv-flyout-${section.key}`}
      role="group"
      aria-label={section.label}
      data-testid="rail-flyout"
      style={{
        position: "fixed",
        left: pos?.left ?? -9999,
        top: pos?.top ?? 0,
        visibility: pos ? "visible" : "hidden",
        width: 248,
        maxHeight: "calc(100dvh - 16px)",
        overflowY: "auto",
        background: FLYOUT_BG,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
        padding: "10px 8px",
        zIndex: 60,
      }}
    >
      <p style={{ margin: 0, padding: "4px 12px 8px", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: HEAD }}>{section.label}</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {section.children.map((child) => (
          <li key={child.key} style={{ padding: "1px 0" }}>
            <NavItem link={child} active={active?.link.key === child.key} height={40} badges={badges} onNavigate={onClose} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RailSection({ section, model, open, setOpenKey }) {
  const btnRef = useRef(null);
  const wrapRef = useRef(null);
  const [byKeyboard, setByKeyboard] = useState(false);
  const Icon = section.icon;
  const current = model.active?.section?.key === section.key;
  const count = sectionCount(section, model.badges);
  const close = useCallback(() => setOpenKey((k) => (k === section.key ? null : k)), [setOpenKey, section.key]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        close();
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div
      ref={wrapRef}
      // Tabbing out of the flyout closes it.
      onBlur={(e) => {
        if (open && e.relatedTarget && !wrapRef.current?.contains(e.relatedTarget)) close();
      }}
    >
      <button
        ref={btnRef}
        type="button"
        className="nv-rail"
        aria-label={section.label}
        title={section.label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? `nv-flyout-${section.key}` : undefined}
        data-current={current || undefined}
        data-open={open || undefined}
        data-section={section.key}
        onClick={(e) => {
          setByKeyboard(e.detail === 0);
          setOpenKey(open ? null : section.key);
        }}
      >
        {Icon && <Icon size={20} aria-hidden />}
        <Badge count={count} dot />
      </button>
      {open && <Flyout section={section} anchorRef={btnRef} model={model} onClose={close} focusFirst={byKeyboard} />}
    </div>
  );
}

function RailNav({ model }) {
  const { items, active, pathname } = model;
  const [openKey, setOpenKey] = useState(null);
  // Navigation closes the flyout.
  useEffect(() => setOpenKey(null), [pathname]);
  return (
    <nav aria-label="เมนูหลัก" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {items.map((node, i) => {
        if (node.type === "link") {
          const Icon = node.icon;
          const isActive = active?.link.key === node.key;
          const count = node.badgeKey ? model.badges[node.badgeKey] || 0 : 0;
          return (
            <div key={node.key} style={{ display: "contents" }}>
              <Link href={node.href} className="nv-rail" aria-label={node.label} title={node.label} aria-current={isActive ? "page" : undefined} data-current={isActive || undefined}>
                {Icon && <Icon size={20} aria-hidden />}
                <Badge count={count} dot />
              </Link>
              {i < items.length - 1 && items[i + 1].type === "group" && (
                <div aria-hidden style={{ width: 32, height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
              )}
            </div>
          );
        }
        return <RailSection key={node.key} section={node} model={model} open={openKey === node.key} setOpenKey={setOpenKey} />;
      })}
    </nav>
  );
}

/* ── Brand block ───────────────────────────────────────────────── */
function Brand({ collapsed, drawer, onCollapse, onClose }) {
  if (collapsed) {
    return (
      <div style={{ height: 68, display: "grid", placeItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", background: `linear-gradient(90deg, ${NAVY} 0%, #10294A 100%)` }}>
        <Image src="/logo-9hrms.png" alt="9Expert HRMS" width={40} height={40} style={{ objectFit: "contain" }} />
      </div>
    );
  }
  return (
    <div
      style={{
        height: 68,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 12px 0 16px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: `linear-gradient(90deg, ${NAVY} 0%, #10294A 100%)`,
      }}
    >
      <Image src="/logo-9hrms.png" alt="9Expert HRMS" width={36} height={36} style={{ objectFit: "contain", flexShrink: 0 }} />
      <div style={{ lineHeight: 1.25, minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, color: "#FFFFFF", fontWeight: 700, fontSize: 15 }}>HRMS Portal</p>
        <p style={{ margin: 0, color: MUTED, fontSize: 12 }}>9Expert Training</p>
      </div>
      {drawer ? (
        <button type="button" onClick={onClose} data-drawer-close aria-label="ปิดเมนู" className="nv-icon-btn" style={{ width: 44, height: 44, color: "#FFFFFF" }}>
          <X size={22} aria-hidden />
        </button>
      ) : (
        <button type="button" onClick={onCollapse} aria-label="ย่อแถบเมนู" title="ย่อแถบเมนู" className="nv-icon-btn sb-toggle" style={{ width: 40, height: 40 }}>
          <PanelLeftClose size={18} aria-hidden />
        </button>
      )}
    </div>
  );
}

/* ── Drawer: the signed-in person ─────────────────────────────── */
function Account({ account }) {
  const { data: session } = useSession();
  const name = account?.name || session?.user?.name || "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 8px" }} data-testid="drawer-account">
      <Avatar
        src={account?.photoUrl}
        crop={account?.photoCrop}
        size={44}
        alt=""
        fallback={
          <span aria-hidden style={{ width: 44, height: 44, minWidth: 44, borderRadius: 9999, background: BLUE, color: "#FFFFFF", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 700 }}>
            {initials(name)}
          </span>
        }
      />
      <div style={{ minWidth: 0, lineHeight: 1.3 }}>
        <p style={{ margin: 0, color: "#FFFFFF", fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
        {account?.department && <p style={{ margin: 0, color: MUTED, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.department}</p>}
      </div>
    </div>
  );
}

/**
 * The sidebar's contents, in three shapes:
 *  - `variant="rail"`, expanded: 264 px sidebar with collapsible sections;
 *  - `variant="rail"`, collapsed: 72 px icon rail, one button per section, flyouts;
 *  - `variant="drawer"`: the phone drawer — account block, 48 px rows, and
 *    เปลี่ยนรหัสผ่าน / ออกจากระบบ pinned at the bottom (`onNavigate(href)` on every tap).
 */
export function SidebarPanel({ variant = "rail", collapsed: railCollapsed = false, setCollapsed = () => {}, onClose, onNavigate, account }) {
  const model = useNavModel();
  const drawer = variant === "drawer";
  const collapsed = drawer ? false : railCollapsed;

  return (
    <div data-sb-panel style={{ height: "100dvh", position: "sticky", top: 0, display: "flex", flexDirection: "column", background: NAVY }}>
      <style>{CSS}</style>
      <Brand collapsed={collapsed} drawer={drawer} onCollapse={() => setCollapsed(true)} onClose={onClose} />
      {drawer && <Account account={account} />}

      {collapsed ? <RailNav model={model} /> : <ExpandedNav model={model} itemHeight={drawer ? 48 : 40} onNavigate={onNavigate} />}

      {drawer ? (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 2 }} data-testid="drawer-footer">
          <Link href="/account/password" className="nv-item" style={{ height: 48 }} onClick={() => onNavigate?.("/account/password")}>
            <KeyRound size={18} className="nv-icon" aria-hidden />
            <span className="nv-label">เปลี่ยนรหัสผ่าน</span>
          </Link>
          <button type="button" className="nv-item nv-out" style={{ height: 48 }} onClick={() => signOut({ callbackUrl: "/login", redirect: true })} data-testid="drawer-logout">
            <LogOut size={18} className="nv-icon" aria-hidden />
            <span className="nv-label">ออกจากระบบ</span>
          </button>
        </div>
      ) : collapsed ? (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 0", display: "grid", placeItems: "center" }}>
          <button type="button" onClick={() => setCollapsed(false)} aria-label="ขยายแถบเมนู" title="ขยายแถบเมนู" className="nv-icon-btn sb-toggle" style={{ width: 40, height: 40 }}>
            <PanelLeftOpen size={18} aria-hidden />
          </button>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "14px 24px", fontSize: 11, color: FOOT }}>
          {`© ${new Date().getFullYear()} 9Expert Co., Ltd.`}
        </div>
      )}
    </div>
  );
}

/*
 * ── Sidebar (≥ 768 px; phones use MobileNav's drawer) ───────────────
 * 768–1023 px (tablets): starts as the icon rail unless the user expanded
 * it there before (TABLET_KEY). ≥ 1024 px: the remembered desktop choice
 * (COLLAPSE_KEY). Each width remembers only what the user chose there, so the
 * tablet default never overwrites the desktop preference.
 */
export default function Sidebar() {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(TABLET);
    const apply = () => {
      try {
        if (mq.matches) setCollapsedState(localStorage.getItem(TABLET_KEY) !== "expanded");
        else setCollapsedState(localStorage.getItem(COLLAPSE_KEY) === "1");
      } catch {
        setCollapsedState(mq.matches);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const setCollapsed = (value) => {
    setCollapsedState(value);
    try {
      if (window.matchMedia(TABLET).matches) localStorage.setItem(TABLET_KEY, value ? "collapsed" : "expanded");
      else localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
    } catch {}
  };

  return (
    <aside
      className="hidden md:block shrink-0"
      data-collapsed={collapsed || undefined}
      style={{
        width: collapsed ? RAIL_W : EXPANDED_W,
        background: NAVY,
        borderRight: "1px solid rgba(255,255,255,0.06)",
        transition: "width 200ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <SidebarPanel variant="rail" collapsed={collapsed} setCollapsed={setCollapsed} />
    </aside>
  );
}
