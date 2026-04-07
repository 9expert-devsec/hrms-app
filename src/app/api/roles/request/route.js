export async function POST(req) {
  const body = await req.json();
  // TODO: บันทึกลง DB / ส่งอีเมลแจ้ง HR/IT
  console.log("[ROLE REQUEST]", body);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
