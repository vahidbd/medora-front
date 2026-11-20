import type { Metadata } from "next";
import { BreakGlassPage } from "./break-glass-page";

export const metadata: Metadata = { title: "Break-glass" };

export default function Page() {
  return <BreakGlassPage />;
}
