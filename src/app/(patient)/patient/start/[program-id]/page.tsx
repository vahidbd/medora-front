import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StartClosed, StartFailed } from "@/components/patient/start/start-closed";
import { StartFlow } from "@/components/patient/start/start-flow";
import { heldIntakeId, pageBrand, startScreen } from "@/lib/server/start-pages";

export const metadata: Metadata = { title: "Get started" };
export const dynamic = "force-dynamic";

/**
 * One program's intake, before an account: its first screen from the API,
 * and the intake this browser already holds for it, if any, to pick up
 * where it was left (JOIN7). The page learns the intake's id, never its
 * token.
 */
export default async function StartProgramPage({ params }: { params: Promise<{ "program-id": string }> }) {
  const programId = (await params)["program-id"];
  const { brand } = await pageBrand();
  const screen = await startScreen(brand, programId);
  if (screen.state === "missing") notFound();
  if (screen.state === "failed") return <StartFailed />;
  // A brand that has paused takes no more answers, even on an intake already started here (JOIN9).
  if (screen.state === "closed") return <StartClosed />;
  return <StartFlow programId={programId} screen={screen.screen} heldIntakeId={await heldIntakeId(programId)} />;
}
