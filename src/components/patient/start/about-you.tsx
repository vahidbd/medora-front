"use client";

import { useId, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { startApi, type AccountDetails } from "@/lib/api/start";
import type { Sex } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { parseTypedDate } from "@/components/ui/date-field";
import { useBrand } from "@/components/patient/brand-context";

/**
 * Making the account, once signed in (docs/decisions/patient-start.md
 * JOIN11): the legal names as on the person's ID, the date of birth typed
 * again, sex with why it is asked, and a mobile if they want texts. The
 * email is the one they signed in with. The server adds this host's brand
 * and claims what the browser started (JOIN3).
 */

type Field = "givenName" | "familyName" | "preferredName" | "dateOfBirth" | "sex" | "mobile";

const SEXES: { value: Sex; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "intersex", label: "Intersex" },
  { value: "not_stated", label: "Prefer not to say" },
];

/** What the API's refusal means for this screen: a field to fix, a screen to show instead, or a message. */
export type AccountOutcome = { field: Field; message: string } | { screen: "under_age" | "closed" | "registered" } | { message: string };

export function AboutYou({ onCreated, onOutcome }: { onCreated: () => void; onOutcome: (screen: "under_age" | "closed" | "registered") => void }) {
  const brand = useBrand();
  const id = useId();
  const [values, setValues] = useState({ givenName: "", familyName: "", preferredName: "", dateOfBirth: "", mobile: "" });
  const [sex, setSex] = useState<Sex | "">("");
  const [problems, setProblems] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const create = useMutation({
    mutationFn: startApi.createAccount,
    onSuccess: onCreated,
    onError: (e) => {
      const outcome = accountOutcome(e);
      if ("screen" in outcome) return onOutcome(outcome.screen);
      if ("field" in outcome) return show({ [outcome.field]: outcome.message });
      setError(outcome.message);
      requestAnimationFrame(() => errorRef.current?.focus());
    },
  });

  function show(found: Partial<Record<Field, string>>) {
    setProblems(found);
    const first = (["givenName", "familyName", "preferredName", "dateOfBirth", "sex", "mobile"] as const).find((field) => found[field]);
    if (first) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-field="${first}"] :is(input, [role="radio"])`)?.focus());
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const found: Partial<Record<Field, string>> = {};
    const givenName = values.givenName.trim();
    const familyName = values.familyName.trim();
    const preferredName = values.preferredName.trim();
    const mobile = values.mobile.trim();
    const dateOfBirth = parseTypedDate(values.dateOfBirth);
    if (!givenName) found.givenName = "Enter your given name, as on your ID.";
    if (!familyName) found.familyName = "Enter your family name, as on your ID.";
    if (!dateOfBirth) found.dateOfBirth = "Enter your date of birth as day, month and year, like 14/05/1990.";
    if (!sex) found.sex = "Choose an answer.";
    if (Object.keys(found).length > 0) return show(found);
    setProblems({});
    const details: AccountDetails = { givenName, familyName, dateOfBirth: dateOfBirth!, sex: sex as Sex };
    if (preferredName) details.preferredName = preferredName;
    if (mobile) details.mobile = mobile;
    create.mutate(details);
  }

  const field = (key: Exclude<Field, "sex">, label: string, hint: string | null, input: Partial<React.ComponentProps<typeof Input>> = {}) => {
    const hintId = `${id}-${key}-hint`;
    const errorId = `${id}-${key}-error`;
    return (
      <div className="pt-field" data-field={key}>
        <label className="pt-label" htmlFor={`${id}-${key}`}>
          {label}
        </label>
        {hint ? (
          <p className="pt-hint" id={hintId}>
            {hint}
          </p>
        ) : null}
        <Input
          id={`${id}-${key}`}
          value={values[key]}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          aria-invalid={problems[key] ? true : undefined}
          aria-describedby={[hint ? hintId : null, problems[key] ? errorId : null].filter(Boolean).join(" ") || undefined}
          {...input}
        />
        {problems[key] ? (
          <p className="pt-error" id={errorId}>
            {problems[key]}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <section className="pt-card st-step" aria-labelledby={`${id}-title`}>
      <div>
        <h2 className="pt-card-title" id={`${id}-title`}>
          About you
        </h2>
        <p className="pt-card-sub">Your {brand.name} account. Use your details as they are on your Medicare card or other ID.</p>
      </div>
      <form className="pt-form" onSubmit={submit} noValidate>
        {field("givenName", "Given name", "As on your ID", { autoComplete: "given-name", maxLength: 100, className: "st-name" })}
        {field("familyName", "Family name", "As on your ID", { autoComplete: "family-name", maxLength: 100, className: "st-name" })}
        {field("preferredName", "Preferred name (optional)", "What you'd like us to call you, if it's different", { autoComplete: "nickname", maxLength: 100, className: "st-name" })}
        {field("dateOfBirth", "Date of birth", "Day, month and year, like 14/05/1990", { inputMode: "numeric", autoComplete: "bday", maxLength: 20, className: "st-dob" })}
        <div className="pt-field" data-field="sex">
          <span className="pt-label" id={`${id}-sex`}>
            Sex
          </span>
          <p className="pt-hint" id={`${id}-sex-hint`}>
            As on your Medicare card. We use it with your name and date of birth to find your healthcare identifier.
          </p>
          <RadioGroup
            value={sex}
            onValueChange={(v) => setSex(v as Sex)}
            aria-labelledby={`${id}-sex`}
            aria-describedby={[`${id}-sex-hint`, problems.sex ? `${id}-sex-error` : null].filter(Boolean).join(" ")}
            aria-invalid={problems.sex ? true : undefined}
            className="pt-choices"
          >
            {SEXES.map((option) => (
              <label key={option.value} className="pt-choice">
                <RadioGroupItem value={option.value} />
                <span>{option.label}</span>
              </label>
            ))}
          </RadioGroup>
          {problems.sex ? (
            <p className="pt-error" id={`${id}-sex-error`}>
              {problems.sex}
            </p>
          ) : null}
        </div>
        {field("mobile", "Mobile (optional)", "For texts about your care, like 0412 345 678", { inputMode: "tel", autoComplete: "tel-national", maxLength: 20, className: "st-mobile" })}
        {Object.keys(problems).length > 0 ? (
          <p className="pt-error" role="alert">
            Check the details marked above.
          </p>
        ) : null}
        {error ? (
          <p className="pt-error" role="alert" ref={errorRef} tabIndex={-1}>
            {error}
          </p>
        ) : null}
        <div className="pt-card-actions st-step-actions">
          <Button type="submit" disabled={create.isPending}>
            Create account
          </Button>
        </div>
      </form>
    </section>
  );
}

/** The API's refusals of a new account (patients.md IDN3, IDN20), in the patient's words. */
export function accountOutcome(error: unknown): AccountOutcome {
  if (!(error instanceof ApiError)) return { message: "We couldn't create your account just now. Try again." };
  switch (error.code) {
    case "under_age":
      return { screen: "under_age" };
    case "brand_not_accepting":
    case "tenant_not_ready":
      return { screen: "closed" };
    case "already_registered":
      return { screen: "registered" };
    case "date_of_birth":
      return { field: "dateOfBirth", message: `${error.message}.` };
    case "mobile":
      return { field: "mobile", message: `${error.message}.` };
    case "contact_needed":
      return { field: "mobile", message: "Add a mobile number so your care team can reach you." };
    case "too_many_requests":
      return { message: "That's too many tries for now. Wait a few minutes, then try again." };
    default:
      return { message: error.status === 400 ? "Check your details, then try again." : "We couldn't create your account just now. Try again." };
  }
}
