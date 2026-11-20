"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Pause, Pencil, Play, Rocket, Store } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { MoreMenu, PageHeader, type ActionItem } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { brandsApi } from "@/lib/api/tenant";
import type { Brand } from "@/lib/api/types";
import { BRAND_STATUS } from "@/lib/tenant-setup";
import { useCompanies } from "../companies/companies-page";
import { BrandSheet } from "./brand-sheet";
import { DomainsSheet } from "./domains-sheet";

type StatusStep = { brand: Brand; to: "live" | "paused" };

const STEP_COPY = {
  live: {
    title: (b: Brand) => `Take ${b.name} live?`,
    text: "Patients can reach its pages and sign up once the tenant's onboarding checklist is done.",
    action: "Go live",
    done: "Brand is live",
  },
  paused: {
    title: (b: Brand) => `Pause ${b.name}?`,
    text: "New patients can't sign up. Everyone already with this brand keeps their care, orders and messages.",
    action: "Pause brand",
    done: "Brand paused",
  },
} as const;

function domainsSummary(brand: Brand): string {
  if (brand.domains.length === 0) return "None yet";
  const verified = brand.domains.filter((d) => d.verifiedAt).length;
  const first = brand.domains[0]!.host;
  const more = brand.domains.length > 1 ? ` and ${brand.domains.length - 1} more` : "";
  return `${first}${more}${verified === 0 ? ", not verified" : ""}`;
}

/**
 * Brands (docs/decisions/admin.md ADM15 to ADM17): the names and looks the
 * tenant sells under. Everyone reads them; brands:manage adds and changes
 * them, their domains, and takes them live, pauses and resumes them. The
 * API checks each step, so a refused one shows its reason.
 */
export function BrandsPage() {
  const { current, can } = useTenant();
  const queryClient = useQueryClient();
  const brands = useQuery({
    queryKey: ["brands", current.tenantId],
    queryFn: () => brandsApi.list(current.tenantId),
  });
  const companies = useCompanies();
  const manage = can("brands:manage");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [domainsOf, setDomainsOf] = useState<string | null>(null);
  const [step, setStep] = useState<StatusStep | null>(null);

  const setStatus = useMutation({
    mutationFn: ({ brand, to }: StatusStep) => brandsApi.setStatus(current.tenantId, brand.brandId, to),
    onSuccess: (saved, { brand, to }) => {
      void queryClient.invalidateQueries({
        queryKey: ["brands", current.tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["onboarding", current.tenantId],
      });
      toast.success(brand.status === "paused" && to === "live" ? "Brand resumed" : STEP_COPY[to].done, { description: saved.name });
    },
    onError: (err) =>
      toast.error("The brand's status did not change", {
        description: messageOf(err),
      }),
  });

  const actions = (brand: Brand): ActionItem[] => [
    {
      label: manage ? "Domains" : "See domains",
      icon: Globe,
      onSelect: () => setDomainsOf(brand.brandId),
    },
    ...(manage
      ? [
          {
            label: "Edit brand",
            icon: Pencil,
            onSelect: () => setEditing(brand),
          },
          ...(brand.status === "draft"
            ? [
                {
                  label: "Go live",
                  icon: Rocket,
                  onSelect: () => setStep({ brand, to: "live" }),
                },
              ]
            : []),
          ...(brand.status === "live"
            ? [
                {
                  label: "Pause new sign-ups",
                  icon: Pause,
                  onSelect: () => setStep({ brand, to: "paused" }),
                },
              ]
            : []),
          ...(brand.status === "paused"
            ? [
                {
                  label: "Resume",
                  icon: Play,
                  onSelect: () => setStatus.mutate({ brand, to: "live" }),
                },
              ]
            : []),
        ]
      : []),
  ];

  const noCompany = companies.data?.length === 0;
  const loading = brands.isPending || companies.isPending;
  const failed = brands.isError || companies.isError;
  const open = brands.data?.find((b) => b.brandId === domainsOf) ?? null;

  return (
    <div>
      <PageHeader
        title="Brands"
        description="The names and looks you sell under"
        primaryAction={manage && !noCompany ? { label: "New brand", onClick: () => setAdding(true) } : undefined}
      />
      {loading ? (
        <Card aria-busy="true" aria-label="Loading brands">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : failed ? (
        <LoadFailedState
          noun="list of brands"
          onRetry={() => {
            void brands.refetch();
            void companies.refetch();
          }}
        />
      ) : brands.data!.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No brands yet"
          description={noCompany ? "Add a company first: every brand trades as one." : "Add a brand to start setting up its pages."}
          actionLabel={manage && !noCompany ? "New brand" : undefined}
          onAction={manage && !noCompany ? () => setAdding(true) : undefined}
        />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table aria-label="Brands">
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Domains</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.data!.map((brand) => {
                  const company = companies.data!.find((c) => c.companyId === brand.companyId);
                  return (
                    <TableRow key={brand.brandId}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span
                            className="brand-swatch brand-swatch-sm"
                            aria-hidden
                            style={brand.primaryColour ? { background: brand.primaryColour } : undefined}
                          />
                          <span className="min-w-0">
                            <span className="block">{brand.name}</span>
                            <span className="cell-muted cell-mono block">{brand.slug}</span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>{company ? (company.tradingName ?? company.legalName) : ""}</TableCell>
                      <TableCell className="cell-muted">{domainsSummary(brand)}</TableCell>
                      <TableCell>
                        <StatusBadge label={BRAND_STATUS[brand.status].label} tone={BRAND_STATUS[brand.status].tone} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoreMenu items={actions(brand)} label={`Actions for ${brand.name}`} size="icon-sm" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <BrandSheet
        brand={editing}
        companies={companies.data ?? []}
        open={adding || editing !== null}
        onOpenChange={(next) => {
          if (!next) {
            setAdding(false);
            setEditing(null);
          }
        }}
      />
      <DomainsSheet brand={open} onOpenChange={(next) => !next && setDomainsOf(null)} />
      <AlertDialog open={step !== null} onOpenChange={(next) => !next && setStep(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{step ? STEP_COPY[step.to].title(step.brand) : ""}</AlertDialogTitle>
            <AlertDialogDescription>{step ? STEP_COPY[step.to].text : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (step) setStatus.mutate(step);
                setStep(null);
              }}
            >
              {step ? STEP_COPY[step.to].action : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
