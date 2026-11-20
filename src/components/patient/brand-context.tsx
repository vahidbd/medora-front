"use client";

import { createContext, useContext } from "react";

/**
 * The brand whose patient app this is, as its pages may show it: name,
 * support details and whether it takes new patients. It comes from the
 * brand's configuration on the server (ADR 0023), never from code. No ids:
 * this app's server names the brand's tenant to the API itself (PA2).
 */
export interface PatientBrand {
  /** The host the patient app is on, lower-case without a port; it keys every query (PA3). */
  host: string;
  name: string;
  status: "live" | "paused";
  supportEmail: string | null;
  supportPhone: string | null;
  /** The tenant's IANA time zone, for "today" until a patient's own is known (ADR 0017). */
  timeZone: string;
}

const BrandContext = createContext<PatientBrand | null>(null);

export function BrandProvider({ brand, children }: { brand: PatientBrand; children: React.ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useBrand(): PatientBrand {
  const brand = useContext(BrandContext);
  if (!brand) throw new Error("useBrand is used outside the patient app");
  return brand;
}
