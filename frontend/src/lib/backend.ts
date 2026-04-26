import { NextResponse } from "next/server";

const DEFAULT_BACKEND_URL = "https://gdsc-hackathon-production.up.railway.app";

export function backendUrl() {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    DEFAULT_BACKEND_URL
  ).replace(/\/+$/, "");
}

export async function proxyJson(url: string, init?: RequestInit) {
  try {
    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Backend unavailable";
    return NextResponse.json({ detail: `Backend unavailable: ${detail}` }, { status: 502 });
  }
}
