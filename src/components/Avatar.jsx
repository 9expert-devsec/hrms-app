import { avatarUrl } from "@/lib/avatarUrl";

/**
 * A small round avatar. Cloudinary photos come face-centred and square
 * (lib/avatarUrl.js); anything else is cropped with object-cover anchored to
 * the top, so tall portraits show the head rather than the torso.
 *
 * `fallback` is rendered as-is when there is no photo (each screen keeps its
 * own initials / icon / placeholder). `radius` defaults to a circle.
 */
export default function Avatar({ src, size = 40, alt = "", fallback = null, radius = 9999, className, style }) {
  const url = avatarUrl(src, size);
  if (!url) return fallback;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary resizes; no /_next/image round trip
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={className}
      style={{
        width: size,
        height: size,
        minWidth: size,
        objectFit: "cover",
        objectPosition: "top",
        borderRadius: radius,
        display: "block",
        ...style,
      }}
    />
  );
}
