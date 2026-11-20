import type { Metadata } from "next";
import { ClinicianPage } from "./clinician-page";

export const metadata: Metadata = { title: "Clinician" };

export default async function Page({ params }: { params: Promise<{ "clinician-id": string }> }) {
  const { "clinician-id": clinicianId } = await params;
  return <ClinicianPage clinicianId={clinicianId} />;
}
