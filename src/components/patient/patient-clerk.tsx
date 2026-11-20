import { ClerkProvider } from "@clerk/nextjs";

/**
 * Clerk for patient pages, on the patient instance (ADR 0035): its own
 * keys, open sign-up by one-time code, never the staff instance. `dynamic`
 * renders it per request, so its script carries this response's nonce.
 * Patient pages load no browser error tracking (ADR 0026).
 */
export function PatientClerk({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      dynamic
      telemetry={false}
      publishableKey={process.env.PATIENT_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-in"
      afterSignOutUrl="/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
