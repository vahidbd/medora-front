"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { messageOf } from "@/lib/api/errors";
import { platformApi } from "@/lib/api/tenant";
import type { PlatformDomain } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

/**
 * Brands' domains across Medora, for platform staff to verify
 * (docs/decisions/admin.md ADM15). A domain does nothing until someone
 * here has checked its DNS points at Medora and marked it verified.
 */
export function PlatformDomainsPage() {
  const queryClient = useQueryClient();
  const [show, setShow] = useState<"waiting" | "all">("waiting");
  const [checking, setChecking] = useState<PlatformDomain | null>(null);
  const domains = useQuery({
    queryKey: ["platform", "domains", show],
    queryFn: () => platformApi.domains(show === "waiting"),
  });
  const verify = useMutation({
    mutationFn: (domain: PlatformDomain) => platformApi.verify(domain.domainId),
    onSuccess: (reply) => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "domains"] });
      toast.success("Domain verified", { description: reply.host });
    },
    onError: (err) =>
      toast.error("The domain was not verified", {
        description: messageOf(err),
      }),
  });

  return (
    <div>
      <PageHeader title="Domains to verify" description="Brands' domains, checked before they work" />
      <Tabs value={show} onValueChange={(value) => setShow(value as "waiting" | "all")} className="mb-4">
        <TabsList aria-label="Which domains">
          <TabsTrigger value="waiting">Waiting</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      {domains.isPending ? (
        <Card aria-busy="true" aria-label="Loading domains">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : domains.isError ? (
        <LoadFailedState noun="list of domains" onRetry={() => void domains.refetch()} />
      ) : domains.data.length === 0 ? (
        <EmptyState
          icon={Globe}
          title={show === "waiting" ? "Nothing waiting" : "No domains yet"}
          description="When a tenant adds a domain to a brand, it shows here to check."
        />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table aria-label="Domains">
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.data.map((domain) => (
                  <TableRow key={domain.domainId}>
                    <TableCell className="cell-mono">{domain.host}</TableCell>
                    <TableCell>{domain.brandName}</TableCell>
                    <TableCell>{domain.tenantName}</TableCell>
                    <TableCell>{formatDate(domain.createdAt)}</TableCell>
                    <TableCell>
                      {domain.verifiedAt ? (
                        <StatusBadge label={`Verified ${formatDate(domain.verifiedAt)}`} tone="success" />
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setChecking(domain)} aria-label={`Verify ${domain.host}`}>
                          Verify
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <AlertDialog open={checking !== null} onOpenChange={(open) => !open && setChecking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{checking ? `Verify ${checking.host}?` : "Verify domain?"}</AlertDialogTitle>
            <AlertDialogDescription>
              Only when its DNS points at Medora. Once verified, patients can reach {checking?.brandName ?? "the brand"} there when it is
              live.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (checking) verify.mutate(checking);
                setChecking(null);
              }}
            >
              Mark verified
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
