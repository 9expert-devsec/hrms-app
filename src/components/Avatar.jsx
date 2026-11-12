import { avatarUrl, isCloudinaryUrl } from "@/lib/avatarUrl";
import { cssCropStyle } from "@/lib/photoCrop";

/**
 * A small round avatar. Cloudinary photos come face-centred and square
 * (lib/avatarUrl.js); anything else is cropped with object-cover anchored to
 * the top, so tall portraits show the head rather than the torso.
 *
 * `crop` — the frame the person chose (Employee.photoCrop, lib/photoCrop.js):
 * Cloudinary cuts it from the original; any other image is framed with CSS.
 * Without `crop` the markup and URL are exactly as before.
 *
 * `fallback` is rendered as-is when there is no photo (each screen keeps its
 * own initials / icon / placeholder). `radius` defaults to a circle.
 */
export default function Avatar({ src, size = 40, alt = "", fallback = null, radius = 9999, crop = null, className, style }) {
  const url = avatarUrl(src, size, crop);
  if (!url) return fallback;
  const cssCrop = crop && !isCloudinaryUrl(url) ? cssCropStyle(crop) : null;
  if (cssCrop) {
    return (
      <span
        className={className}
        style={{ position: "relative", display: "block", overflow: "hidden", width: size, height: size, minWidth: size, borderRadius: radius, ...style }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- framed with CSS */}
        <img src={url} alt={alt} loading="lazy" decoding="async" style={{ ...cssCrop, display: "block" }} />
      </span>
    );
  }
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
