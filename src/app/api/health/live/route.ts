import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * The host's deploy check (railway.json): this web app is up, and which
 * commit it is (ADR 0024). It does not ask the API, so a web release can
 * still go out while the API is down. The uptime check uses /api/health,
 * which covers the API and its database too.
 */
export function GET() {
  return NextResponse.json(
    { status: "ok", version: process.env.NEXT_PUBLIC_RELEASE_SHA || "development" },
    { headers: { "cache-control": "no-store" } },
  );
}
