"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { patientApi, patientKey } from "@/lib/api/patient";
import { useBrand } from "./brand-context";

/*
 * The patient's measurements, side effects and check-ins, keyed by the
 * brand's host like every patient query (APP3). A write refreshes all
 * three, since a check-in carries readings and a side effect.
 */

export function useMeasurements() {
  const { host } = useBrand();
  return useQuery({ queryKey: patientKey(host, "measurements"), queryFn: patientApi.measurements, select: (reply) => reply.measurements });
}

export function useSideEffects() {
  const { host } = useBrand();
  return useQuery({ queryKey: patientKey(host, "side-effects"), queryFn: patientApi.sideEffects, select: (reply) => reply.sideEffects });
}

export function useCheckIns() {
  const { host } = useBrand();
  return useQuery({ queryKey: patientKey(host, "check-ins"), queryFn: patientApi.checkIns, select: (reply) => reply.checkIns });
}

/** After a write: everything tracked is read again. */
export function useTrackingRefresh() {
  const { host } = useBrand();
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["measurements", "side-effects", "check-ins"].map((name) => queryClient.invalidateQueries({ queryKey: patientKey(host, name) })),
    );
}
