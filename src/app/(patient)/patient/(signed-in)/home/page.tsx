import type { Metadata } from "next";
import { PatientHomePage } from "@/components/patient/pages/home-page";

export const metadata: Metadata = { title: "Home" };

export default function Page() {
  return <PatientHomePage />;
}
