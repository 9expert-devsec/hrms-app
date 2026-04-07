export async function POST(req) {
  const { email } = await req.json();

  // TODO: สร้าง token + ส่งอีเมลจริง
  console.log("[FORGOT] requested by:", email);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
