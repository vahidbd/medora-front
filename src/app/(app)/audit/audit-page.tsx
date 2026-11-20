"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, ScrollText, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditApi } from "@/lib/api/audit";
import { messageOf } from "@/lib/api/errors";
import { staffApi } from "@/lib/api/staff";
import { actorLabel, type AuditFilters, auditCsv, detailsText, exportFileName, filterPills, NO_FILTERS, toApiFilter } from "@/lib/audit";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import { ZONE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { FiltersSheet } from "./filters-sheet";

const PAGE_SIZE = 50;

/**
 * The tenant's audit log (docs/decisions/admin.md ADM25 to ADM27): who did
 * what, newest first, for whoever holds audit:read. Filters sit in a
 * drawer and show as pills; the pager steps to older and newer pages; an
 * export is every entry the filters match, recorded by the API and saved
 * as a CSV file in the browser.
 */
export function AuditPage() {
  const { current, can } = useTenant();
  const allowed = can("audit:read");
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<AuditFilters>(NO_FILTERS);
  const [editing, setEditing] = useState(false);
  // The `before` of each page so far: the last one is the page shown.
  const [pages, setPages] = useState<(string | null)[]>([null]);
  const filter = toApiFilter(filters);
  const before = pages[pages.length - 1] ?? null;

  const log = useQuery({
    queryKey: ["audit", current.tenantId, filter, before],
    queryFn: () => auditApi.page(current.tenantId, filter, before),
    placeholderData: keepPreviousData,
    enabled: allowed,
  });
  const staff = useQuery({ queryKey: ["staff", current.tenantId], queryFn: () => staffApi.list(current.tenantId), enabled: allowed });

  const exporting = useMutation({
    mutationFn: () => auditApi.export(current.tenantId, filter),
    onSuccess: ({ entries, truncated }) => {
      downloadCsv(exportFileName(), auditCsv(entries));
      // The export is itself an entry (ADM26).
      void queryClient.invalidateQueries({ queryKey: ["audit", current.tenantId] });
      const count = `${entries.length.toLocaleString("en-AU")} ${entries.length === 1 ? "entry" : "entries"}`;
      if (truncated)
        toast.warning("Only the newest 5,000 entries were exported", { description: "Narrow the filters to export the rest." });
      else toast.success("Audit log exported", { description: count });
    },
    onError: (err) => toast.error("The audit log was not exported", { description: messageOf(err) }),
  });

  const apply = (next: AuditFilters) => {
    setFilters(next);
    setPages([null]);
  };
  const personName = (userId: string) => {
    const member = staff.data?.find((m) => m.userId === userId);
    return member ? (member.displayName ?? member.email) : "Someone outside this tenant";
  };
  const pills = filterPills(filters, personName);
  const entries = log.data?.entries ?? [];
  const first = (pages.length - 1) * PAGE_SIZE + 1;

  // A courtesy for someone who switched tenant on this screen: the API refuses them anyway (ADM25).
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Audit log" description="Who did what in this tenant, and when" />
        <EmptyState
          icon={ScrollText}
          title="Your role can't read the audit log"
          description="The owner, admins, the medical director and compliance can. Ask one of them if you need an entry."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Who did what in this tenant, and when"
        primaryAction={{
          label: exporting.isPending ? "Exporting…" : "Export CSV",
          icon: Download,
          onClick: () => exporting.mutate(),
          disabled: exporting.isPending,
        }}
      >
        <Button
          variant="outline"
          className={cn("list-head-btn", pills.length > 0 && "is-set")}
          aria-label={pills.length > 0 ? `Filters, ${pills.length} set` : "Filters"}
          title="Filters"
          aria-expanded={editing}
          onClick={() => setEditing(true)}
        >
          <SlidersHorizontal aria-hidden />
          <span className="list-head-btn-label">Filters</span>
          {pills.length > 0 ? (
            <span className="list-head-count" aria-hidden>
              {pills.length}
            </span>
          ) : null}
        </Button>
      </PageHeader>
      {pills.length > 0 ? (
        <div className="filter-row" role="group" aria-label="Filters set">
          {pills.map((pill) => (
            <span key={pill.key} className="fpill active">
              <button type="button" className="fpill-btn" onClick={() => setEditing(true)}>
                {pill.label} <span className="v">{pill.value}</span>
              </button>
              <button
                type="button"
                className="fpill-x"
                aria-label={`Remove the ${pill.label.toLowerCase()} filter`}
                onClick={() => apply({ ...filters, [pill.key]: "" })}
              >
                <X aria-hidden />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="sm" onClick={() => apply(NO_FILTERS)}>
            Clear all
          </Button>
        </div>
      ) : null}
      {log.isPending ? (
        <Card aria-busy="true" aria-label="Loading the audit log">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : log.isError ? (
        <LoadFailedState noun="audit log" onRetry={() => void log.refetch()} />
      ) : entries.length === 0 ? (
        pills.length > 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No entries match these filters"
            description="Change or clear the filters to see more."
            actionLabel="Clear filters"
            onAction={() => apply(NO_FILTERS)}
          />
        ) : (
          <EmptyState
            icon={ScrollText}
            title="Nothing recorded yet"
            description="Changes to staff, brands, products and settings show here as they happen."
          />
        )
      ) : (
        <Card>
          <CardContent className="flush">
            <Table aria-label="Audit log">
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.entryId}>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(entry.at)}</TableCell>
                    <TableCell className="whitespace-nowrap">{actorLabel(entry)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="cell-mono block">{entry.action}</span>
                      <span className="cell-muted block">{ZONE_LABELS[entry.zone]}</span>
                    </TableCell>
                    <TableCell>
                      <span className="cell-muted block">{entry.recordTable}</span>
                      <span className="cell-mono block">{entry.recordId}</span>
                    </TableCell>
                    <TableCell className="cell-muted min-w-64">{detailsText(entry)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="pager">
              <span>
                Entries {first.toLocaleString("en-AU")} to {(first + entries.length - 1).toLocaleString("en-AU")}
              </span>
              <span className="grow" />
              <div className="pager-nav">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Newer entries"
                  title="Newer entries"
                  disabled={pages.length === 1 || log.isFetching}
                  onClick={() => setPages((p) => p.slice(0, -1))}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Older entries"
                  title="Older entries"
                  disabled={!log.data?.nextBefore || log.isFetching}
                  onClick={() => log.data?.nextBefore && setPages((p) => [...p, log.data.nextBefore])}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <FiltersSheet open={editing} filters={filters} staff={staff.data ?? []} onApply={apply} onOpenChange={setEditing} />
    </div>
  );
}
