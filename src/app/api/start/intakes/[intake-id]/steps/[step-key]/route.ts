import type { NextRequest } from "next/server";
import { answerHeldStep } from "@/lib/server/intake";

export const dynamic = "force-dynamic";

/** Answer one step of an intake this browser holds (src/lib/server/intake.ts). */
export async function PUT(request: NextRequest, context: { params: Promise<{ "intake-id": string; "step-key": string }> }) {
  const params = await context.params;
  return answerHeldStep(request, params["intake-id"], params["step-key"]);
}
