import type { Metadata } from "next";
import { ProgramsPage } from "./programs-page";

export const metadata: Metadata = { title: "Programs" };

export default function Page() {
  return <ProgramsPage />;
}
