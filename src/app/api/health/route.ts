export function GET() {
  return Response.json({ ok: true, service: "ekoo", time: new Date().toISOString() });
}
