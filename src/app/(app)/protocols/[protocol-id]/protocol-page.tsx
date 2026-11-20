"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { RecordPage, RecordPageSkeleton, RecordSection } from "@/components/shared/record/record-page";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import { messageOf } from "@/lib/api/errors";
import { protocolsApi } from "@/lib/api/protocols";
import type { ProtocolDetail } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { readDefinition } from "@/lib/protocol-definition";
import { VERSION_STATUS } from "@/lib/protocols";
import { EditDraftDrawer, SignOffDrawer, WithdrawDrawer } from "./protocol-drawers";
import { VersionSections } from "./version-sections";

type Drawer = "edit" | "sign-off" | "withdraw" | null;

/** The version shown first: the draft for someone who works on drafts, else the live one, else the newest. */
function firstShown(protocol: ProtocolDetail, editor: boolean): number {
  if (editor && protocol.draftVersion) return protocol.draftVersion;
  return protocol.liveVersion ?? protocol.versions.at(-1)?.version ?? 1;
}

/**
 * One protocol (docs/decisions/intake.md INT1 to INT4, INT20): its versions, and
 * one version's questions, rules and sign-off. protocols:manage starts and
 * edits drafts; protocols:sign_off, a clinical permission, signs a draft
 * off and withdraws the live version. The API refuses everything else.
 */
export function ProtocolPage({ protocolId }: { protocolId: string }) {
  const { current, can } = useTenant();
  const queryClient = useQueryClient();
  const protocol = useQuery({ queryKey: ["protocol", current.tenantId, protocolId], queryFn: () => protocolsApi.get(current.tenantId, protocolId) });
  const editor = can("protocols:manage");
  const signer = can("protocols:sign_off");
  const [chosen, setChosen] = useState<number | null>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const shown = chosen ?? (protocol.data ? firstShown(protocol.data, editor) : null);
  const version = useQuery({
    queryKey: ["protocol", current.tenantId, protocolId, "version", shown],
    queryFn: () => protocolsApi.version(current.tenantId, protocolId, shown!),
    enabled: shown !== null,
  });
  const draft = useQuery({
    queryKey: ["protocol", current.tenantId, protocolId, "version", protocol.data?.draftVersion ?? null],
    queryFn: () => protocolsApi.version(current.tenantId, protocolId, protocol.data!.draftVersion!),
    enabled: drawer === "edit" && Boolean(protocol.data?.draftVersion),
  });

  const startDraft = useMutation({
    mutationFn: () => protocolsApi.startDraft(current.tenantId, protocolId),
    onSuccess: (started) => {
      void queryClient.invalidateQueries({ queryKey: ["protocol", current.tenantId, protocolId] });
      void queryClient.invalidateQueries({ queryKey: ["protocols", current.tenantId] });
      setChosen(started.version);
      toast.success(`Version ${started.version} started as a draft`);
    },
    onError: (err) => toast.error("The draft was not started", { description: messageOf(err) }),
  });

  if (protocol.isPending) return <RecordPageSkeleton label="Loading protocol" />;
  if (protocol.isError) {
    if (protocol.error instanceof ApiError && protocol.error.status === 404) {
      return <EmptyState icon={ClipboardList} title="Protocol not found" description="It isn't in this tenant. Choose one from Protocols." />;
    }
    return <LoadFailedState noun="protocol" onRetry={() => void protocol.refetch()} />;
  }
  const p = protocol.data;
  const live = p.versions.find((v) => v.status === "live");

  return (
    <>
      <RecordPage
        title={p.name}
        badge={live ? { label: `Version ${live.version} live`, tone: "success" } : { label: "None live", tone: "neutral" }}
        meta={[
          { key: "condition", label: "Condition", value: p.condition },
          ...(p.template ? [{ key: "template", label: "From template", value: `${p.template.key}, version ${p.template.version}`, mono: true }] : []),
        ]}
        actions={
          <>
            {editor && !p.draftVersion ? (
              <Button variant="outline" disabled={startDraft.isPending} onClick={() => startDraft.mutate()}>
                Start a new version
              </Button>
            ) : null}
            {editor && p.draftVersion ? (
              <Button variant="outline" onClick={() => setDrawer("edit")}>
                Edit draft
              </Button>
            ) : null}
            {signer && live ? (
              <Button variant="outline" onClick={() => setDrawer("withdraw")}>
                Withdraw live version
              </Button>
            ) : null}
            {signer && p.draftVersion ? <Button onClick={() => setDrawer("sign-off")}>Sign off draft</Button> : null}
          </>
        }
        sections={[
          { id: "versions", label: "Versions", count: p.versions.length },
          { id: "questions", label: "Questions" },
          { id: "hard-stops", label: "Hard stops" },
          { id: "red-flags", label: "Red flags" },
          { id: "sign-off", label: "Sign-off" },
        ]}
      >
        <RecordSection id="versions" title="Versions" subtitle="A signed-off version never changes. Changes go in a new draft." flush>
          <Table aria-label="Versions">
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last edited</TableHead>
                <TableHead>Signed off</TableHead>
                <TableHead>
                  <span className="sr-only">Show</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...p.versions].reverse().map((v) => (
                <TableRow key={v.versionId} aria-current={v.version === shown ? "true" : undefined}>
                  <TableCell className="cell-mono">{v.version}</TableCell>
                  <TableCell>
                    <StatusBadge label={VERSION_STATUS[v.status].label} tone={VERSION_STATUS[v.status].tone} />
                  </TableCell>
                  <TableCell className="cell-muted">{formatDate(v.editedAt)}</TableCell>
                  <TableCell className="cell-muted">{formatDate(v.signedOffAt)}</TableCell>
                  <TableCell className="text-right">
                    {v.version === shown ? (
                      <span className="cell-muted">Shown below</span>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setChosen(v.version)}>
                        Show version {v.version}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </RecordSection>
        {version.isPending ? (
          <RecordSection id="questions" title="Questions">
            <p className="cell-muted" aria-busy="true">
              Loading version {shown}
            </p>
          </RecordSection>
        ) : version.isError ? (
          <RecordSection id="questions" title="Questions">
            <LoadFailedState noun="version" onRetry={() => void version.refetch()} />
          </RecordSection>
        ) : (
          <VersionSections version={version.data} definition={readDefinition(version.data.definition)} />
        )}
      </RecordPage>
      {drawer === "edit" && draft.data ? <EditDraftDrawer protocol={p} draft={draft.data} onOpenChange={(open) => !open && setDrawer(null)} /> : null}
      {drawer === "sign-off" ? <SignOffDrawer protocol={p} onOpenChange={(open) => !open && setDrawer(null)} /> : null}
      {drawer === "withdraw" ? <WithdrawDrawer protocol={p} onOpenChange={(open) => !open && setDrawer(null)} /> : null}
    </>
  );
}
