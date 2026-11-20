import { PatientGate } from "@/components/patient/patient-gate";

/** Signed in, and known to the API as a patient of this brand's tenant; then the frame. */
export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return <PatientGate>{children}</PatientGate>;
}
