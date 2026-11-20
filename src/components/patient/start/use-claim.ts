"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { patientKey } from "@/lib/api/patient";
import { startApi } from "@/lib/api/start";
import { useBrand } from "@/components/patient/brand-context";

/**
 * Claim what this browser started before signing in, once the patient is
 * known and has confirmed their date of birth (docs/decisions/patient-start.md
 * JOIN12, INT6). It runs once per page load on the brand's host: the server
 * answers at once when nothing is held, and a claim that fails keeps the
 * cookie, so the next load tries again. Claiming twice claims nothing more.
 */
export function useClaimHeld(enabled: boolean) {
  const { host } = useBrand();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: patientKey(host, "claim"),
    queryFn: async () => {
      const result = await startApi.claim();
      if (result.claimed.length > 0) {
        // A claim records the privacy consent each intake was started under, and adds intakes to the patient's own.
        await queryClient.invalidateQueries({ queryKey: patientKey(host, "me") });
        await queryClient.invalidateQueries({ queryKey: patientKey(host, "intakes") });
      }
      return result;
    },
    enabled,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
