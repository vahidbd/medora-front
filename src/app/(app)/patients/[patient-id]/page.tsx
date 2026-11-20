import type { Metadata } from "next";
import { PatientPage } from "./patient-page";

export const metadata: Metadata = { title: "Patient" };

export default async function Page({ params }: { params: Promise<{ "patient-id": string }> }) {
  const { "patient-id": patientId } = await params;
  return <PatientPage patientId={patientId} />;
}
