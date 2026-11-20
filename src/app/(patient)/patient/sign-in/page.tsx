import type { Metadata } from "next";
import { BrandRow } from "@/components/patient/patient-shell";
import { SignInFlow } from "@/components/patient/sign-in-flow";
import { safeNext } from "@/lib/safe-next";
import "@/styles/sections/patient.css";

export const metadata: Metadata = { title: "Sign in" };

/** Sign-in and sign-up by emailed code, in the brand's look (APP5). */
export default async function PatientSignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const why = params.why === "idle" ? "idle" : null;
  return (
    <div className="pt">
      <header className="pt-top">
        <div className="pt-top-in">
          <BrandRow />
        </div>
      </header>
      <main className="pt-main">
        <SignInFlow next={next} why={why} />
      </main>
    </div>
  );
}
