"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTenant } from "@/components/shell/tenant-context";
import { PERMISSION_LABELS, roleName } from "@/lib/roles";

/** Home: where the staff member is working and what their role lets them do. */
export function HomePage() {
  const { current } = useTenant();
  return (
    <div>
      <PageHeader title="Home" description={`Working in ${current.tenantName}`} />
      <Card>
        <CardHeader>
          <h2>Your access</h2>
        </CardHeader>
        <CardContent>
          <dl className="facts">
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
  );
}
