import { NextRequest } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const incident_text = req.nextUrl.searchParams.get("incident_text") ?? "";
  try {
    const upstream = await fetch(
      `${BACKEND}/incidents/stream?incident_text=${encodeURIComponent(incident_text)}`,
      { cache: "no-store" }
    );
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response(
      `data: ${JSON.stringify({ node: "error", status: "error", output: { message: "Backend unavailable" } })}\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }
}
