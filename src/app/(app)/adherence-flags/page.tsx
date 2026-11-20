import type { Metadata } from "next";
import { AdherenceFlagsPage } from "./adherence-flags-page";

export const metadata: Metadata = { title: "Adherence flags" };

export default function Page() {
  return <AdherenceFlagsPage />;
}
