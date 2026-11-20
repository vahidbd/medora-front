"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FLAG_KIND_LABELS, FLAG_OUTCOMES, FLAG_URGENCY } from "@/lib/adherence";
import { adherenceApi } from "@/lib/api/adherence";
import type { AdherenceFlag, AdherenceFlagStatus } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { AdherenceFlagSheet } from "./adherence-flag-sheet";

/**
 * Adherence flags (docs/decisions/adherence.md ADH9, ADH10 in
 * medora-backend): what the care team should act on, urgent first and
 * then oldest. The list names the patient and the cause, never the
 * patient's words; opening a flag reads them, and the API audits that.
 */
export function AdherenceFlagsPage() {
  const { current } = useTenant();
  const [show, setShow] = useState<AdherenceFlagStatus>("open");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["adherence-flags", current.tenantId, show],
    queryFn: () => adherenceApi.list(current.tenantId, show),
  });

  return (
    <div>
      <PageHeader title="Adherence flags" description="Patients the care team should contact, most urgent first" />
      <Tabs value={show} onValueChange={(value) => setShow(value as AdherenceFlagStatus)} className="mb-4">
        <TabsList aria-label="Which adherence flags">
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
      </Tabs>
      {list.isPending ? (
        <Card aria-busy="true" aria-label="Loading adherence flags">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : list.isError ? (
        <LoadFailedState noun="list of adherence flags" onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title={show === "open" ? "No open adherence flags" : "No resolved adherence flags yet"}
          description={
            show === "open"
              ? "A moderate or severe side effect raises one here, the moment it is reported."
              : "Each adherence flag the care team resolves shows here with what was done."
          }
        />
      ) : (
        <Card>
          <CardContent className="flush">
            <FlagTable rows={list.data} status={show} onReview={setReviewing} />
          </CardContent>
        </Card>
      )}
      <AdherenceFlagSheet adherenceFlagId={reviewing} onShow={setReviewing} onOpenChange={(open) => !open && setReviewing(null)} />
    </div>
  );
}

function FlagTable({ rows, status, onReview }: { rows: AdherenceFlag[]; status: AdherenceFlagStatus; onReview: (id: string) => void }) {
  return (
    <Table className="whitespace-nowrap">
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>Cause</TableHead>
          <TableHead>Urgency</TableHead>
          <TableHead>Raised</TableHead>
          {status === "resolved" ? <TableHead>Resolution</TableHead> : null}
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.adherenceFlagId}>
            <TableCell>{row.patientName}</TableCell>
            <TableCell>
              <span className="block">{FLAG_KIND_LABELS[row.kind]}</span>
              {row.reopenedFromId ? <span className="cell-muted block">Reopened</span> : null}
            </TableCell>
            <TableCell>
              <StatusBadge label={FLAG_URGENCY[row.urgency].label} tone={FLAG_URGENCY[row.urgency].tone} />
            </TableCell>
            <TableCell>{formatDateTime(row.raisedAt)}</TableCell>
            {status === "resolved" ? (
              <TableCell>
                {row.resolution ? (
                  <>
                    <span className="block">{FLAG_OUTCOMES[row.resolution.outcome].label}</span>
                    <span className="cell-muted block">
                      {formatDateTime(row.resolution.resolvedAt)}
                      {row.resolution.resolvedBy.displayName ? `, ${row.resolution.resolvedBy.displayName}` : ""}
                    </span>
                  </>
                ) : null}
              </TableCell>
            ) : null}
            <TableCell className="text-right">
              <Button
                variant={status === "open" ? "outline" : "ghost"}
                size="sm"
                aria-label={`${status === "open" ? "Review" : "View"} the adherence flag for ${row.patientName}`}
                onClick={() => onReview(row.adherenceFlagId)}
              >
                {status === "open" ? "Review" : "View"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
