"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AGENT_LABELS, RUN_STATUS, TRIGGER_LABELS, centsToMoney, endReasonLabel } from "@/lib/agents";
import { agentsApi } from "@/lib/api/agents";
import type { AgentRun } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { TranscriptSheet } from "./transcript-sheet";

/**
 * Agent runs (docs/decisions/agents.md AGT6, AGT8): the latest 50, each with
 * how it started and ended, its steps and what it cost. No text: whoever
 * also holds agents:transcripts can open what was said, and the API audits
 * every read. Filters and paging arrive with the list engine (DESIGN.md).
 */
export function RunsPage() {
  const { current, can } = useTenant();
  const transcripts = can("agents:transcripts");
  const [open, setOpen] = useState<AgentRun | null>(null);
  const runs = useQuery({ queryKey: ["agent-runs", current.tenantId], queryFn: () => agentsApi.runs(current.tenantId) });

  return (
    <div>
      <PageHeader title="Agent runs" description="What agents did, and what it cost" />
      {runs.isPending ? (
        <Card aria-busy="true" aria-label="Loading agent runs">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : runs.isError ? (
        <LoadFailedState noun="agent runs" onRetry={() => void runs.refetch()} />
      ) : runs.data.length === 0 ? (
        <EmptyState icon={Activity} title="No runs yet" description="Each time an agent answers a message or does a job, it shows here with what it cost." />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table aria-label="Agent runs">
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-right">Steps</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  {transcripts ? (
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.data.map((run) => (
                  <TableRow key={run.runId}>
                    <TableCell>
                      <span className="block">{AGENT_LABELS[run.agent]}</span>
                      <span className="cell-muted block">{TRIGGER_LABELS[run.trigger]}</span>
                    </TableCell>
                    <TableCell>{formatDateTime(run.startedAt ?? run.queuedAt)}</TableCell>
                    <TableCell>
                      <StatusBadge label={RUN_STATUS[run.status].label} tone={RUN_STATUS[run.status].tone} />
                      {run.status !== "completed" && run.endReason ? <span className="cell-muted block">{endReasonLabel(run.endReason)}</span> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{run.steps}</TableCell>
                    <TableCell className="text-right tabular-nums">{centsToMoney(run.costCents)}</TableCell>
                    {transcripts ? (
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setOpen(run)} aria-label={`See transcript, ${AGENT_LABELS[run.agent]}, ${formatDateTime(run.queuedAt)}`}>
                          Transcript
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <TranscriptSheet run={open} onOpenChange={(isOpen) => !isOpen && setOpen(null)} />
    </div>
  );
}
