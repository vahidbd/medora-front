import "server-only";
import { brandSchema, type Brand } from "@/lib/brand";
import { backendApiUrl } from "@/lib/server/backend";

/*
 * Which brand a patient host belongs to, from the API's public brand route
 * (GET /v1/public/brands/by-host/:host). It needs no session and carries
 * no patient data. The proxy uses it to refuse hosts that aren't a brand's
 * (PA1) and to hand the brand to the patient app's pages; the relay, to
 * name the brand's tenant.
 *
 * Answers are kept for a minute per host, in this process, so a page view
 * doesn't cost a lookup. A failed lookup is never kept: the next request
 * asks again.
 */

export type BrandLookup = { state: "found"; brand: Brand } | { state: "unknown" } | { state: "failed" };

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; lookup: BrandLookup }>();

async function fetchBrand(host: string): Promise<BrandLookup> {
  try {
    const response = await fetch(backendApiUrl(`/public/brands/by-host/${encodeURIComponent(host)}`), {
      headers: { accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 404) return { state: "unknown" };
    if (!response.ok) return { state: "failed" };
    const parsed = brandSchema.safeParse(await response.json());
    return parsed.success ? { state: "found", brand: parsed.data } : { state: "failed" };
  } catch {
    return { state: "failed" };
  }
}

/** The brand for a normalised host: found, not a brand's (unknown), or the API couldn't say (failed). */
export async function brandLookup(host: string): Promise<BrandLookup> {
  const now = Date.now();
  const kept = cache.get(host);
  if (kept && now - kept.at < TTL_MS) return kept.lookup;
  const lookup = await fetchBrand(host);
  if (lookup.state === "failed") cache.delete(host);
  else cache.set(host, { at: now, lookup });
  return lookup;
}

/** For tests: forget every kept answer. */
export function forgetBrands(): void {
  cache.clear();
}
