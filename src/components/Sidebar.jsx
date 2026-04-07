// src/app/components/Sidebar.jsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelRightOpen,
} from "lucide-react";
import { menuConfig } from "@/app/config/menuConfig";

/* ── 9Expert Brand tokens ─────────────────────────────────────── */
const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const LIME = "#D4F73F";
const SLATE = "#808A95";
const BORDER = "rgba(255,255,255,0.06)";

/* ── Keys ──────────────────────────────────────────────────────── */
const OPEN_KEY = "sb:open";
const COLLAPSE_KEY = "sb:collapsed";
const EMPLOYEE_KEY = "emp";

/* ── Helpers ───────────────────────────────────────────────────── */
function canSee(roles, role) {
  if (!roles || roles.length === 0) return true;
  if (!role) return false;
  return roles.includes(role);
}
function isActivePath(pathname, href) {
  if (!href) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

/* ── NavLink ───────────────────────────────────────────────────── */
function NavLink({ node, active, collapsed }) {
  const Icon = node.icon;
  /* Collapsed mode: icon-only pill */
  if (collapsed) {
    return (
      <Link
        href={node.href}
        title={node.label}
        style={{
          display: "grid",
          placeItems: "center",
          width: "40px",
          height: "40px",
          margin: "2px auto",
          borderRadius: "10px",
          background: active ? LIME : "transparent",
          color: active ? NAVY : SLATE,
          transition: "all 150ms ease",
          textDecoration: "none",
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            e.currentTarget.style.color = "#FFFFFF";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = SLATE;
          }
        }}
      >
        {Icon && <Icon size={18} aria-hidden />}
      </Link>
    );
  }

  /* Expanded mode */
  return (
    <Link
      href={node.href}
      title={undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        justifyContent: "flex-start",
        padding: "7px 10px",
        margin: "1px 0",
        borderRadius: "10px",
        fontSize: "13px",
        fontWeight: active ? "600" : "400",
        color: active ? "#FFFFFF" : SLATE,
        background: active
          ? "linear-gradient(90deg, rgba(0,92,255,0.20) 0%, rgba(0,92,255,0.05) 100%)"
          : "transparent",
        borderLeft: active
          ? `3px solid ${LIME}`
          : "3px solid transparent",
        transition: "all 150ms ease",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = "#FFFFFF";
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = SLATE;
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {Icon && (
        <span
          style={{
            paddingLeft: "2px",
            flexShrink: 0,
            color: active ? LIME : SLATE,
            transition: "color 150ms ease",
          }}
        >
          <Icon size={16} aria-hidden />
        </span>
      )}
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {node.label}
      </span>
    </Link>
  );
}

/* ── RecursiveNode ─────────────────────────────────────────────── */
function RecursiveNode({
  node,
  depth,
  collapsed,
  pathname,
  open,
  setOpen,
  role,
}) {
  const paddingLeft = collapsed ? 0 : Math.min(depth * 12, 32);

  if (node.type === "link") {
    return (
      <li style={{ paddingLeft }}>
        <NavLink
          node={node}
          active={isActivePath(pathname, node.href)}
          collapsed={collapsed}
        />
      </li>
    );
  }

  if (node.type === "group") {
    const children = node.children?.filter((n) => canSee(n.roles, role)) ?? [];
    const opened = !!open[node.key];
    const toggle = () => setOpen((s) => ({ ...s, [node.key]: !opened }));
    const Icon = node.icon;

    /* Collapsed: icon-only pill for group */
    const groupBtn = collapsed ? (
      <button
        onClick={toggle}
        title={node.label}
        style={{
          display: "grid",
          placeItems: "center",
          width: "40px",
          height: "40px",
          margin: "2px auto",
          borderRadius: "10px",
          background: opened ? LIME : "transparent",
          color: opened ? NAVY : SLATE,
          border: "none",
          cursor: "pointer",
          transition: "all 150ms ease",
        }}
        onMouseEnter={(e) => {
          if (!opened) {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            e.currentTarget.style.color = "#FFFFFF";
          }
        }}
        onMouseLeave={(e) => {
          if (!opened) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = SLATE;
          }
        }}
      >
        {Icon && <Icon size={18} />}
      </button>
    ) : (
      <button
        onClick={toggle}
        title={undefined}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "7px 10px",
          margin: "1px 0",
          borderRadius: "10px",
          fontSize: "13px",
          fontWeight: opened ? "600" : "400",
          color: opened ? "#FFFFFF" : SLATE,
          background: opened
            ? "linear-gradient(90deg, rgba(0,92,255,0.20) 0%, rgba(0,92,255,0.05) 100%)"
            : "transparent",
          border: "none",
          cursor: "pointer",
          transition: "all 150ms ease",
        }}
        onMouseEnter={(e) => {
          if (!opened) {
            e.currentTarget.style.color = "#FFFFFF";
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }
        }}
        onMouseLeave={(e) => {
          if (!opened) {
            e.currentTarget.style.color = SLATE;
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {Icon && (
            <span
              style={{
                paddingLeft: "2px",
                flexShrink: 0,
                color: opened ? LIME : SLATE,
                transition: "color 150ms ease",
              }}
            >
              <Icon size={16} />
            </span>
          )}
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {node.label}
          </span>
        </span>
        <span style={{ marginLeft: "auto", color: SLATE }}>
          {opened ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
    );

    return (
      <li className="relative" style={{ paddingLeft }}>
        {groupBtn}

        {/* Expanded children */}
        {!collapsed && opened && children.length > 0 && (
          <ul
            style={{
              marginTop: "2px",
              paddingLeft: "8px",
              borderLeft: `1px solid ${BORDER}`,
              marginLeft: "18px",
            }}
          >
            {children.map((child) => (
              <RecursiveNode
                key={child.key}
                node={child}
                depth={depth + 1}
                collapsed={collapsed}
                pathname={pathname}
                open={open}
                setOpen={setOpen}
                role={role}
              />
            ))}
          </ul>
        )}

        {/* Flyout (collapsed mode) */}
        {collapsed && opened && children.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: "100%",
              top: 0,
              marginLeft: "8px",
              minWidth: "200px",
              background: "#0D1B2A",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              padding: "8px",
              zIndex: 40,
            }}
          >
            <p
              style={{
                padding: "4px 8px 6px",
                fontSize: "10px",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: SLATE,
              }}
            >
              {node.label}
            </p>
            <ul>
              {children.map((child) => (
                <RecursiveNode
                  key={child.key}
                  node={child}
                  depth={0}
                  collapsed={false}
                  pathname={pathname}
                  open={open}
                  setOpen={setOpen}
                  role={role}
                />
              ))}
            </ul>
          </div>
        )}
      </li>
    );
  }
  return null;
}

/* ── Sidebar ───────────────────────────────────────────────────── */
export default function Sidebar() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "employee";
  const pathname = usePathname();

  const [open, setOpen] = useState({});
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const o = localStorage.getItem(OPEN_KEY);
      if (o) {
        const parsed = JSON.parse(o) || {};
        if (!(EMPLOYEE_KEY in parsed)) parsed[EMPLOYEE_KEY] = true;
        setOpen(parsed);
      } else {
        setOpen({ [EMPLOYEE_KEY]: true });
      }
      const c = localStorage.getItem(COLLAPSE_KEY);
      if (c) setCollapsed(c === "1");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(open));
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [open, collapsed]);

  const items = useMemo(() => {
    return menuConfig
      .filter((n) => canSee(n.roles, role))
      .map((n) =>
        n.type === "group" && n.children
          ? { ...n, children: n.children.filter((c) => canSee(c.roles, role)) }
          : n,
      );
  }, [role]);

  return (
    <aside
      className="hidden md:block shrink-0"
      style={{
        width: collapsed ? "64px" : "256px",
        background: "linear-gradient(180deg, #0D1B2A 0%, #0a1628 100%)",
        borderRight: `1px solid ${BORDER}`,
        transition: "width 200ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div
        style={{
          height: "100dvh",
          position: "sticky",
          top: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Brand area with subtle blue glow ────────────────── */}
        <div
          style={{
            height: "64px",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            padding: "0 12px",
            borderBottom: `1px solid ${BORDER}`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Blue glow radial */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at top, rgba(0,92,255,0.15) 0%, transparent 60%)",
            }}
          />

          {/* Logo + text (hidden when collapsed) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              position: "relative",
              zIndex: 1,
              cursor: collapsed ? "pointer" : "default",
            }}
            onClick={collapsed ? () => setCollapsed(false) : undefined}
            title={collapsed ? "Expand sidebar" : undefined}
          >
            <div
              style={{
                height: "34px",
                width: "34px",
                borderRadius: "10px",
                background: BLUE,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                boxShadow: "0 2px 10px rgba(0,92,255,0.35)",
              }}
            >
              <span style={{ color: "#FFF", fontWeight: 800, fontSize: "15px" }}>9</span>
            </div>
            {!collapsed && (
              <div style={{ lineHeight: 1.2 }}>
                <p style={{ color: "#FFFFFF", fontWeight: 600, fontSize: "13px", margin: 0 }}>
                  HRMS Portal
                </p>
                <p style={{ color: SLATE, fontSize: "10px", margin: 0 }}>
                  9Expert Training
                </p>
              </div>
            )}
          </div>

          {/* Toggle button — always visible */}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              style={{
                padding: "6px",
                borderRadius: "8px",
                border: "none",
                background: "transparent",
                color: SLATE,
                cursor: "pointer",
                transition: "all 150ms ease",
                position: "relative",
                zIndex: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = LIME;
                e.currentTarget.style.background = "rgba(212,247,63,0.10)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = SLATE;
                e.currentTarget.style.background = "transparent";
              }}
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {/* ── Navigation ─────────────────────────────────────── */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
          {items.map((node) => {
            if (node.type === "link") {
              return (
                <NavLink
                  key={node.key}
                  node={node}
                  active={isActivePath(pathname, node.href)}
                  collapsed={collapsed}
                />
              );
            }
            return (
              <div key={node.key}>
                {!collapsed && (
                  <>
                    {/* Divider line before section label */}
                    <div
                      style={{
                        height: "1px",
                        background: BORDER,
                        margin: "12px 10px 0",
                      }}
                    />
                    <p
                      style={{
                        padding: "10px 10px 4px",
                        fontSize: "10px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "rgba(128,138,149,0.7)",
                        margin: 0,
                      }}
                    >
                      {node.label}
                    </p>
                  </>
                )}
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {(node.children ?? []).map((child) => (
                    <RecursiveNode
                      key={child.key}
                      node={child}
                      depth={0}
                      collapsed={collapsed}
                      pathname={pathname}
                      open={open}
                      setOpen={setOpen}
                      role={role}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div
          style={{
            padding: collapsed ? "12px 0" : "12px 14px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            fontSize: "11px",
            color: SLATE,
            display: "flex",
            flexDirection: "column",
            alignItems: collapsed ? "center" : "stretch",
            gap: "8px",
          }}
        >
          {collapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              style={{
                display: "grid",
                placeItems: "center",
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                border: "none",
                background: "transparent",
                color: SLATE,
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = LIME;
                e.currentTarget.style.background = "rgba(212,247,63,0.10)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = SLATE;
                e.currentTarget.style.background = "transparent";
              }}
            >
              <PanelRightOpen size={16} />
            </button>
          ) : (
            <span>{`\u00A9 ${new Date().getFullYear()} | 9 EXPERT CO., LTD.`}</span>
          )}
        </div>
      </div>
    </aside>
  );
}
