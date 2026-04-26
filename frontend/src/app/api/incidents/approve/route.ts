import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get("thread_id");
  const approved = req.nextUrl.searchParams.get("approved") ?? "true";
  if (!threadId) {
    return NextResponse.json({ detail: "thread_id is required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BACKEND}/incidents/approve?thread_id=${encodeURIComponent(threadId)}&approved=${encodeURIComponent(approved)}`,
      { method: "POST" }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Backend unavailable" }, { status: 502 });
  }
}
