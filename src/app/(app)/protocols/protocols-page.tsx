"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { protocolsApi } from "@/lib/api/protocols";
import { NewProtocolSheet } from "./new-protocol-sheet";

/**
 * Protocols (docs/decisions/intake.md INT1 to INT4, INT10): the questions
 * and rules behind each program. A protocol starts as a draft, usually
 * from a platform template, and only a medical director's sign-off puts a
 * version live.
 */
export function ProtocolsPage() {
  const { current, can } = useTenant();
  const protocols = useQuery({ queryKey: ["protocols", current.tenantId], queryFn: () => protocolsApi.list(current.tenantId) });
  const manage = can("protocols:manage");
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <PageHeader
        title="Protocols"
        description="The questions and rules behind each program"
        primaryAction={manage ? { label: "New protocol", onClick: () => setAdding(true) } : undefined}
      />
      {protocols.isPending ? (
        <Card aria-busy="true" aria-label="Loading protocols">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : protocols.isError ? (
        <LoadFailedState noun="list of protocols" onRetry={() => void protocols.refetch()} />
      ) : protocols.data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No protocols yet"
          description="Start one from a template. It stays a draft until your medical director signs it off."
          actionLabel={manage ? "New protocol" : undefined}
          onAction={manage ? () => setAdding(true) : undefined}
        />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table aria-label="Protocols">
              <TableHeader>
                <TableRow>
                  <TableHead>Protocol</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Live version</TableHead>
                  <TableHead>Draft</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {protocols.data.map((protocol) => (
                  <TableRow key={protocol.protocolId}>
                    <TableCell>
                      <Link className="row-link" href={`/protocols/${protocol.protocolId}`}>
                        {protocol.name}
                      </Link>
                    </TableCell>
                    <TableCell>{protocol.condition}</TableCell>
                    <TableCell>
                      {protocol.liveVersion ? <StatusBadge label={`Version ${protocol.liveVersion}`} tone="success" /> : <StatusBadge label="None live" tone="neutral" />}
                    </TableCell>
                    <TableCell className="cell-muted">{protocol.draftVersion ? `Version ${protocol.draftVersion}` : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <NewProtocolSheet open={adding} onOpenChange={setAdding} />
    </div>
  );
}
