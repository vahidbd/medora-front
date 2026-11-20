import { AppShell } from "@/components/shell/app-shell";
import { AuthGate } from "@/components/shell/auth-gate";
import { StaffClerk } from "@/components/shell/staff-clerk";
import { TenantProvider } from "@/components/shell/tenant-context";

/** The staff console: signed in, known to the API, working in one tenant. */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffClerk>
      <AuthGate>
        <TenantProvider>
          <AppShell>{children}</AppShell>
        </TenantProvider>
      </AuthGate>
    </StaffClerk>
  );
}
