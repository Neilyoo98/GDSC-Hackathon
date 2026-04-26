import { NextRequest } from "next/server";
import { backendUrl, proxyJson } from "@/lib/backend";
import { normalizeAgent } from "@/lib/agents";
import type { Agent } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return proxyJson<Agent>(`${backendUrl()}/agents/${params.id}`, { cache: "no-store" }, normalizeAgent);
}
