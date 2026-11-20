import type { Metadata } from "next";
import { ConsentDocumentsPage } from "./consent-documents-page";

export const metadata: Metadata = { title: "Consent documents" };

export default function Page() {
  return <ConsentDocumentsPage />;
}
