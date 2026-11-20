"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useBrand } from "./brand-context";

/**
 * A patient signs in with a six-digit code sent to their email (APP5). The
 * same two steps sign a new patient up: when Clerk has no account for the
 * address, the code comes from a sign-up instead. Both paths say the same
 * words, so the screen never tells anyone whether an address has an
 * account. Clerk sends and checks the codes; nothing here is stored.
 */

type Step = { name: "email" } | { name: "code"; email: string; mode: "sign-in" | "sign-up" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE = /^\d{6}$/;

/** The one thing a failed step ever says: the same words whether the address has an account or not. */
const SEND_FAILED = "We couldn't send a code to that address. Check it and try again.";
const CODE_FAILED = "That code didn't work. Check it, or send a new one.";

export function SignInFlow({ next, why }: { next: string; why: string | null }) {
  const router = useRouter();
  const brand = useBrand();
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [step, setStep] = useState<Step>({ name: "email" });
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldId = useId();
  const errorId = useId();
  const field = useRef<HTMLInputElement>(null);

  // Someone already signed in has nothing to do here.
  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace(next);
  }, [isLoaded, isSignedIn, next, router]);

  const go = () => router.replace(next);

  async function sendCode(email: string): Promise<Step | null> {
    const created = await signIn.create({ identifier: email });
    if (!created.error) {
      const sent = await signIn.emailCode.sendCode();
      return sent.error ? null : { name: "code", email, mode: "sign-in" };
    }
    // No account for the address: the same screen signs them up.
    const started = await signUp.create({ emailAddress: email });
    if (started.error) return null;
    const sent = await signUp.verifications.sendEmailCode();
    return sent.error ? null : { name: "code", email, mode: "sign-up" };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const text = value.trim();
    if (step.name === "email") {
      if (!EMAIL.test(text)) return fail("Enter your email address, like name@example.com.");
      setBusy(true);
      const nextStep = await sendCode(text).catch(() => null);
      setBusy(false);
      if (!nextStep) return fail(SEND_FAILED);
      setStep(nextStep);
      setValue("");
      return;
    }
    if (!CODE.test(text)) return fail("Enter the six digits from the email.");
    setBusy(true);
    const ok = await (step.mode === "sign-in" ? verifySignIn(text) : verifySignUp(text)).catch(() => false);
    setBusy(false);
    if (!ok) fail(CODE_FAILED);
  }

  async function verifySignIn(code: string): Promise<boolean> {
    const verified = await signIn.emailCode.verifyCode({ code });
    if (verified.error || signIn.status !== "complete") return false;
    const done = await signIn.finalize({ navigate: go });
    return !done.error;
  }

  async function verifySignUp(code: string): Promise<boolean> {
    const verified = await signUp.verifications.verifyEmailCode({ code });
    if (verified.error || signUp.status !== "complete") return false;
    const done = await signUp.finalize({ navigate: go });
    return !done.error;
  }

  function fail(message: string) {
    setError(message);
    field.current?.focus();
  }

  async function resend() {
    if (step.name !== "code") return;
    setError(null);
    setBusy(true);
    const again = await sendCode(step.email).catch(() => null);
    setBusy(false);
    if (!again) fail(SEND_FAILED);
  }

  const onCode = step.name === "code";
  return (
    <div className="pt-signin">
      {why === "idle" ? (
        <Alert variant="info">You were signed out after 30 minutes without activity, to keep your details private.</Alert>
      ) : null}
      <div className="pt-card">
        <div className="pt-head">
          <h1 className="pt-title">{onCode ? "Check your email" : `Sign in to ${brand.name}`}</h1>
          <p className="pt-lede">
            {onCode
              ? `If ${step.email} can be used here, we've sent it a six-digit code. It works for 10 minutes.`
              : "Enter your email and we'll send you a code. New here? The same code sets up your account."}
          </p>
        </div>
        <form className="pt-form" onSubmit={(e) => void submit(e)} noValidate>
          <div className="pt-field">
            <label className="pt-label" htmlFor={fieldId}>
              {onCode ? "Code" : "Email"}
            </label>
            <Input
              key={step.name}
              ref={field}
              id={fieldId}
              className={onCode ? "pt-code" : undefined}
              type={onCode ? "text" : "email"}
              inputMode={onCode ? "numeric" : "email"}
              autoComplete={onCode ? "one-time-code" : "email"}
              maxLength={onCode ? 6 : 254}
              value={value}
              onChange={(e) => setValue(onCode ? e.target.value.replace(/\D/g, "") : e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoFocus
            />
            {error ? (
              <p className="pt-error" id={errorId} role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={busy || !isLoaded}>
            {onCode ? "Sign in" : "Send code"}
          </Button>
        </form>
        {onCode ? (
          <div className="pt-switch-row">
            <button
              type="button"
              className="pt-textlink"
              onClick={() => {
                setStep({ name: "email" });
                setValue("");
                setError(null);
              }}
            >
              Use another email
            </button>
            <button type="button" className="pt-textlink" disabled={busy} onClick={() => void resend()}>
              Send a new code
            </button>
          </div>
        ) : null}
      </div>
      <p className="pt-muted">
        Signing in for medical help that can&apos;t wait? Call 000. For other questions, contact{" "}
        {brand.supportEmail ? <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a> : brand.name}.
      </p>
    </div>
  );
}
