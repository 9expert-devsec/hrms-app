"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * A password field with a show/hide button inside its right edge. Each field
 * keeps its own state. Every other prop (id, name, autoComplete, required,
 * value, …) goes to the <input> untouched. `leading` is an icon placed by the
 * caller inside the wrapper. The input's right padding keeps text clear of the
 * 44 px button.
 */
export default function PasswordInput({ leading = null, style, className = "", ...inputProps }) {
  const [show, setShow] = useState(false);
  const Icon = show ? EyeOff : Eye;

  return (
    <div className="relative">
      {leading}
      <input {...inputProps} type={show ? "text" : "password"} className={className} style={{ ...style, paddingRight: 48 }} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        aria-pressed={show}
        className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-[var(--text-muted)] transition-colors hover:text-9e-action"
      >
        <Icon size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
