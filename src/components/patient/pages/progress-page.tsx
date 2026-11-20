"use client";

import Link from "next/link";
import { ChartLine } from "lucide-react";
import { useBrand } from "@/components/patient/brand-context";
import { MeasurementCard, RecordMeasurements } from "@/components/patient/measurement-cards";
import { SideEffectsCard } from "@/components/patient/side-effects-card";
import { CardLoading, LoadFailed } from "@/components/patient/states";
import { useSignedInPatient } from "@/components/patient/use-patient";
import { useMeasurements } from "@/components/patient/use-tracking";
import { kindsToTrack } from "@/lib/measurement-kinds";

/**
 * Progress (APP-03, ADH-01): the measurements the patient's programs ask
 * for, each over time, and the side effects they have reported. A check-in
 * starts here and from Home.
 */
export function PatientProgressPage() {
  const me = useSignedInPatient();
  const brand = useBrand();
  const timeZone = me.timeZone ?? brand.timeZone;
  const measurements = useMeasurements();
  return (
    <div className="pt-page">
      <div className="pt-head pt-head-row">
        <div className="pt-head">
          <h1 className="pt-title">Your progress</h1>
          <p className="pt-lede">Your measurements over time, and side effects you&apos;ve told your care team about.</p>
        </div>
        <Link href="/progress/check-in" className="btn btn-primary">
          Check in
        </Link>
      </div>

      {measurements.isPending ? (
        <section className="pt-card">
          <CardLoading label="Loading your measurements" />
        </section>
      ) : measurements.isError ? (
        <section className="pt-card">
          <LoadFailed what="your measurements" onRetry={() => void measurements.refetch()} />
        </section>
      ) : (
        <Measurements kinds={kindsToTrack(me.programs, measurements.data)} readings={measurements.data} timeZone={timeZone} />
      )}

      <SideEffectsCard timeZone={timeZone} />
    </div>
  );
}

function Measurements({ kinds, readings, timeZone }: { kinds: ReturnType<typeof kindsToTrack>; readings: NonNullable<ReturnType<typeof useMeasurements>["data"]>; timeZone: string }) {
  if (kinds.length === 0) {
    return (
      <section className="pt-card" aria-label="Measurements">
        <div className="pt-empty">
          <ChartLine aria-hidden />
          <p className="pt-empty-title">Nothing to measure yet</p>
          <p>When your program asks you to keep track of something, like your weight, it shows here.</p>
        </div>
      </section>
    );
  }
  return (
    <>
      <RecordMeasurements kinds={kinds} timeZone={timeZone} />
      {kinds.map((kind) => (
        <MeasurementCard key={kind} kind={kind} readings={readings.filter((m) => m.kind === kind)} timeZone={timeZone} />
      ))}
    </>
  );
}
