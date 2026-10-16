"use client";

import { useEffect, useState } from "react";

/**
 * Role picker fed by the server (GET /api/roles, superadmin-only), so custom
 * roles appear and nothing is hard-coded. Render it ONLY for a superadmin:
 * role changes are superadmin-only everywhere (the APIs enforce it too).
 */
export default function RoleSelect({ value, onChange, className = "", style, disabled = false, name = "role" }) {
  const [roles, setRoles] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/roles", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok) setRoles(j.items);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const options = roles ?? [];
  const hasValue = options.some((r) => r.key === value);

  return (
    <select
      name={name}
      className={className}
      style={style}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || roles === null}
    >
      {!hasValue && <option value={value}>{roles === null && !failed ? "กำลังโหลดบทบาท…" : value}</option>}
      {options.map((r) => (
        <option key={r.key} value={r.key}>
          {r.name} ({r.key})
        </option>
      ))}
    </select>
  );
}
