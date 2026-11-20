"use client";

import Link from "next/link";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import type { PatientMe } from "@/lib/api/types";
import { nextCheckIn } from "@/lib/check-in-due";
import { formatCalendarDay, formatShortDay } from "@/lib/format";
import { MEASUREMENT_KINDS, formatReading, kindsToTrack } from "@/lib/measurement-kinds";
import { dateIn } from "@/lib/patient-time";
import { CardLoading, LoadFailed } from "./states";
import { useCheckIns, useMeasurements } from "./use-tracking";

/*
 * Home's cards for what the patient records: when the next check-in is due
 * (TRK6) and their latest measurements. Each appears only when a program
 * asks for it (APP6).
 */

export function NextCheckInCard({ me, timeZone }: { me: PatientMe; timeZone: string }) {
  const checkIns = useCheckIns();
  if (!me.programs.some((p) => p.checkInEveryDays)) return null;
  return (
    <section className="pt-card" aria-labelledby="next-title">
      <h2 className="pt-card-title" id="next-title">
        What&apos;s next
      </h2>
      {checkIns.isPending ? (
        <CardLoading label="Loading your check-ins" />
      ) : checkIns.isError ? (
        <LoadFailed what="your check-ins" onRetry={() => void checkIns.refetch()} />
      ) : (
        <CheckInItem me={me} timeZone={timeZone} lastSubmittedAt={checkIns.data[0]?.submittedAt ?? null} />
      )}
    </section>
  );
}

function CheckInItem({ me, timeZone, lastSubmittedAt }: { me: PatientMe; timeZone: string; lastSubmittedAt: string | null }) {
  const next = nextCheckIn({ programs: me.programs, lastSubmittedAt, createdAt: me.createdAt, timeZone, now: new Date() });
  if (!next) return null;
  const today = dateIn(new Date(), timeZone);
  const title = next.isDue ? "Your check-in is due" : "Your next check-in";
  const detail = next.isDue
    ? next.dueOn < today
      ? `It was due ${formatCalendarDay(next.dueOn)}. A few questions about how your treatment is going.`
      : "A few questions about how your treatment is going. It takes a minute."
    : `Due ${formatCalendarDay(next.dueOn)}. You can check in sooner if something has changed.`;
  return (
    <ul className="pt-todo">
      <li className="pt-todo-item">
        <span className="pt-todo-icon">
          <ClipboardCheck aria-hidden />
        </span>
        <span className="pt-todo-text">
          <span className="pt-todo-title">{title}</span>
          <span className="pt-todo-detail">{detail}</span>
        </span>
        <Link href="/progress/check-in" className={next.isDue ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}>
          Check in
        </Link>
      </li>
    </ul>
  );
}

export function LatestMeasurementsCard({ me, timeZone }: { me: PatientMe; timeZone: string }) {
  const measurements = useMeasurements();
  const kinds = kindsToTrack(me.programs, measurements.data ?? []);
  if (kinds.length === 0) return null;
  return (
    <section className="pt-card" aria-labelledby="latest-title">
      <div className="pt-card-head">
        <h2 className="pt-card-title" id="latest-title">
          Your progress
        </h2>
        <Link href="/progress" className="pt-cardlink">
          See your progress
          <ChevronRight aria-hidden />
        </Link>
      </div>
      {measurements.isPending ? (
        <CardLoading label="Loading your measurements" />
      ) : measurements.isError ? (
        <LoadFailed what="your measurements" onRetry={() => void measurements.refetch()} />
      ) : (
        <ul className="pt-list">
          {kinds.map((kind) => {
            const latest = measurements.data.find((m) => m.kind === kind);
            return (
              <li key={kind} className="pt-row">
                <span className="pt-row-text">
                  <span className="pt-row-title">{MEASUREMENT_KINDS[kind].label}</span>
                  <span className="pt-row-sub">{latest ? formatShortDay(dateIn(new Date(latest.measuredAt), timeZone)) : "Not recorded yet"}</span>
                </span>
                <span className="pt-row-end">{latest ? <span className="pt-figure">{formatReading(kind, latest.value)}</span> : null}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
