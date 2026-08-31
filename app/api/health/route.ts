export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    status: "ok",
    service: "qr-review-saas",
    timestamp: new Date().toISOString(),
  });
}
