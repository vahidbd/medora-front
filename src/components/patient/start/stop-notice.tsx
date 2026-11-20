"use client";

import { useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";
import { useBrand } from "@/components/patient/brand-context";
import { SupportLine } from "./start-closed";

/*
 * The screens that end an intake (docs/decisions/patient-start.md JOIN8).
 * The reason is the protocol's own words for the patient, never the rule
 * the prescriber sees, and it appears only on the page: never in its
 * address or title. Neither screen offers a way to try again.
 */

/** A hard stop ended the intake. When the protocol asks for it, how to get urgent help comes first. */
export function StopNotice({ stop }: { stop: { message: string; urgentHelp: boolean } | null }) {
  const heading = useFocusOnArrival();
  return (
    <section className="pt-card st-message" aria-labelledby="intake-stopped">
      {stop?.urgentHelp ? <UrgentHelp /> : null}
      <h2 className="pt-card-title" id="intake-stopped" ref={heading} tabIndex={-1}>
        We can&apos;t continue online
      </h2>
      <p className="pt-text st-stop-message">{stop?.message || "From your answers, this program isn't the right care for you online."}</p>
      <p className="pt-muted">
        <SupportLine />
      </p>
    </section>
  );
}

/** The date of birth given at the start is under 18 (IDN-03). Nothing else was asked. */
export function UnderAgeNotice() {
  const brand = useBrand();
  const heading = useFocusOnArrival();
  return (
    <section className="pt-card st-message" aria-labelledby="intake-under-age">
      <h2 className="pt-card-title" id="intake-under-age" ref={heading} tabIndex={-1}>
        This service is for adults
      </h2>
      <p className="pt-text">{brand.name} can only treat people aged 18 and over.</p>
      <p className="pt-muted">
        <SupportLine />
      </p>
    </section>
  );
}

/**
 * The same national words on every brand, so no tenant can leave them out
 * (APP12): 000 for danger, Lifeline to talk to someone now.
 */
export function UrgentHelp() {
  return (
    <div className="pt-note is-danger" role="note">
      <TriangleAlert aria-hidden />
      <span>
        <strong>
          If you&apos;re in danger or need urgent help, call <a href="tel:000">000</a>.
        </strong>{" "}
        To talk to someone now, call Lifeline on <a href="tel:131114">13 11 14</a>, any time.
      </span>
    </div>
  );
}

/** The screen replaced a step the person was answering: their place moves to its heading. */
function useFocusOnArrival() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return heading;
}
