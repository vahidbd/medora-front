import type { Metadata } from "next";
import { IntakeSummaryPage } from "./intake-summary-page";

export const metadata: Metadata = { title: "Intake summary" };

export default async function Page({ params }: { params: Promise<{ "patient-id": string; "intake-id": string }> }) {
  const { "patient-id": patientId, "intake-id": intakeId } = await params;
  return <IntakeSummaryPage patientId={patientId} intakeId={intakeId} />;
}
