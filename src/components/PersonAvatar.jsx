import Avatar from "./Avatar";

/** Up to two initials, Thai leading vowels skipped ("เอกชัย ใจดี" → "อจ"). */
export function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const first = (w) => (w.replace(/^[เแโใไ]/, "")[0] || w[0] || "").toUpperCase();
  return parts.slice(0, 2).map(first).join("") || "?";
}

/**
 * Photo when present, else initials on #DCE6F7 with #005CFF text. `name`
 * should be the Thai-first display name (lib/employeeName.js); `crop` is the
 * chosen photo frame (Employee.photoCrop) when there is one. Fills its box
 * when `fill` is set (the caller sizes the wrapper), else `size` × `size`.
 */
export default function PersonAvatar({ src, name, size = 44, radius = 9999, fill = false, fontSize, crop = null }) {
  const box = fill ? { width: "100%", height: "100%", minWidth: 0 } : { width: size, height: size, minWidth: size };
  return (
    <Avatar
      src={src}
      crop={crop}
      size={size}
      alt=""
      radius={radius}
      style={fill ? box : undefined}
      fallback={
        <span
          aria-hidden
          className="grid shrink-0 place-items-center font-bold"
          style={{ ...box, borderRadius: radius, background: "#DCE6F7", color: "#005CFF", fontSize: fontSize || Math.round(size * 0.36) }}
        >
          {initialsOf(name)}
        </span>
      }
    />
  );
}
