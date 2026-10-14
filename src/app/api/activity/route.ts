// Guest activity log: joins, offers of help, drives, requests and feedback.
// No login, OTP or email. Each guest is a random id kept on their device.
const TYPES = new Set(["join", "offer", "drive", "ask", "feedback"]);

export async function POST(req: Request) {
  let body: { type?: string; payload?: unknown; guest?: string; at?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Send a JSON body." }, { status: 400 });
  }
  if (!body.type || !TYPES.has(body.type)) {
    return Response.json({ ok: false, error: "Unknown activity type." }, { status: 400 });
  }
  const guest = typeof body.guest === "string" ? body.guest.slice(0, 64) : "guest_anon";
  const id = crypto.randomUUID();
  console.log(JSON.stringify({ event: "ekoo.activity", id, type: body.type, guest, at: body.at ?? new Date().toISOString(), payload: body.payload }));
  return Response.json({ ok: true, id, receivedAt: new Date().toISOString() }, { status: 201 });
}
