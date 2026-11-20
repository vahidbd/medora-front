"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoadFailedState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { messageOf } from "@/lib/api/errors";
import { tenantApi } from "@/lib/api/tenant";
import type { TenantSettings, TimeZone } from "@/lib/api/types";
import { TIME_ZONE_LABELS } from "@/lib/tenant-setup";
import { OnboardingCard } from "./onboarding";

const ZONES = Object.entries(TIME_ZONE_LABELS).map(([value, label]) => ({
  value: value as TimeZone,
  label,
}));

/**
 * Settings (docs/decisions/admin.md ADM18, ADM20): the tenant's name and
 * time zone, which everyone reads and tenant:manage changes, and the
 * onboarding checklist.
 */
export function SettingsPage() {
  const { current } = useTenant();
  const settings = useQuery({
    queryKey: ["tenant", current.tenantId],
    queryFn: () => tenantApi.get(current.tenantId),
  });
  return (
    <div>
      <PageHeader title="Settings" description={`How ${current.tenantName} is set up`} />
      <div className="flex flex-col gap-6">
        <OnboardingCard />
        {settings.isPending ? (
          <Card aria-busy="true" aria-label="Loading settings">
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="gate-skel-sub" />
              <Skeleton className="gate-skel-sub" />
            </CardContent>
          </Card>
        ) : settings.isError ? (
          <LoadFailedState noun="tenant's settings" onRetry={() => void settings.refetch()} />
        ) : (
          <TenantCard settings={settings.data} />
        )}
      </div>
    </div>
  );
}

function TenantCard({ settings }: { settings: TenantSettings }) {
  const { current, can } = useTenant();
  const queryClient = useQueryClient();
  const [name, setName] = useState(settings.name);
  const [timeZone, setTimeZone] = useState<TimeZone>(settings.timeZone);
  const [error, setError] = useState<string | null>(null);
  const manage = can("tenant:manage");
  const changed = name.trim() !== settings.name || timeZone !== settings.timeZone;

  const save = useMutation({
    mutationFn: () =>
      tenantApi.change(current.tenantId, {
        ...(name.trim() !== settings.name ? { name: name.trim() } : {}),
        ...(timeZone !== settings.timeZone ? { timeZone } : {}),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["tenant", current.tenantId], saved);
      // The tenant's name shows in the sidebar, which comes from /me.
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Settings saved");
    },
    onError: (err) => setError(messageOf(err, "The settings were not saved. Try again.")),
  });

  if (!manage) {
    return (
      <Card>
        <CardHeader>
          <h2>Tenant</h2>
        </CardHeader>
        <CardContent>
          <dl className="facts">
            <dt>Name</dt>
            <dd>{settings.name}</dd>
            <dt>Time zone</dt>
            <dd>{TIME_ZONE_LABELS[settings.timeZone]}</dd>
          </dl>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2>Tenant</h2>
      </CardHeader>
      <CardContent>
        <form
          className="field-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="tenant-name">
              Name <span className="req">*</span>
            </label>
            <Input id="tenant-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            <div className="helper">How staff see this tenant in Medora. Each brand has its own name for patients.</div>
          </div>
          <div className="field">
            <label htmlFor="tenant-zone">
              Time zone <span className="req">*</span>
            </label>
            <Select items={ZONES} value={timeZone} onValueChange={(next) => next && setTimeZone(next as TimeZone)}>
              <SelectTrigger id="tenant-zone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZONES.map((zone) => (
                  <SelectItem key={zone.value} value={zone.value}>
                    {zone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="helper">Decides what &quot;today&quot; means for this tenant&apos;s dates and reports.</div>
          </div>
          {error ? (
            <div className="field">
              <div className="err" role="alert">
                {error}
              </div>
            </div>
          ) : null}
          <div>
            <Button type="submit" disabled={!changed || save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
