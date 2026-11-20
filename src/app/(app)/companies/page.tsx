import type { Metadata } from "next";
import { CompaniesPage } from "./companies-page";

export const metadata: Metadata = { title: "Companies" };

export default function Page() {
  return <CompaniesPage />;
}
