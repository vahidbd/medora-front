"use client";

import { useId } from "react";
import type { IntakeAnswer, IntakeQuestion } from "@/lib/api/types";
import { Checkbox } from "@/components/ui/checkbox";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

/*
 * One intake question, drawn by its kind (the protocol's yes_no,
 * single_choice, multi_choice, number, date and text). The words, options,
 * units and ranges are the protocol's (ADR 0023); nothing about a condition
 * is in code. The field holds what the person typed; the step turns it into
 * an answer, and the API checks every answer (docs/decisions/intake.md INT12
 * in medora-backend).
 */

/** What a field holds while the person answers: text for numbers and words, the kit's ISO string for dates. */
export type FieldValue = string | boolean | string[] | null;

/** The field's starting value from a saved answer. */
export function fieldValueOf(question: IntakeQuestion, answer: IntakeAnswer | undefined): FieldValue {
  if (answer === undefined) return question.kind === "multi_choice" ? [] : question.kind === "yes_no" ? null : "";
  if (question.kind === "number") return typeof answer === "number" ? String(answer) : "";
  return typeof answer === "number" ? String(answer) : answer;
}

/** The answer to send, nothing when left blank, or what is wrong with it. */
export function answerOf(question: IntakeQuestion, value: FieldValue): { answer: IntakeAnswer | undefined } | { error: string } {
  const blank = value === null || value === "" || (Array.isArray(value) && value.length === 0);
  if (blank) {
    if (!question.required) return { answer: undefined };
    if (question.kind === "multi_choice") return { error: "Choose at least one." };
    if (question.kind === "yes_no" || question.kind === "single_choice") return { error: "Choose an answer." };
    return { error: "Answer this question." };
  }
  if (question.kind === "number") {
    const number = Number(String(value).trim().replace(/,/g, ""));
    return Number.isFinite(number) ? { answer: number } : { error: "Enter a number." };
  }
  if (question.kind === "text") return { answer: String(value).trim() };
  return { answer: value as IntakeAnswer };
}

export function QuestionField({
  question,
  value,
  error,
  onChange,
}: {
  question: IntakeQuestion;
  value: FieldValue;
  error: string | null;
  onChange: (value: FieldValue) => void;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [question.help ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const invalid = error ? true : undefined;
  const optional = question.required ? null : <span className="st-optional"> (optional)</span>;
  const grouped = question.kind === "yes_no" || question.kind === "single_choice" || question.kind === "multi_choice";

  const label = grouped ? (
    <span className="pt-label" id={labelId}>
      {question.label}
      {optional}
    </span>
  ) : (
    <label className="pt-label" id={labelId} htmlFor={`${id}-input`}>
      {question.label}
      {optional}
    </label>
  );

  return (
    <div className="pt-field st-question" data-question={question.key}>
      {label}
      {question.help ? (
        <p className="pt-hint" id={hintId}>
          {question.help}
        </p>
      ) : null}
      <Control question={question} value={value} onChange={onChange} id={`${id}-input`} labelId={labelId} describedBy={describedBy} invalid={invalid} />
      {error ? (
        <p className="pt-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Control({
  question,
  value,
  onChange,
  id,
  labelId,
  describedBy,
  invalid,
}: {
  question: IntakeQuestion;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  id: string;
  labelId: string;
  describedBy: string | undefined;
  invalid: true | undefined;
}) {
  const options = question.options ?? [];
  switch (question.kind) {
    case "yes_no":
      return (
        <RadioGroup
          id={id}
          value={value === true ? "yes" : value === false ? "no" : ""}
          onValueChange={(v) => onChange(v === "yes")}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className="pt-choices"
        >
          <label className="pt-choice">
            <RadioGroupItem value="yes" />
            <span>Yes</span>
          </label>
          <label className="pt-choice">
            <RadioGroupItem value="no" />
            <span>No</span>
          </label>
        </RadioGroup>
      );
    case "single_choice":
      return (
        <RadioGroup
          id={id}
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(String(v))}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className="pt-options"
        >
          {options.map((option) => (
            <label key={option.value} className="pt-option">
              <RadioGroupItem value={option.value} />
              <span className="pt-option-text">
                <strong>{option.label}</strong>
              </span>
            </label>
          ))}
        </RadioGroup>
      );
    case "multi_choice": {
      const chosen = Array.isArray(value) ? value : [];
      return (
        <div id={id} role="group" aria-labelledby={labelId} aria-describedby={describedBy} className="pt-options">
          {options.map((option) => (
            <label key={option.value} className="pt-option">
              <Checkbox
                checked={chosen.includes(option.value)}
                onCheckedChange={(checked) => onChange(checked ? [...chosen, option.value] : chosen.filter((v) => v !== option.value))}
              />
              <span className="pt-option-text">
                <strong>{option.label}</strong>
              </span>
            </label>
          ))}
        </div>
      );
    }
    case "number":
      return (
        <span className="st-number">
          <Input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            maxLength={12}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
          {question.unit ? <span className="st-unit">{question.unit}</span> : null}
        </span>
      );
    case "date":
      return (
        <DateField
          id={id}
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className="st-date"
        />
      );
    default:
      return (
        <Textarea
          id={id}
          rows={3}
          maxLength={2000}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid}
        />
      );
  }
}
