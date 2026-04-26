import { NextRequest, NextResponse } from "next/server";
import { backendUrl, proxyJson } from "@/lib/backend";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return proxyJson(`${backendUrl()}/incidents/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid request body";
    return NextResponse.json({ detail }, { status: 400 });
  }
}
