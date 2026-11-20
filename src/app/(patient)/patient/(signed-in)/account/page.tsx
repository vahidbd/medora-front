import type { Metadata } from "next";
import { PatientAccountPage } from "@/components/patient/pages/account-page";

export const metadata: Metadata = { title: "Your account" };

export default function Page() {
  return <PatientAccountPage />;
}
