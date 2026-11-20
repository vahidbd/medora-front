import { ClerkProvider } from "@clerk/nextjs";
import { ErrorReporting } from "@/components/shell/error-reporting";

/**
 * Clerk, for staff screens (the console and sign-in). `dynamic` renders it
 * per request, so its script carries this response's nonce (src/proxy.ts).
 * A patient page built later mounts its own provider, not this one.
 * Browser error tracking starts here for the same reason: staff screens only.
 */
export function StaffClerk({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider dynamic telemetry={false}>
      <ErrorReporting />
      {children}
    </ClerkProvider>
  );
}
