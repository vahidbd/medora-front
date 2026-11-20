import type { Metadata } from "next";
import { PatientsPage } from "./patients-page";

export const metadata: Metadata = { title: "Patients" };

export default function Page() {
  return <PatientsPage />;
}
