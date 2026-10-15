import { requireSessionAPI } from "@/lib/authz";

// AUTH-ONLY: any signed-in user may ask for a role; the stub only logs it.
export async function POST(req) {
  const gate = await requireSessionAPI();
  if (gate.res) return gate.res;

  const body = await req.json();
  // TODO: บันทึกลง DB / ส่งอีเมลแจ้ง HR/IT
  console.log("[ROLE REQUEST]", body);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
