import type { Metadata } from "next";
import { CliniciansPage } from "./clinicians-page";

export const metadata: Metadata = { title: "Clinicians" };

export default function Page() {
  return <CliniciansPage />;
}
