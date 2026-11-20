"use client";

import { Button } from "@/components/ui/button";
import { GateCard } from "@/components/patient/patient-gate";

/** A patient page that couldn't load. It says nothing changed, and never looks like an empty account. */
export default function PatientPageError({ reset }: { error: unknown; reset: () => void }) {
  return (
    <GateCard>
      <h1 className="gate-title">This page is unavailable at the moment</h1>
      <p className="gate-text">Nothing has changed. Try again in a moment.</p>
      <div className="gate-actions">
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </GateCard>
  );
}
