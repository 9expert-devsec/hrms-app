// PUBLIC: the forgot-password form is used while signed out. Stub — it only
// logs the address; no token is created and nothing is sent or revealed.
export async function POST(req) {
  const { email } = await req.json();

  // TODO: สร้าง token + ส่งอีเมลจริง
  console.log("[FORGOT] requested by:", email);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
