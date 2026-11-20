"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTenant } from "@/components/shell/tenant-context";
import { PERMISSION_LABELS, roleName } from "@/lib/roles";
import { OnboardingCard, useOnboarding } from "../settings/onboarding";

/**
 * Home: where the staff member is working, what their role lets them do,
 * and, for those who can set the tenant up, what it still needs before it
 * takes patients (docs/decisions/admin.md ADM22).
 */
export function HomePage() {
  const { current, can } = useTenant();
  const setsUp = can("tenant:manage");
  const onboarding = useOnboarding(setsUp);
  return (
    <div>
      <PageHeader title="Home" description={`Working in ${current.tenantName}`} />
      <div className="flex flex-col gap-6">
        {setsUp && onboarding.data && !onboarding.data.ready ? <OnboardingCard /> : null}
        <Card>
          <CardHeader>
            <h2>Your access</h2>
          </CardHeader>
          <CardContent>
            <dl className="facts" aria-label="Your access">
              <dt>Tenant</dt>
              <dd>{current.tenantName}</dd>
              <dt>Role</dt>
              <dd>{roleName(current)}</dd>
              <dt>You can</dt>
              <dd>
                {current.permissions.length > 0 ? (
                  <ul className="m-0 list-none p-0">
                    {current.permissions.map((permission) => (
                      <li key={permission}>{PERMISSION_LABELS[permission]}</li>
                    ))}
                  </ul>
                ) : (
                  "Not set"
                )}
              </dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
