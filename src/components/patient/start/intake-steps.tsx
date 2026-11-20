"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import type { IntakeAnswers, IntakeStep, IntakeView } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { answerOf, fieldValueOf, QuestionField, type FieldValue } from "./question-field";
import { StopNotice, UnderAgeNotice } from "./stop-notice";

/**
 * An intake, one step at a time (docs/decisions/intake.md INT12 in
 * medora-backend): the step the API says is next, or an earlier one the
 * person went back to. Each step is saved as it is answered, so leaving
 * loses nothing. A hard stop, the age limit and a finished intake each have
 * their own screen; what comes after the last step is the caller's.
 *
 * The same screens serve an intake before an account and a patient's own;
 * only `save` differs.
 */
export function IntakeSteps({
  view,
  save,
  ready,
}: {
  view: IntakeView;
  save: (stepKey: string, answers: IntakeAnswers) => Promise<IntakeView>;
  ready: (change: (stepKey?: string) => void) => React.ReactNode;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  if (view.status === "ineligible") return <StopNotice stop={view.stop} />;
  if (view.status === "ended" && view.endedReason === "under_age") return <UnderAgeNotice />;

  const shown = view.steps.find((step) => step.key === (editing ?? view.currentStep));
  if (!shown) return <>{ready((stepKey) => setEditing(stepKey ?? view.steps[0]?.key ?? null))}</>;
  const index = view.steps.indexOf(shown);

  async function saved(stepKey: string, answers: IntakeAnswers) {
    const next = await save(stepKey, answers);
    // Walking back through finished steps goes on to the next finished one; otherwise to where the API says.
    const at = next.steps.findIndex((step) => step.key === stepKey);
    const following = at >= 0 ? next.steps[at + 1] : undefined;
    setEditing(editing && following?.done ? following.key : null);
    return next;
  }

  return (
    <StepForm
      key={shown.key}
      step={shown}
      number={index + 1}
      total={view.steps.length}
      saved={view.answers}
      revisiting={shown.done}
      onBack={index > 0 ? () => setEditing(view.steps[index - 1]!.key) : null}
      onSave={(answers) => saved(shown.key, answers)}
    />
  );
}

function StepForm({
  step,
  number,
  total,
  saved,
  revisiting,
  onBack,
  onSave,
}: {
  step: IntakeStep;
  number: number;
  total: number;
  saved: IntakeAnswers;
  revisiting: boolean;
  onBack: (() => void) | null;
  onSave: (answers: IntakeAnswers) => Promise<unknown>;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(step.questions.map((question) => [question.key, fieldValueOf(question, saved[question.key])])),
  );
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A new step replaces the last one: the reader's place moves to its heading.
  useEffect(() => {
    if (number > 1 || revisiting) heading.current?.focus();
  }, [number, revisiting]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const answers: IntakeAnswers = {};
    const found: Record<string, string> = {};
    for (const question of step.questions) {
      const read = answerOf(question, values[question.key] ?? null);
      if ("error" in read) found[question.key] = read.error;
      else if (read.answer !== undefined) answers[question.key] = read.answer;
    }
    setProblems(found);
    if (Object.keys(found).length > 0) return focusFirstProblem(step, found);
    setBusy(true);
    try {
      await onSave(answers);
    } catch (e) {
      const fromApi = problemsFrom(e);
      if (fromApi) {
        setProblems(fromApi);
        focusFirstProblem(step, fromApi);
      } else setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pt-card st-step" aria-labelledby={`step-${step.key}`}>
      <div className="st-progress">
        <span className="st-progress-text">
          Step {number} of {total}
        </span>
        <span className="st-progress-bar" aria-hidden>
          <span style={{ width: `${Math.round((number / Math.max(total, 1)) * 100)}%` }} />
        </span>
      </div>
      <div>
        <h2 className="pt-card-title st-step-title" id={`step-${step.key}`} ref={heading} tabIndex={-1}>
          {step.title}
        </h2>
        {step.intro ? <p className="pt-card-sub">{step.intro}</p> : null}
        {revisiting ? <p className="pt-card-sub">Changing an answer here can change the questions that come after it.</p> : null}
      </div>
      <form className="pt-form" onSubmit={(e) => void submit(e)} noValidate>
        {step.questions.map((question) => (
          <QuestionField
            key={question.key}
            question={question}
            value={values[question.key] ?? null}
            error={problems[question.key] ?? null}
            onChange={(value) => setValues((v) => ({ ...v, [question.key]: value }))}
          />
        ))}
        {Object.keys(problems).length > 0 ? (
          <p className="pt-error" role="alert">
            Check the answers marked above.
          </p>
        ) : null}
        {error ? (
          <p className="pt-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="pt-card-actions st-step-actions">
          <Button type="submit" disabled={busy}>
            Continue
          </Button>
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
              Back
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

/** Move to the first question with a problem, in the step's order. */
function focusFirstProblem(step: IntakeStep, problems: Record<string, string>) {
  const first = step.questions.find((question) => problems[question.key]);
  if (!first) return;
  const field = document.querySelector<HTMLElement>(`[data-question="${first.key}"] :is(input, textarea, button, [role="radio"], [role="checkbox"])`);
  field?.focus();
}

/** The API's per-question problems (400 answer_problems), in the patient's words. */
function problemsFrom(error: unknown): Record<string, string> | null {
  if (!(error instanceof ApiError) || error.code !== "answer_problems") return null;
  const list = (error.details as { problems?: { key?: unknown; message?: unknown }[] } | undefined)?.problems ?? [];
  const found: Record<string, string> = {};
  for (const problem of list) {
    if (typeof problem.key !== "string" || typeof problem.message !== "string") continue;
    found[problem.key] = problem.message.startsWith("Enter a date") ? "Enter the date as day, month and year." : `${problem.message}.`;
  }
  return Object.keys(found).length > 0 ? found : null;
}

/** What the API's other refusals mean to the person answering. */
export function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) return "We couldn't save that just now. Your earlier answers are kept. Try again.";
  switch (error.code) {
    case "step_not_reached":
      return "Answer the steps before this one first.";
    case "intake_closed":
      return "These answers are finished and can't be changed. Reload the page to see where they stand.";
    case "date_of_birth_differs":
      return "This intake was started with a different date of birth, so we can't show it. Start a new one.";
    case "too_many_requests":
      return "That's too many tries for now. Wait a few minutes, then try again.";
    default:
      return error.status >= 500 || error.status === 0 ? "We couldn't save that just now. Your earlier answers are kept. Try again." : error.message;
  }
}
