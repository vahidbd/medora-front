"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Send } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { MoreMenu, PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { messageOf } from "@/lib/api/errors";
import { platformApi } from "@/lib/api/tenant";
import { formatDate } from "@/lib/format";
import { TIME_ZONE_LABELS } from "@/lib/tenant-setup";
import { announceOwnerInvitation, NewTenantSheet } from "./new-tenant-sheet";

/**
 * Every tenant on Medora, for platform staff (docs/decisions/admin.md
 * ADM14): names and how far each has got, never its staff or patients.
 */
export function PlatformTenantsPage() {
  const tenants = useQuery({
    queryKey: ["platform", "tenants"],
    queryFn: platformApi.tenants,
  });
  const [adding, setAdding] = useState(false);
  const resend = useMutation({
    mutationFn: (tenantId: string) => platformApi.resendOwnerInvitation(tenantId),
    onSuccess: (reply) => announceOwnerInvitation(reply.email, "Owner invitation sent again"),
    onError: (err) =>
      toast.error("The invitation was not sent", {
        description: messageOf(err),
      }),
  });

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="Every business running on Medora"
        primaryAction={{ label: "New tenant", onClick: () => setAdding(true) }}
      />
      {tenants.isPending ? (
        <Card aria-busy="true" aria-label="Loading tenants">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : tenants.isError ? (
        <LoadFailedState noun="list of tenants" onRetry={() => void tenants.refetch()} />
      ) : tenants.data.length === 0 ? (
        <EmptyState icon={Building2} title="No tenants yet" description="Create one and invite its first owner." />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table aria-label="Tenants">
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Time zone</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Brands</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.data.map((tenant) => (
                  <TableRow key={tenant.tenantId}>
                    <TableCell>{tenant.name}</TableCell>
                    <TableCell>{TIME_ZONE_LABELS[tenant.timeZone]}</TableCell>
                    <TableCell>
                      <StatusBadge label={tenant.ownerJoined ? "Joined" : "Invited"} tone={tenant.ownerJoined ? "success" : "info"} />
                    </TableCell>
                    <TableCell>{tenant.brands === 0 ? "None yet" : `${tenant.liveBrands} live of ${tenant.brands}`}</TableCell>
                    <TableCell>{formatDate(tenant.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {tenant.ownerJoined ? null : (
                        <MoreMenu
                          items={[
                            {
                              label: "Send owner invitation again",
                              icon: Send,
                              onSelect: () => resend.mutate(tenant.tenantId),
                            },
                          ]}
                          label={`Actions for ${tenant.name}`}
                          size="icon-sm"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <NewTenantSheet open={adding} onOpenChange={setAdding} />
    </div>
  );
}
