"use client";

import { useEffect } from "react";
import { patientApi } from "@/lib/api/patient";

/**
 * Tells the API the patient opened their app, once each time the signed-in
 * frame loads; the API counts one a day on the patient's calendar
 * (docs/decisions/adherence.md ADH2 in medora-backend, ADR 0260). It is a
 * signal for the care team, not something the patient waits on, so a
 * failure changes nothing on screen.
 */
export function useAppOpened(): void {
  useEffect(() => {
    patientApi.appOpened().catch(() => undefined);
  }, []);
}
