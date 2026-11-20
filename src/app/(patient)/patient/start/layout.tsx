import { StartFrame } from "@/components/patient/start/start-frame";

/** Starting care: the brand's row and the page, open to anyone on the brand's host (docs/decisions/patient-start.md). */
export default function StartLayout({ children }: { children: React.ReactNode }) {
  return <StartFrame>{children}</StartFrame>;
}
