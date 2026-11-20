import type { Metadata } from "next";
import { PatientProgressPage } from "@/components/patient/pages/progress-page";

export const metadata: Metadata = { title: "Progress" };

export default function Page() {
  return <PatientProgressPage />;
}
