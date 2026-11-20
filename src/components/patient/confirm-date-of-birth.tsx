"use client";

import { useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { patientApi, patientKey } from "@/lib/api/patient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseTypedDate } from "@/components/ui/date-field";
import { useBrand } from "./brand-context";

/**
 * The date of birth check on every new sign-in (ADR 0035): the API answers
 * no other patient route until this session has passed it. The date is
 * sent once and kept nowhere here; a wrong one says only that it doesn't
 * match, and the API counts the tries.
 */
export function ConfirmDateOfBirth({ onSignOut }: { onSignOut: () => void }) {
  const { host } = useBrand();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();

  const confirm = useMutation({
    mutationFn: patientApi.confirmDateOfBirth,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: patientKey(host, "me") }),
    onError: (e) => fail(messageFor(e)),
  });

  function fail(message: string) {
    setError(message);
    field.current?.focus();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const dateOfBirth = parseTypedDate(text);
    if (!dateOfBirth) return fail("Enter your date of birth as day, month and year, like 14/05/1988.");
    confirm.mutate({ dateOfBirth });
  }

  return (
    <>
      <h1 className="gate-title">Confirm your date of birth</h1>
      <p className="gate-text">We ask each time you sign in, so only you can see your care.</p>
      <form className="pt-form" onSubmit={submit} noValidate>
        <div className="pt-field">
          <label className="pt-label" htmlFor={fieldId}>
            Date of birth
          </label>
          <p className="pt-hint" id={hintId}>
            Day, month and year, like 14/05/1988
          </p>
          <Input
            ref={field}
            id={fieldId}
            inputMode="numeric"
            autoComplete="bday"
            maxLength={20}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            autoFocus
          />
          {error ? (
            <p className="pt-error" id={errorId} role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="gate-actions">
          <Button type="submit" disabled={confirm.isPending}>
            Continue
          </Button>
          <Button type="button" variant="outline" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </form>
    </>
  );
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError && error.code === "date_of_birth_mismatch") return "That date of birth doesn't match your account. Check it and try again.";
  if (error instanceof ApiError && error.status === 429) return "That's too many tries for now. Wait a few minutes, then try again.";
  return "We couldn't check that just now. Try again.";
}
