import "server-only";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { IntakeStartScreen } from "@/lib/api/types";
import { TENANT_HEADER } from "@/lib/api/tenant-header";
import { BRAND_HEADER, brandFromHeader, type Brand } from "@/lib/brand";
import { BRAND_HOST_HEADER, normaliseHost } from "@/lib/surface";
import { backendApiUrl } from "@/lib/server/backend";
import { heldFor, INTAKE_COOKIE, isId, readHeld } from "@/lib/server/intake-tokens";

/*
 * What the start pages read on the server before anything is shown: the
 * brand's open programs and a program's first screen, from the API's public
 * routes in the brand's tenant, and which intake this browser holds for a
 * program. Nothing here needs a session, and no token leaves this server:
 * a page learns only the id of the intake it may pick up.
 */

/** The brand the proxy found for this page's host; a page without one isn't a patient page. */
export async function pageBrand(): Promise<{ host: string; brand: Brand }> {
  const list = await headers();
  const host = normaliseHost(list.get(BRAND_HOST_HEADER));
  const brand = brandFromHeader(list.get(BRAND_HEADER));
  if (!host || !brand) notFound();
  return { host, brand };
}

/** Why a start page can't go on: the brand or program takes no new patients now, or the API couldn't say. */
export type Closed = { state: "closed" } | { state: "failed" };

const CLOSED_CODES = new Set(["brand_not_accepting", "tenant_not_ready", "program_unavailable", "privacy_notice_missing"]);

async function publicGet(brand: Brand, path: string): Promise<{ status: number; body: unknown } | null> {
  try {
    const response = await fetch(backendApiUrl(path), {
      headers: { accept: "application/json", [TENANT_HEADER]: brand.tenantId },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  } catch {
    return null;
  }
}

function closedOrFailed(reply: { status: number; body: unknown } | null): Closed {
  const code = (reply?.body as { error?: { code?: unknown } } | null)?.error?.code;
  return reply?.status === 409 && typeof code === "string" && CLOSED_CODES.has(code) ? { state: "closed" } : { state: "failed" };
}

/*
 * GET /v1/public/brands/{brandId}/programs is on the intake branch
 * (docs/decisions/intake.md INT16 in medora-backend) and not yet in this
 * branch's contract, so its shape is copied here, once, and checked where
 * it crosses in (docs/decisions/patient-app.md APP9). Delete this copy when
 * the contract has the route.
 */
const brandProgramsSchema = z.object({
  programs: z.array(z.object({ programId: z.string().uuid(), name: z.string().min(1), condition: z.string() })),
});
export type OpenProgram = z.infer<typeof brandProgramsSchema>["programs"][number];

/** The brand's programs a person can start now. */
export async function openPrograms(brand: Brand): Promise<{ state: "open"; programs: OpenProgram[] } | Closed> {
  const reply = await publicGet(brand, `/public/brands/${encodeURIComponent(brand.brandId)}/programs`);
  if (reply?.status !== 200) return closedOrFailed(reply);
  const parsed = brandProgramsSchema.safeParse(reply.body);
  return parsed.success ? { state: "open", programs: parsed.data.programs } : { state: "failed" };
}

/** A program's first screen: its name and the privacy notice to agree to. Not found when the program isn't this tenant's. */
export async function startScreen(brand: Brand, programId: string): Promise<{ state: "open"; screen: IntakeStartScreen } | { state: "missing" } | Closed> {
  if (!isId(programId)) return { state: "missing" };
  const reply = await publicGet(brand, `/public/programs/${programId}/intake-start`);
  if (reply?.status === 404) return { state: "missing" };
  if (reply?.status !== 200) return closedOrFailed(reply);
  return { state: "open", screen: reply.body as IntakeStartScreen };
}

/** The intake this browser holds for a program, newest first, by id only. */
export async function heldIntakeId(programId: string): Promise<string | null> {
  const held = readHeld((await cookies()).get(INTAKE_COOKIE)?.value);
  return heldFor(held, programId)?.intakeId ?? null;
}
