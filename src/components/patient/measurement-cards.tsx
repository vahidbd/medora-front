"use client";

import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { patientApi } from "@/lib/api/patient";
import type { Measurement, MeasurementKind } from "@/lib/api/types";
import { addDays } from "@/lib/check-in-due";
import { formatShortDay } from "@/lib/format";
import { MEASUREMENT_KINDS, formatReading } from "@/lib/measurement-kinds";
import { dateIn, formatDateTimeIn, instantOn } from "@/lib/patient-time";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MeasurementChart } from "./measurement-chart";
import { ReadingFields, readingsFrom, trackingErrorMessage, type ReadingValues } from "./tracking-fields";
import { useTrackingRefresh } from "./use-tracking";

/** The readings a patient records, for the kinds they track (TRK1, TRK2). */
export function RecordMeasurements({ kinds, timeZone }: { kinds: readonly MeasurementKind[]; timeZone: string }) {
  const id = useId();
  const refresh = useTrackingRefresh();
  const [values, setValues] = useState<ReadingValues>({});
  const [when, setWhen] = useState<"today" | "earlier">("today");
  const [day, setDay] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const today = dateIn(new Date(), timeZone);

  const record = useMutation({
    mutationFn: patientApi.recordMeasurements,
    onSuccess: async () => {
      setValues({});
      setWhen("today");
      setDay("");
      setSaved(true);
      await refresh();
    },
    onError: (e) => setError(trackingErrorMessage(e)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const result = readingsFrom(kinds, values);
    if ("error" in result) return setError(result.error);
    if (result.readings.length === 0) return setError("Enter at least one reading.");
    if (when === "earlier" && !day) return setError("Choose the day you took them.");
    // A day before today is dated at noon there; today is now (TRK2).
    const measuredAt = when === "earlier" && day < today ? instantOn(day, "12:00", timeZone).toISOString() : undefined;
    record.mutate({ readings: result.readings, ...(measuredAt ? { measuredAt } : {}) });
  }

  return (
    <section className="pt-card" aria-labelledby={`${id}-title`}>
      <div>
        <h2 className="pt-card-title" id={`${id}-title`}>
          Record a measurement
        </h2>
        <p className="pt-card-sub">Fill in what you measured. Leave the rest blank.</p>
      </div>
      <form className="pt-form" onSubmit={submit} noValidate>
        <ReadingFields kinds={kinds} values={values} onChange={(kind, value) => setValues((v) => ({ ...v, [kind]: value }))} />
        <div className="pt-field">
          <span className="pt-label" id={`${id}-when`}>
            When did you take them?
          </span>
          <RadioGroup value={when} onValueChange={(value) => setWhen(value === "earlier" ? "earlier" : "today")} aria-labelledby={`${id}-when`} className="pt-choices">
            <label className="pt-choice">
              <RadioGroupItem value="today" />
              <span>Today</span>
            </label>
            <label className="pt-choice">
              <RadioGroupItem value="earlier" />
              <span>Another day</span>
            </label>
          </RadioGroup>
        </div>
        {when === "earlier" ? (
          <div className="pt-field">
            <label className="pt-label" htmlFor={`${id}-day`}>
              Day
            </label>
            <p className="pt-hint">In the last 30 days</p>
            <DateField id={`${id}-day`} min={addDays(today, -29)} max={today} value={day} onValueChange={setDay} />
          </div>
        ) : null}
        {error ? (
          <p className="pt-error" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="pt-success" role="status">
            Saved. Your care team can see it.
          </p>
        ) : null}
        <div className="pt-card-actions">
          <Button type="submit" disabled={record.isPending}>
            Save
          </Button>
        </div>
      </form>
    </section>
  );
}

/** One kind over time: the latest reading, how it has moved, the chart and every reading as a table. */
export function MeasurementCard({ kind, readings, timeZone }: { kind: MeasurementKind; readings: readonly Measurement[]; timeZone: string }) {
  const id = useId();
  const { label } = MEASUREMENT_KINDS[kind];
  const latest = readings[0];
  const first = readings.at(-1);
  const day = (at: string) => formatShortDay(dateIn(new Date(at), timeZone));
  return (
    <section className="pt-card" aria-labelledby={`${id}-title`}>
      <div className="pt-card-head">
        <div>
          <h2 className="pt-card-title" id={`${id}-title`}>
            {label}
          </h2>
          <p className="pt-card-sub">{latest && first ? change(kind, latest, first, day) : `No ${label.toLowerCase()} recorded yet.`}</p>
        </div>
        {latest ? (
          <p className="pt-stat">
            <strong>{formatReading(kind, latest.value)}</strong>
            <span>{day(latest.measuredAt)}</span>
          </p>
        ) : null}
      </div>
      {readings.length > 0 ? (
        <>
          <MeasurementChart kind={kind} readings={readings} timeZone={timeZone} />
          <details className="pt-details">
            <summary>See every reading</summary>
            <table className="table pt-table">
              <caption className="pt-hidden">Every {label.toLowerCase()} reading, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Taken</th>
                  <th scope="col">{label}</th>
                  <th scope="col">Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((reading) => (
                  <tr key={reading.measurementId}>
                    <td>{formatDateTimeIn(reading.measuredAt, timeZone)}</td>
                    <td>{formatReading(kind, reading.value)}</td>
                    <td>{reading.recordedBy === "care_team" ? "Your care team" : "You"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : null}
    </section>
  );
}

/** "Down 2.2 kg since 16 Oct", in words that don't judge: what counts as better is the care team's to say. */
function change(kind: MeasurementKind, latest: Measurement, first: Measurement, day: (at: string) => string): string {
  if (latest.measurementId === first.measurementId) return `First recorded ${day(first.measuredAt)}`;
  const difference = Math.round((latest.value - first.value) * 10) / 10;
  if (difference === 0) return `No change since ${day(first.measuredAt)}`;
  return `${difference < 0 ? "Down" : "Up"} ${formatReading(kind, Math.abs(difference))} since ${day(first.measuredAt)}`;
}
