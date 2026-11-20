"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { messageOf } from "@/lib/api/errors";
import { brandsApi } from "@/lib/api/tenant";
import type { Brand } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

/**
 * A brand's domains (docs/decisions/admin.md ADM15). A tenant adds and
 * removes them; each does nothing until Medora's platform staff have
 * checked its DNS and marked it verified. A domain never changes: add the
 * new one and remove the old.
 */
export function DomainsSheet({ brand, onOpenChange }: { brand: Brand | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={brand !== null} onOpenChange={onOpenChange}>
      <SheetContent>{brand ? <Domains key={brand.brandId} brand={brand} /> : null}</SheetContent>
    </Sheet>
  );
}

function Domains({ brand }: { brand: Brand }) {
  const { current, can } = useTenant();
  const queryClient = useQueryClient();
  const manage = can("brands:manage");
  const [host, setHost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ["brands", current.tenantId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["onboarding", current.tenantId],
    });
  };

  const add = useMutation({
    mutationFn: () => brandsApi.addDomain(current.tenantId, brand.brandId, host.trim()),
    onSuccess: () => {
      refresh();
      setHost("");
      toast.success("Domain added", {
        description: "Medora checks it before it works.",
      });
    },
    onError: (err) => setError(messageOf(err, "The domain was not added. Try again.")),
  });
  const remove = useMutation({
    mutationFn: (domainId: string) => brandsApi.removeDomain(current.tenantId, brand.brandId, domainId),
    onSuccess: () => {
      refresh();
      toast.success("Domain removed");
    },
    onError: (err) =>
      toast.error("The domain was not removed", {
        description: messageOf(err),
      }),
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>{`Domains for ${brand.name}`}</SheetTitle>
        <SheetDescription>Where the brand&apos;s pages answer. Point its DNS at Medora, then Medora verifies it.</SheetDescription>
      </SheetHeader>
      <SheetBody>
        <div className="field-stack">
          {brand.domains.length === 0 ? (
            <p className="list-empty">No domains yet.</p>
          ) : (
            <ul className="m-0 list-none p-0" aria-label="Domains">
              {brand.domains.map((domain) => (
                <li key={domain.domainId} className="domain-row">
                  <span className="min-w-0 flex-1">
                    <span className="cell-mono block truncate">{domain.host}</span>
                    <span className="choice-sub block">
                      {domain.verifiedAt ? `Verified ${formatDate(domain.verifiedAt)}` : "Waiting for Medora to check its DNS"}
                    </span>
                  </span>
                  <StatusBadge label={domain.verifiedAt ? "Verified" : "Waiting"} tone={domain.verifiedAt ? "success" : "neutral"} />
                  {manage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${domain.host}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(domain.domainId)}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {manage ? (
            <form
              className="field"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                add.mutate();
              }}
            >
              <label htmlFor="domain-host">Add a domain</label>
              <div className="flex items-center gap-2">
                <Input
                  id="domain-host"
                  required
                  maxLength={253}
                  placeholder="app.example.com.au"
                  autoComplete="off"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                />
                <Button type="submit" variant="outline" disabled={add.isPending}>
                  {add.isPending ? "Adding…" : "Add domain"}
                </Button>
              </div>
              {error ? (
                <div className="err" role="alert">
                  {error}
                </div>
              ) : null}
            </form>
          ) : null}
        </div>
      </SheetBody>
    </>
  );
}
