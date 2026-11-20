"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { patientKey } from "@/lib/api/patient";
import { consentApi } from "@/lib/api/start";
import type { ConsentDocument } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useBrand } from "@/components/patient/brand-context";
import { CardLoading, LoadFailed } from "@/components/patient/states";
import { StartClosed } from "./start-closed";

/**
 * The care consents a patient still needs before an intake goes on: the
 * tenant's privacy notice and telehealth terms, each in full and unticked
 * (docs/decisions/patient-start.md JOIN13; patients.md IDN12, IDN13 in
 * medora-backend). A new version asks again. Nothing here is marketing.
 */
const CARE = new Set(["privacy", "telehealth_terms"]);

/** What each care document is called in a sentence; the document's own title heads its text. */
const CALLED: Record<string, string> = { privacy: "privacy notice", telehealth_terms: "telehealth terms" };

export function CareConsents({ onAgreed }: { onAgreed: () => void }) {
  const { host } = useBrand();
  const queryClient = useQueryClient();
  const consents = useQuery({ queryKey: patientKey(host, "consents"), queryFn: consentApi.list, retry: false });
  const needed = consents.data?.consents.filter((state) => state.needed && CARE.has(state.kind));
  const nothingNeeded = needed?.length === 0;

  // Already agreed (what sent the person here was out of date): carry on.
  useEffect(() => {
    if (nothingNeeded) onAgreed();
  }, [nothingNeeded, onAgreed]);

  if (consents.isPending || nothingNeeded) return <CardLoading label="Loading the terms" />;
  if (consents.isError || !needed) return <LoadFailed what="the terms" onRetry={() => void consents.refetch()} />;
  // A kind the tenant hasn't published can't be agreed to: the API takes no one new until it is.
  if (needed.some((state) => state.document === null)) return <StartClosed />;
  const documents = needed.map((state) => state.document!);
  return (
    <ConsentForm
      documents={documents}
      onAgreed={async () => {
        await queryClient.invalidateQueries({ queryKey: patientKey(host, "me") });
        onAgreed();
      }}
      onChanged={() => void consents.refetch()}
    />
  );
}

function ConsentForm({ documents, onAgreed, onChanged }: { documents: ConsentDocument[]; onAgreed: () => Promise<void>; onChanged: () => void }) {
  const brand = useBrand();
  const id = useId();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // This screen replaces the one the person was on: their place moves to its heading.
  useEffect(() => heading.current?.focus(), []);

  const agree = useMutation({
    mutationFn: async () => {
      for (const document of documents) await consentApi.agree(document.documentId);
    },
    onSuccess: onAgreed,
    onError: (e) => {
      // A newer version was published since this screen loaded: show it, unticked.
      if (e instanceof ApiError && e.code === "not_current_version") {
        setTicked(new Set());
        onChanged();
      }
      fail(e instanceof ApiError && e.code === "not_current_version" ? "The terms have just changed. Read the new version, then tick to agree again." : "We couldn't save that just now. Try again.");
    },
  });

  function fail(message: string) {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (documents.some((document) => !ticked.has(document.documentId))) return fail("Read each one and tick to agree, to go on.");
    agree.mutate();
  }

  return (
    <section className="pt-card st-step" aria-labelledby={`${id}-title`}>
      <div>
        <h2 className="pt-card-title" id={`${id}-title`} ref={heading} tabIndex={-1}>
          {documents.length === 1 ? `Agree to ${brand.name}'s ${CALLED[documents[0]!.kind]}` : `Agree to ${brand.name}'s terms`}
        </h2>
        <p className="pt-card-sub">Your clinician needs these before they can look after you online.</p>
      </div>
      <form className="pt-form" onSubmit={submit} noValidate>
        {documents.map((document) => {
          const paragraphs = document.body.split(/\n\s*\n/).filter((p) => p.trim());
          return (
            <div key={document.documentId} className="pt-form">
              <div className="st-notice" role="region" aria-labelledby={`${id}-${document.kind}`} tabIndex={0}>
                <h3 className="st-notice-title" id={`${id}-${document.kind}`}>
                  {document.title}
                </h3>
                {paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
              <label className="st-check">
                <Checkbox
                  checked={ticked.has(document.documentId)}
                  onCheckedChange={(checked) =>
                    setTicked((current) => {
                      const next = new Set(current);
                      if (checked === true) next.add(document.documentId);
                      else next.delete(document.documentId);
                      return next;
                    })
                  }
                />
                <span>
                  {document.kind === "privacy"
                    ? `I've read the privacy notice, and I agree to ${brand.name} collecting my health information to assess and provide my care.`
                    : `I've read the ${CALLED[document.kind] ?? lowerFirst(document.title)}, and I agree to them.`}
                </span>
              </label>
            </div>
          );
        })}
        {error ? (
          <p className="pt-error" role="alert" ref={errorRef} tabIndex={-1}>
            {error}
          </p>
        ) : null}
        <div className="pt-card-actions st-step-actions">
          <Button type="submit" disabled={agree.isPending}>
            Agree and continue
          </Button>
        </div>
      </form>
    </section>
  );
}

/** A document's title in the middle of a sentence ("Telehealth terms" reads "telehealth terms"). */
function lowerFirst(title: string): string {
  return title ? title.charAt(0).toLowerCase() + title.slice(1) : title;
}
