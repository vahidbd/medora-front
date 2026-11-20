import { NextResponse } from "next/server";
import { backendOrigin } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

type Part = "ok" | "unavailable" | "unreachable" | "unknown";

interface Health {
  status: "ok" | "unavailable";
  /** The commit this web app was built from (ADR 0024). */
  version: string;
  app: "ok";
  api: Part;
  database: Part;
}

/**
 * The uptime check's address (ADRs 0024, 0026): 200 only when the web app,
 * the API and its database all answer, so one check covers all three. The
 * body says which part is down. No session, nothing personal, never cached.
 */
export async function GET() {
  const health: Health = { status: "ok", version: process.env.NEXT_PUBLIC_RELEASE_SHA || "development", app: "ok", api: "ok", database: "ok" };
  try {
    const response = await fetch(`${backendOrigin()}/health/ready`, { cache: "no-store", signal: AbortSignal.timeout(6_000) });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { database?: string } | null;
      const databaseDown = body?.database === "unreachable";
      health.api = databaseDown ? "ok" : "unavailable";
      health.database = databaseDown ? "unreachable" : "unknown";
    }
  } catch {
    health.api = "unreachable";
    health.database = "unknown";
  }
  if (health.api !== "ok" || health.database !== "ok") health.status = "unavailable";
  return NextResponse.json(health, { status: health.status === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
}
