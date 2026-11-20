"use client";

import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadFailedState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { tenantApi } from "@/lib/api/tenant";
import { ONBOARDING_LABELS } from "@/lib/tenant-setup";

/** The tenant's onboarding checklist, keyed by tenant like every tenant read. */
export function useOnboarding(enabled = true) {
  const { current } = useTenant();
  return useQuery({
    queryKey: ["onboarding", current.tenantId],
    queryFn: () => tenantApi.onboarding(current.tenantId),
    enabled,
  });
}

/**
 * What the tenant still needs before it takes new patients (docs/decisions/admin.md
 * ADM18). Worked out by the API from the tenant's data; nothing here is
 * ticked by hand, and the API refuses new patients until it is all done.
 */
export function OnboardingCard() {
  const onboarding = useOnboarding();
  return (
    <Card>
      <CardHeader>
        <h2>Before you take new patients</h2>
        {onboarding.data ? (
          <StatusBadge
            label={onboarding.data.ready ? "Taking new patients" : "Not taking new patients"}
            tone={onboarding.data.ready ? "success" : "warning"}
          />
        ) : null}
      </CardHeader>
      <CardContent>
        {onboarding.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading the checklist">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </div>
        ) : onboarding.isError ? (
          <LoadFailedState noun="checklist" onRetry={() => void onboarding.refetch()} />
        ) : (
          <dl className="facts" aria-label="Onboarding checklist">
            {onboarding.data.items.map((item) => (
              <Fragment key={item.key}>
                <dt>
                  <span>
                    <span className="block text-foreground">{ONBOARDING_LABELS[item.key].title}</span>
                    <span className="cell-muted block">{ONBOARDING_LABELS[item.key].help}</span>
                  </span>
                </dt>
                <dd>
                  <StatusBadge label={item.done ? "Done" : "To do"} tone={item.done ? "success" : "neutral"} />
                </dd>
              </Fragment>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
