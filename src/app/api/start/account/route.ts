import type { NextRequest } from "next/server";
import { createAccount } from "@/lib/server/intake";

export const dynamic = "force-dynamic";

/** Create the signed-in person's account through this host's brand, then claim what the browser holds (src/lib/server/intake.ts). */
export async function POST(request: NextRequest) {
  return createAccount(request);
}
