import type { NextRequest } from "next/server";
import { startIntake } from "@/lib/server/intake";

export const dynamic = "force-dynamic";

/** Start an intake before an account, and hold its resume token in the cookie (src/lib/server/intake.ts). */
export async function POST(request: NextRequest) {
  return startIntake(request);
}
