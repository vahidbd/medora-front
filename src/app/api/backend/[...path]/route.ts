import type { NextRequest } from "next/server";
import { relay } from "@/lib/server/relay";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

/** The browser's way to the API (src/lib/server/relay.ts). */
async function handle(request: NextRequest, context: Context) {
  return relay(request, (await context.params).path);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
