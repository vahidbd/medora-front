import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { StartClosed, StartFailed } from "@/components/patient/start/start-closed";
import { openPrograms, pageBrand } from "@/lib/server/start-pages";

export const metadata: Metadata = { title: "Get started" };
export const dynamic = "force-dynamic";

/**
 * Where a person lands without a program in the link: the brand's open
 * programs, straight to the one when there is only one (JOIN5).
 */
export default async function StartPage() {
  const { brand } = await pageBrand();
  const open = await openPrograms(brand);
  if (open.state === "failed") return <StartFailed />;
  if (open.state === "closed" || open.programs.length === 0) return <StartClosed />;
  if (open.programs.length === 1) redirect(`/start/${open.programs[0]!.programId}`);
  return (
    <div className="pt-page st-page">
      <div className="pt-head">
        <h1 className="pt-title">Get started with {brand.name}</h1>
        <p className="pt-lede">Choose what you&apos;d like help with. A few questions come first, then a clinician reviews your answers.</p>
      </div>
      <section className="pt-card" aria-label="Programs">
        <ul className="pt-list">
          {open.programs.map((program) => (
            <li key={program.programId} className="pt-row st-program">
              <Link href={`/start/${program.programId}`} className="st-program-link">
                <span className="pt-row-text">
                  <span className="pt-row-title">{program.name}</span>
                  {program.condition && program.condition !== program.name ? <span className="pt-row-sub">{program.condition}</span> : null}
                </span>
                <ChevronRight aria-hidden className="st-chevron" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
