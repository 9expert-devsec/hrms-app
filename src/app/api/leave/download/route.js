import { requireAnyPageApi } from "@/lib/rbac/guard";

export async function GET(req) {
  // AttachmentViewer on the leave approve and leave document pages.
  const gate = await requireAnyPageApi(["self_leave_document", "leave_approve"]);
  if (gate.res) return gate.res;

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const filename = searchParams.get("filename") || "document";

  if (!url) return Response.json({ error: "No URL" }, { status: 400 });

  // Only our Cloudinary host. (A substring check let any URL containing
  // "cloudinary.com" through this server-side fetch.)
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    // Server-to-server fetch from Cloudinary
    let response = await fetch(url);

    // If direct URL fails, try with fl_attachment flag for raw files
    if (!response.ok && url.includes("/raw/upload/")) {
      const altUrl = url.replace("/raw/upload/", "/raw/upload/fl_attachment/");
      response = await fetch(altUrl);
    }

    if (!response.ok) {
      return Response.json({ error: "File not accessible" }, { status: 404 });
    }

    const buffer = await response.arrayBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Type": response.headers.get("content-type") || "application/octet-stream",
      },
    });
  } catch (err) {
    console.error("Download proxy error:", err);
    return Response.json({ error: "Download failed" }, { status: 500 });
  }
}
