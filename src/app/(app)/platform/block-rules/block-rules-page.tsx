"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ban } from "lucide-react";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { blockRulesApi } from "@/lib/api/catalogue";
import { ruleTarget } from "@/lib/catalogue";
import { formatDate } from "@/lib/format";
import { BlockRuleSheet } from "./block-rule-sheet";

/**
 * Medora's block rules, for platform staff (docs/decisions/catalogue.md
 * CAT2): what no tenant may sell. Adding one stops matching products in
 * every tenant at once. No screen retires one: that is a reviewed script.
 */
export function BlockRulesPage() {
  const rules = useQuery({ queryKey: ["block-rules"], queryFn: blockRulesApi.list });
  const [adding, setAdding] = useState(false);
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Block rules"
        description="What no tenant may sell, for every tenant"
        primaryAction={{ label: "New block rule", onClick: () => setAdding(true) }}
      />
      {rules.isPending ? (
        <Card aria-busy="true" aria-label="Loading block rules">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : rules.isError ? (
        <LoadFailedState noun="block rules" onRetry={() => void rules.refetch()} />
      ) : rules.data.length === 0 ? (
        <EmptyState
          icon={Ban}
          title="No block rules yet"
          description="Medora's block list is loaded before the first patient. Until then, nothing is blocked for every tenant."
          actionLabel="New block rule"
          onAction={() => setAdding(true)}
        />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table aria-label="Block rules">
              <TableHeader>
                <TableRow>
                  <TableHead>Blocks</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.data.map((rule) => {
                  const inForce = new Date(rule.effectiveFrom) <= now;
                  return (
                    <TableRow key={rule.ruleId}>
                      <TableCell>{ruleTarget(rule)}</TableCell>
                      <TableCell>
                        <span className="block">{rule.reason}</span>
                        {rule.sourceUrl ? (
                          <a className="cell-muted block underline" href={rule.sourceUrl} target="_blank" rel="noreferrer noopener">
                            Source
                          </a>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatDate(rule.effectiveFrom)}</TableCell>
                      <TableCell>
                        <StatusBadge label={inForce ? "In force" : "Announced"} tone={inForce ? "danger" : "warning"} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <BlockRuleSheet open={adding} onOpenChange={setAdding} />
    </div>
  );
}
