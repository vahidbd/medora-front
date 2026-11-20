import type { NextRequest } from "next/server";
import { claimHeld } from "@/lib/server/intake";

export const dynamic = "force-dynamic";

/** Make the intakes this browser holds the signed-in patient's own (src/lib/server/intake.ts). */
export async function POST(request: NextRequest) {
  return claimHeld(request);
}
