"use client";

import { useQuery } from "@tanstack/react-query";
import { patientApi, patientKey } from "@/lib/api/patient";
import { useBrand } from "./brand-context";

/** The signed-in patient, as this brand's tenant knows them. */
export function usePatientMe(enabled = true) {
  const { host } = useBrand();
  return useQuery({ queryKey: patientKey(host, "me"), queryFn: patientApi.me, retry: false, enabled });
}

/** Inside the signed-in frame, where the gate has already loaded the patient. */
export function useSignedInPatient() {
  const me = usePatientMe();
  if (!me.data) throw new Error("useSignedInPatient is used outside the signed-in patient frame");
  return me.data;
}
