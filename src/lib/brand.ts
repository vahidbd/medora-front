import { z } from "zod";
import type { PublicBrand } from "@/lib/api/types";

/*
 * A brand, as the API's public brand route answers it
 * (GET /v1/public/brands/by-host/:host): its name, look and support
 * details, and nothing about any patient. The type is the contract's
 * (ADR 0014); the schema below checks a value where it crosses into the
 * page, and the type check holds it to the contract.
 *
 * The proxy finds the brand for a patient host and hands it to the patient
 * app's pages in BRAND_HEADER on the request, which only the proxy writes:
 * it drops any copy a caller sends. The value is checked again on the way
 * in, because it becomes the page's look.
 */

/** The contract's brand. Any zone the platform knows reads the same here, so the time zone is any name. */
export type Brand = Omit<PublicBrand, "timeZone"> & { timeZone: string };

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
}) satisfies z.ZodType<Brand>;

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
