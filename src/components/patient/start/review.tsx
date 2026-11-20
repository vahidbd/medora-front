"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import type { IntakeAnswer, IntakeQuestion, IntakeView } from "@/lib/api/types";
import { formatCalendarDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useBrand } from "@/components/patient/brand-context";
import { messageFor } from "./intake-steps";

/**
 * The last screens of a patient's intake (docs/decisions/patient-start.md
 * JOIN14): their own answers, step by step, each step with a way to change
 * it, and one button that sends them to a clinician. Sending can still end
 * in a hard stop (INT12), which the caller shows as it shows any other.
 */
export function ReviewAndSend({
  view,
  onChange,
  send,
  onConsentNeeded,
}: {
  view: IntakeView;
  onChange: (stepKey: string) => void;
  send: () => Promise<IntakeView>;
  onConsentNeeded: () => void;
}) {
  const brand = useBrand();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The review replaces the last step: the reader's place moves to its heading.
  useEffect(() => heading.current?.focus(), []);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await send();
    } catch (e) {
      if (e instanceof ApiError && e.code === "consent_needed") return onConsentNeeded();
      const step = e instanceof ApiError && e.code === "intake_unfinished" ? (e.details as { step?: unknown } | undefined)?.step : undefined;
      if (typeof step === "string") return onChange(step);
      setError(messageFor(e));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pt-card st-step" aria-labelledby={`${id}-title`}>
      <div>
        <h2 className="pt-card-title" id={`${id}-title`} ref={heading} tabIndex={-1}>
          Check your answers
        </h2>
        <p className="pt-card-sub">
          A clinician at {brand.name} reads these before any treatment. Changing an answer can change the questions after it, so you may be asked some again.
        </p>
      </div>
      {view.steps.map((step) => (
        <section key={step.key} className="st-review" aria-labelledby={`${id}-${step.key}`}>
          <div className="st-review-head">
            <h3 className="st-review-title" id={`${id}-${step.key}`}>
              {step.title}
            </h3>
            <Button variant="outline" size="sm" onClick={() => onChange(step.key)} aria-label={`Change ${step.title}`}>
              Change
            </Button>
          </div>
          <dl className="st-review-list">
            {step.questions.map((question) => (
              <div key={question.key} className="st-review-row">
                <dt>{question.label}</dt>
                <dd>{answerText(question, view.answers[question.key])}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      {error ? (
        <p className="pt-error" role="alert" ref={errorRef} tabIndex={-1}>
          {error}
        </p>
      ) : null}
      <div className="pt-card-actions st-step-actions">
        <Button onClick={() => void submit()} disabled={busy}>
          Send to a clinician
        </Button>
      </div>
    </section>
  );
}

/** Sent. No promise of a time, and never read as an emergency service (APP12). */
export function Sent() {
  const brand = useBrand();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="pt-card st-message" aria-labelledby="intake-sent">
      <CircleCheck aria-hidden className="st-message-icon st-sent-icon" />
      <h2 className="pt-card-title" id="intake-sent" ref={heading} tabIndex={-1}>
        Your answers are with {brand.name}
      </h2>
      <p className="pt-text">A clinician will read them and the care team will contact you about what happens next.</p>
      <p className="pt-muted">If you need urgent help, call <a href="tel:000">000</a>.</p>
      <div className="pt-card-actions">
        <Link href="/home" className="btn btn-primary">
          Go to Home
        </Link>
      </div>
    </section>
  );
}

/** One answer as the patient gave it: the option's words, the unit, an Australian date. */
export function answerText(question: IntakeQuestion, answer: IntakeAnswer | undefined): string {
  if (answer === undefined || answer === null || answer === "" || (Array.isArray(answer) && answer.length === 0)) {
    return question.kind === "multi_choice" ? "None" : "Not answered";
  }
  const labelOf = (value: string) => question.options?.find((option) => option.value === value)?.label ?? value;
  switch (question.kind) {
    case "yes_no":
      return answer === true ? "Yes" : "No";
    case "single_choice":
      return labelOf(String(answer));
    case "multi_choice": {
      // In the protocol's order, whatever order they were ticked in.
      const chosen = (Array.isArray(answer) ? answer : [answer]).map(String);
      const order = (question.options ?? []).map((option) => option.value);
      const rank = (value: string) => (order.includes(value) ? order.indexOf(value) : order.length);
      return [...chosen].sort((a, b) => rank(a) - rank(b)).map(labelOf).join(", ");
    }
    case "number":
      return question.unit ? `${answer} ${question.unit}` : String(answer);
    case "date":
      return formatCalendarDate(String(answer));
    default:
      return String(answer);
  }
}
