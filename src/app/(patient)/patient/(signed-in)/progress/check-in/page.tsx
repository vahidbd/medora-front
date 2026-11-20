import type { Metadata } from "next";
import { PatientCheckInPage } from "@/components/patient/pages/check-in-page";

export const metadata: Metadata = { title: "Check in" };

export default function Page() {
  return <PatientCheckInPage />;
}
