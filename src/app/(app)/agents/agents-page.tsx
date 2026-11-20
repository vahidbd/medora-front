"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { LoadFailedState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { AGENT_DESCRIPTIONS, AGENT_LABELS, CHANNEL_LABELS, EVAL_LABELS, OFF_LABELS, centsToMoney } from "@/lib/agents";
import { agentsApi } from "@/lib/api/agents";
import { messageOf } from "@/lib/api/errors";
import type { AgentSummary } from "@/lib/api/types";
import { AgentSheet } from "./agent-sheet";

/**
 * Agents (docs/decisions/agents.md AGT1, AGT5, AGT6): each AI agent, whether
 * it is running and why not, its eval result, and this month's use against
 * its limits. Whoever holds agents:manage switches agents on, sets their
 * limits and pauses all of them at once; the API checks every change.
 */
export function AgentsPage() {
  const { current, can } = useTenant();
  const manage = can("agents:manage");
  const queryClient = useQueryClient();
  const agents = useQuery({ queryKey: ["agents", current.tenantId], queryFn: () => agentsApi.list(current.tenantId) });
  const [open, setOpen] = useState<AgentSummary | null>(null);
  const [confirmPause, setConfirmPause] = useState(false);

  const pause = useMutation({
    mutationFn: (paused: boolean) => (paused ? agentsApi.pause(current.tenantId) : agentsApi.resume(current.tenantId)),
    onSuccess: (reply) => {
      void queryClient.invalidateQueries({ queryKey: ["agents", current.tenantId] });
      toast.success(reply.paused ? "All agents paused" : "Agents resumed");
    },
    onError: (err) => toast.error("Nothing changed", { description: messageOf(err) }),
  });

  const data = agents.data;
  const primaryAction =
    manage && data
      ? data.paused
        ? { label: "Resume agents", icon: Play, onClick: () => pause.mutate(false) }
        : { label: "Pause all agents", icon: Pause, onClick: () => setConfirmPause(true) }
      : undefined;

  return (
    <div>
      <PageHeader title="Agents" description="Which AI agents work for you, and their limits" primaryAction={primaryAction} />
      {agents.isPending ? (
        <Card aria-busy="true" aria-label="Loading agents">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : agents.isError ? (
        <LoadFailedState noun="list of agents" onRetry={() => void agents.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          {!agents.data.platformOn ? (
            <Alert variant="neutral">
              <Bot />
              <AlertTitle>Agents are off across Medora</AlertTitle>
              <AlertDescription>None of them runs until Medora switches agents back on. Your settings are kept.</AlertDescription>
            </Alert>
          ) : agents.data.paused ? (
            <Alert variant="warning">
              <Pause />
              <AlertTitle>All agents are paused</AlertTitle>
              <AlertDescription>Conversations go to your team. Resuming brings back each agent as it was set.</AlertDescription>
            </Alert>
          ) : null}
          <Card>
            <CardContent className="flush">
              <Table aria-label="Agents">
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Eval</TableHead>
                    <TableHead>Spend this month</TableHead>
                    <TableHead>Runs today</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.data.agents.map((agent) => (
                    <TableRow key={agent.agent}>
                      <TableCell>
                        <span className="block">{AGENT_LABELS[agent.agent]}</span>
                        <span className="cell-muted block">{AGENT_DESCRIPTIONS[agent.agent]}</span>
                        {agent.name !== agent.defaultName ? <span className="cell-muted block">Patients see the name {agent.name}</span> : null}
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={agent.off ? OFF_LABELS[agent.off] : "On"} tone={agent.off ? "neutral" : "success"} />
                        <span className="cell-muted block">{agent.channels.map((c) => CHANNEL_LABELS[c]).join(", ")}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={EVAL_LABELS[agent.evals].label} tone={EVAL_LABELS[agent.evals].tone} />
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums">{centsToMoney(agent.usage.monthSpendCents)}</span>
                        <span className="cell-muted block">of {centsToMoney(agent.monthlySpendCapCents)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums">{agent.usage.runsToday.toLocaleString("en-AU")}</span>
                        <span className="cell-muted block">of {agent.dailyReplyCap.toLocaleString("en-AU")}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setOpen(agent)} aria-label={`${manage ? "Change" : "See"} ${AGENT_LABELS[agent.agent]}`}>
                          {manage ? "Change" : "See settings"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <AgentSheet agent={open} manage={manage} onOpenChange={(isOpen) => !isOpen && setOpen(null)} />
      <AlertDialog open={confirmPause} onOpenChange={setConfirmPause}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause all agents?</AlertDialogTitle>
            <AlertDialogDescription>
              Every agent stops now, and their conversations go to your team. Their proposals can be rejected but not approved until you resume.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                pause.mutate(true);
                setConfirmPause(false);
              }}
            >
              Pause all agents
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
