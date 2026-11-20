import { z } from "zod";

/*
 * A brand, as the API's public brand route answers it
 * (GET /v1/public/brands/by-host/:host): its name, look and support
 * details, and nothing about any patient. Its type moves to the generated
 * contract (ADR 0014) when the route is in it; until then this schema is
 * the contract's copy (docs/decisions/patient-app.md PA9).
 *
 * The proxy finds the brand for a patient host and hands it to the patient
 * app's pages in BRAND_HEADER on the request, which only the proxy writes:
 * it drops any copy a caller sends. The value is checked again on the way
 * in, because it becomes the page's look.
 */

export const brandSchema = z.object({
  brandId: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  status: z.enum(["live", "paused"]),
  logoUrl: z.string().url().nullable(),
  primaryColour: z.string().nullable(),
  supportEmail: z.string().nullable(),
  supportPhone: z.string().nullable(),
  timeZone: z.string().min(1),
});

export type Brand = z.infer<typeof brandSchema>;

/** The request header that carries the proxy's brand to the patient app's pages. */
export const BRAND_HEADER = "x-medora-brand";

/** A header value is ASCII, and a brand's name may not be. */
export function brandHeaderValue(brand: Brand): string {
  return encodeURIComponent(JSON.stringify(brand));
}

/** The brand in a header value, or null when it is missing or not a brand. */
export function brandFromHeader(value: string | null | undefined): Brand | null {
  if (!value) return null;
  try {
    const parsed = brandSchema.safeParse(JSON.parse(decodeURIComponent(value)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
