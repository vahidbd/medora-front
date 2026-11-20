"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { MoreMenu, PageHeader, type ActionItem } from "@/components/shared/page-header";
import { useTenant } from "@/components/shell/tenant-context";
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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { messageOf } from "@/lib/api/errors";
import { companiesApi } from "@/lib/api/tenant";
import type { Company } from "@/lib/api/types";
import { formatAbn } from "@/lib/format";
import { CompanySheet } from "./company-sheet";

/** The tenant's companies, shared by every screen that names or picks one. */
export function useCompanies() {
  const { current } = useTenant();
  return useQuery({
    queryKey: ["companies", current.tenantId],
    queryFn: () => companiesApi.list(current.tenantId),
  });
}

const brandCount = (n: number) => (n === 1 ? "1 brand" : `${n} brands`);

/**
 * Companies (docs/decisions/admin.md ADM19): the legal entities under the
 * tenant, each with its ABN. Everyone reads them; tenant:manage adds,
 * changes and deletes them. The API decides when an ABN is fixed.
 */
export function CompaniesPage() {
  const { current, can } = useTenant();
  const queryClient = useQueryClient();
  const companies = useCompanies();
  const manage = can("tenant:manage");
  const [editing, setEditing] = useState<Company | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Company | null>(null);

  const remove = useMutation({
    mutationFn: (company: Company) => companiesApi.remove(current.tenantId, company.companyId),
    onSuccess: (_reply, company) => {
      void queryClient.invalidateQueries({
        queryKey: ["companies", current.tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["onboarding", current.tenantId],
      });
      toast.success("Company deleted", { description: company.legalName });
    },
    onError: (err) =>
      toast.error("The company was not deleted", {
        description: messageOf(err),
      }),
  });

  const actions = (company: Company): ActionItem[] =>
    manage
      ? [
          {
            label: "Edit company",
            icon: Pencil,
            onSelect: () => setEditing(company),
          },
          {
            label: "Delete company",
            icon: Trash2,
            destructive: true,
            onSelect: () => setDeleting(company),
          },
        ]
      : [];

  return (
    <div>
      <PageHeader
        title="Companies"
        description="The legal entities your brands trade as"
        primaryAction={manage ? { label: "New company", onClick: () => setAdding(true) } : undefined}
      />
      {companies.isPending ? (
        <Card aria-busy="true" aria-label="Loading companies">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : companies.isError ? (
        <LoadFailedState noun="list of companies" onRetry={() => void companies.refetch()} />
      ) : companies.data.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No companies yet"
          description="Add the legal entity your brands trade as, with its ABN."
          actionLabel={manage ? "New company" : undefined}
          onAction={manage ? () => setAdding(true) : undefined}
        />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table aria-label="Companies">
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>ABN</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Brands</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.data.map((company) => (
                  <TableRow key={company.companyId}>
                    <TableCell>
                      <span className="block">{company.legalName}</span>
                      {company.tradingName ? <span className="cell-muted block">Trading as {company.tradingName}</span> : null}
                    </TableCell>
                    <TableCell className="cell-mono">{formatAbn(company.abn)}</TableCell>
                    <TableCell>{company.state}</TableCell>
                    <TableCell>{company.brandCount}</TableCell>
                    <TableCell className="text-right">
                      {actions(company).length > 0 ? (
                        <MoreMenu items={actions(company)} label={`Actions for ${company.legalName}`} size="icon-sm" />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CompanySheet
        company={editing}
        open={adding || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setEditing(null);
          }
        }}
      />
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleting ? `Delete ${deleting.legalName}?` : "Delete company?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.brandCount > 0
                ? `${brandCount(deleting.brandCount)} still ${deleting.brandCount === 1 ? "belongs" : "belong"} to it. Move them to another company first.`
                : "No brand belongs to it, so nothing else changes."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!deleting || deleting.brandCount > 0}
              onClick={() => {
                if (deleting) remove.mutate(deleting);
                setDeleting(null);
              }}
            >
              Delete company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
