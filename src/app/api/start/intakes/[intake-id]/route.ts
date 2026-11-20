import type { NextRequest } from "next/server";
import { readHeldIntake } from "@/lib/server/intake";

export const dynamic = "force-dynamic";

/** An intake this browser holds, with its answers (src/lib/server/intake.ts). */
export async function GET(request: NextRequest, context: { params: Promise<{ "intake-id": string }> }) {
  return readHeldIntake(request, (await context.params)["intake-id"]);
}
