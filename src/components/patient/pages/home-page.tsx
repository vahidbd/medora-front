"use client";

import { LifeBuoy, Phone } from "lucide-react";
import { useBrand } from "@/components/patient/brand-context";
import { useSignedInPatient } from "@/components/patient/use-patient";
import { greetingFor } from "@/lib/patient-time";

/**
 * Home: what is next in the patient's care, then how to get help (APP-02).
 * A card appears only once the part of Medora behind it exists; until
 * then Home says less rather than showing something made up.
 */
export function PatientHomePage() {
  const me = useSignedInPatient();
  const brand = useBrand();
  return (
    <div className="pt-page">
      <div className="pt-head">
        <h1 className="pt-title">
          {greetingFor(new Date(), me.timeZone ?? brand.timeZone)}, {me.preferredName ?? me.givenName}
        </h1>
        <p className="pt-lede">Here&apos;s what&apos;s next in your care with {brand.name}.</p>
      </div>
      <HelpCard />
    </div>
  );
}

/** How to reach a person, and 000 for anything that can't wait. */
export function HelpCard() {
  const brand = useBrand();
  return (
    <section className="pt-card" aria-labelledby="help-title">
      <div>
        <h2 className="pt-card-title" id="help-title">
          Need help?
        </h2>
        <p className="pt-card-sub">For a medical emergency, call 000. Messages to your care team aren&apos;t for emergencies.</p>
      </div>
      <ul className="pt-facts">
        {brand.supportEmail ? (
          <li className="pt-fact">
            <LifeBuoy className="pt-fact-icon" aria-hidden />
            <span className="pt-fact-text">
              <strong>Email {brand.name}</strong>
              <a className="pt-muted" href={`mailto:${brand.supportEmail}`}>
                {brand.supportEmail}
              </a>
            </span>
          </li>
        ) : null}
        {brand.supportPhone ? (
          <li className="pt-fact">
            <Phone className="pt-fact-icon" aria-hidden />
            <span className="pt-fact-text">
              <strong>Call {brand.name}</strong>
              <a className="pt-muted" href={`tel:${brand.supportPhone.replace(/\s+/g, "")}`}>
                {brand.supportPhone}
              </a>
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
