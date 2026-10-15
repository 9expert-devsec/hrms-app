// src/app/api/leave/requests/[id]/doc.pdf/route.js
// Server-side PDF generation via puppeteer is not supported on Vercel.
// Use the browser print / download button on the leave document page instead.
import { requireAnyPageApi } from "@/lib/rbac/guard";

export async function GET() {
  // Stub (501), but guarded like the HTML document it points to.
  const gate = await requireAnyPageApi(["self_leave_document", "self_leave_request", "leave_approve"]);
  if (gate.res) return gate.res;

  return Response.json(
    {
      error: "Use browser print function instead",
      message: "กรุณาใช้ปุ่ม Download PDF ในหน้าเอกสาร",
    },
    { status: 501 }
  );
}
