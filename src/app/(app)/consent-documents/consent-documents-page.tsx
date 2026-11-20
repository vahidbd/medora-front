"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCheck2 } from "lucide-react";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { consentDocumentsApi } from "@/lib/api/patients";
import type { ConsentDocument } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { CONSENT_KIND_LABELS } from "@/lib/patients";
import { PublishSheet } from "./publish-sheet";

/**
 * The tenant's consent documents (docs/decisions/patients.md IDN12 to
 * IDN14, IDN23): every version ever published, newest first within each kind.
 * Published text never changes; a change is a new version, and patients
 * are asked again when they next need it.
 */
export function ConsentDocumentsPage() {
  const { current, can } = useTenant();
  const documents = useQuery({
    queryKey: ["consent-documents", current.tenantId],
    queryFn: () => consentDocumentsApi.list(current.tenantId),
  });
  const manage = can("consents:manage");
  const [publishing, setPublishing] = useState(false);
  const newest = new Map<string, number>();
  for (const doc of documents.data ?? []) newest.set(doc.kind, Math.max(newest.get(doc.kind) ?? 0, doc.version));
  const isCurrent = (doc: ConsentDocument) => newest.get(doc.kind) === doc.version;

  return (
    <div>
      <PageHeader
        title="Consent documents"
        description="What patients agree to, version by version"
        primaryAction={manage ? { label: "Publish a version", onClick: () => setPublishing(true) } : undefined}
      />
      {documents.isPending ? (
        <Card aria-busy="true" aria-label="Loading consent documents">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : documents.isError ? (
        <LoadFailedState noun="list of consent documents" onRetry={() => void documents.refetch()} />
      ) : documents.data.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No consent documents yet"
          description="Publish a privacy notice and telehealth terms before patients can sign up."
          actionLabel={manage ? "Publish a version" : undefined}
          onAction={manage ? () => setPublishing(true) : undefined}
        />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table aria-label="Consent documents">
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Version</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>
                    <span className="sr-only">Status</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.data.map((doc) => (
                  <TableRow key={doc.documentId}>
                    <TableCell>{CONSENT_KIND_LABELS[doc.kind]}</TableCell>
                    <TableCell>{doc.title}</TableCell>
                    <TableCell className="text-right cell-mono">{doc.version}</TableCell>
                    <TableCell className="cell-muted">{formatDate(doc.publishedAt)}</TableCell>
                    <TableCell>{isCurrent(doc) ? <StatusBadge label="Current" tone="success" /> : <StatusBadge label="Earlier" tone="neutral" />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <PublishSheet open={publishing} onOpenChange={setPublishing} documents={documents.data ?? []} />
    </div>
  );
}
