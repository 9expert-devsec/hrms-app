// Internal system — keep every crawler out.
export default function robots() {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
