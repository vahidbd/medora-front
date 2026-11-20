"use client";

import Link from "next/link";
import { CircleAlert, DoorClosed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrand } from "@/components/patient/brand-context";

/** The brand, or this program, takes no new patients now (JOIN9). An existing patient can still sign in. */
export function StartClosed() {
  const brand = useBrand();
  return (
    <div className="pt-page st-page">
      <section className="pt-card st-message" aria-labelledby="start-closed">
        <DoorClosed aria-hidden className="st-message-icon" />
        <h1 className="pt-card-title" id="start-closed">
          {brand.name} isn&apos;t taking new patients at the moment
        </h1>
        <p className="pt-text">
          <SupportLine />
        </p>
        <div className="pt-card-actions">
          <Link href="/sign-in?next=%2Fhome" className="btn btn-outline">
            Already a patient? Sign in
          </Link>
        </div>
      </section>
    </div>
  );
}

/** The API couldn't be asked: never looks like a closed brand (ADR 0031). */
export function StartFailed() {
  return (
    <div className="pt-page st-page">
      <section className="pt-card st-message" aria-labelledby="start-failed">
        <CircleAlert aria-hidden className="st-message-icon" />
        <h1 className="pt-card-title" id="start-failed">
          We couldn&apos;t load this page
        </h1>
        <p className="pt-text">This is a problem at our end. Try again in a moment.</p>
        <div className="pt-card-actions">
          {/* A full reload asks the server again. */}
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </section>
    </div>
  );
}

/** How to reach the brand, from its configuration. */
export function SupportLine() {
  const brand = useBrand();
  if (brand.supportEmail && brand.supportPhone) {
    return (
      <>
        For questions, contact {brand.name} at <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a> or{" "}
        <a href={`tel:${brand.supportPhone.replace(/\s/g, "")}`}>{brand.supportPhone}</a>.
      </>
    );
  }
  if (brand.supportEmail) {
    return (
      <>
        For questions, contact {brand.name} at <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.
      </>
    );
  }
  if (brand.supportPhone) {
    return (
      <>
        For questions, call {brand.name} on <a href={`tel:${brand.supportPhone.replace(/\s/g, "")}`}>{brand.supportPhone}</a>.
      </>
    );
  }
  return <>For questions, contact {brand.name}.</>;
}
