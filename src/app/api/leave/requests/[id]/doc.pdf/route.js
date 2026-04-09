// src/app/api/leave/requests/[id]/doc.pdf/route.js
// Server-side PDF generation via puppeteer is not supported on Vercel.
// Use the browser print / download button on the leave document page instead.

export async function GET() {
  return Response.json(
    {
      error: "Use browser print function instead",
      message: "กรุณาใช้ปุ่ม Download PDF ในหน้าเอกสาร",
    },
    { status: 501 }
  );
}
