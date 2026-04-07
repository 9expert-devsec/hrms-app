import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const filename = searchParams.get("filename") || "document";

  if (!url) return Response.json({ error: "No URL" }, { status: 400 });

  // Only allow Cloudinary URLs
  if (!url.includes("cloudinary.com")) {
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
