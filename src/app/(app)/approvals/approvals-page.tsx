"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AGENT_LABELS, PROPOSAL_STATUS, toolLabel } from "@/lib/agents";
import { proposalsApi } from "@/lib/api/agents";
import type { Proposal } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { ProposalSheet } from "./proposal-sheet";

type Show = "pending" | "decided";

/**
 * Approvals (docs/decisions/agents.md AGT4, AGT12): changes agents want
 * made, each shown as an approval card. Every staff member has the inbox,
 * and sees only the proposals they could make themselves; the API decides
 * which those are and checks again when they approve.
 */
export function ApprovalsPage() {
  const { current } = useTenant();
  const [show, setShow] = useState<Show>("pending");
  const [open, setOpen] = useState<Proposal | null>(null);
  const list = useQuery({
    queryKey: ["proposals", current.tenantId, show],
    queryFn: () => proposalsApi.list(current.tenantId, show),
  });

  return (
    <div>
      <PageHeader title="Approvals" description="Changes agents want made, waiting for you" />
      <Tabs value={show} onValueChange={(value) => setShow(value as Show)} className="mb-4">
        <TabsList aria-label="Which proposals">
          <TabsTrigger value="pending">Waiting</TabsTrigger>
          <TabsTrigger value="decided">Decided</TabsTrigger>
        </TabsList>
      </Tabs>
      {list.isPending ? (
        <Card aria-busy="true" aria-label="Loading proposals">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : list.isError ? (
        <LoadFailedState noun="proposals" onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={show === "pending" ? "Nothing waiting for you" : "Nothing decided yet"}
          description="When an agent wants to change something you could change yourself, it waits here until you approve or reject it."
        />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table aria-label={show === "pending" ? "Waiting proposals" : "Decided proposals"}>
              <TableHeader>
                <TableRow>
                  <TableHead>What the agent wants to do</TableHead>
                  <TableHead>Proposed</TableHead>
                  <TableHead>{show === "pending" ? "Expires" : "Outcome"}</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((proposal) => (
                  <TableRow key={proposal.proposalId}>
                    <TableCell>
                      <span className="block">{toolLabel(proposal.tool)}</span>
                      <span className="cell-muted block">{AGENT_LABELS[proposal.agent]}</span>
                    </TableCell>
                    <TableCell>{formatDateTime(proposal.createdAt)}</TableCell>
                    <TableCell>
                      {show === "pending" ? (
                        formatDateTime(proposal.expiresAt)
                      ) : (
                        <>
                          <StatusBadge label={PROPOSAL_STATUS[proposal.status].label} tone={PROPOSAL_STATUS[proposal.status].tone} />
                          {proposal.decidedAt ? <span className="cell-muted block">{formatDateTime(proposal.decidedAt)}</span> : null}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setOpen(proposal)} aria-label={`${show === "pending" ? "Review" : "See"} ${toolLabel(proposal.tool)}, ${formatDateTime(proposal.createdAt)}`}>
                        {show === "pending" ? "Review" : "See"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <ProposalSheet proposal={open} onOpenChange={(isOpen) => !isOpen && setOpen(null)} />
    </div>
  );
}
