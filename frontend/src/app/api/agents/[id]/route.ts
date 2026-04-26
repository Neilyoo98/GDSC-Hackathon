import { NextRequest } from "next/server";
import { backendUrl, proxyJson } from "@/lib/backend";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return proxyJson(`${backendUrl()}/agents/${params.id}`, { cache: "no-store" });
}
