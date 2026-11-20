"use client";

import Link from "next/link";
import { GateCard } from "@/components/patient/patient-gate";

/** A pasted link or an old bookmark on a brand's patient host that leads nowhere. */
export default function PatientNotFound() {
  return (
    <GateCard>
      <h1 className="gate-title">Page not found</h1>
      <p className="gate-text">Nothing lives at this address. The link may be cut short, or the page has moved.</p>
      <div className="gate-actions">
        <Link href="/home" className="btn btn-primary">
          Go to Home
        </Link>
      </div>
    </GateCard>
  );
}
