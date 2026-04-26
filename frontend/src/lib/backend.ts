import { NextResponse } from "next/server";

export function backendUrl() {
  const configured =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!configured) {
    throw new Error("BACKEND_URL or NEXT_PUBLIC_BACKEND_URL is required");
  }
  return configured.replace(/\/+$/, "");
}

export async function proxyJson<T = unknown>(
  url: string,
  init?: RequestInit,
  transform?: (data: T) => unknown
) {
  try {
    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({}));
    const body = response.ok && transform ? transform(data as T) : data;
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Backend unavailable";
    return NextResponse.json({ detail: `Backend unavailable: ${detail}` }, { status: 502 });
  }
}
