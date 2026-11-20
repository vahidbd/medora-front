"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChoiceSelect } from "@/components/shared/choice-select";
import { LoadFailedState } from "@/components/shared/empty-state";
import { EditDrawer } from "@/components/shared/record/edit-drawer";
import { RecordSection } from "@/components/shared/record/record-page";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { messageOf } from "@/lib/api/errors";
import { patientsApi } from "@/lib/api/patients";
import type { ConsentRecord, PatientConsent } from "@/lib/api/types";
import { CONSENT_KIND_LABELS } from "@/lib/patients";

function decisionOf(consent: PatientConsent): { label: string; tone: "success" | "warning" | "neutral" | "danger" } {
  if (consent.decision === "withdrawn") return { label: "Withdrawn", tone: "danger" };
  if (consent.decision === "given" && consent.decidedVersion === consent.document?.version) return { label: "Given", tone: "success" };
  if (consent.decision === "given") return { label: `Given for version ${consent.decidedVersion}`, tone: "warning" };
  return { label: "Not asked yet", tone: "neutral" };
}

/**
 * Consents (docs/decisions/patients.md IDN12, IDN13): each document's
 * current version and the patient's decision on it. Staff with
 * patients:manage record a decision the patient made by phone or in person.
 */
export function ConsentsSection({ patientId }: { patientId: string }) {
  const { current, can } = useTenant();
  const consents = useQuery({ queryKey: ["patient", current.tenantId, patientId, "consents"], queryFn: () => patientsApi.consents(current.tenantId, patientId) });
  const [recording, setRecording] = useState(false);
  const needed = consents.data?.filter((c) => c.needed).length ?? 0;

  return (
    <RecordSection
      id="consents"
      title="Consents"
      subtitle={needed > 0 ? "Some are needed before their next care" : "What they agreed to, and on which version"}
      actions={
        can("patients:manage") && consents.data ? (
          <Button variant="outline" size="sm" onClick={() => setRecording(true)}>
            Record a decision
          </Button>
        ) : null
      }
      flush
    >
      {consents.isPending ? (
        <p className="cell-muted p-4" aria-busy="true">
          Loading consents
        </p>
      ) : consents.isError ? (
        <LoadFailedState noun="list of consents" onRetry={() => void consents.refetch()} />
      ) : (
        <Table aria-label="Consents">
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Current version</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>
                <span className="sr-only">Needed</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consents.data.map((consent) => {
              const decision = decisionOf(consent);
              return (
                <TableRow key={consent.kind}>
                  <TableCell>{CONSENT_KIND_LABELS[consent.kind]}</TableCell>
                  <TableCell className="cell-muted">{consent.document ? `Version ${consent.document.version}` : "Not published"}</TableCell>
                  <TableCell>
                    <StatusBadge label={decision.label} tone={decision.tone} />
                  </TableCell>
                  <TableCell>{consent.needed ? <StatusBadge label="Needed for care" tone="warning" size="sm" /> : null}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {recording && consents.data ? <RecordDrawer patientId={patientId} consents={consents.data} onOpenChange={setRecording} /> : null}
    </RecordSection>
  );
}

const CHANNELS: { value: ConsentRecord["channel"]; label: string }[] = [
  { value: "phone", label: "By phone" },
  { value: "in_person", label: "In person" },
];
const DECISIONS: { value: ConsentRecord["decision"]; label: string }[] = [
  { value: "given", label: "Agreed" },
  { value: "withdrawn", label: "Withdrew" },
];

function RecordDrawer({ patientId, consents, onOpenChange }: { patientId: string; consents: PatientConsent[]; onOpenChange: (open: boolean) => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const published = consents.filter((c) => c.document);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [decision, setDecision] = useState<ConsentRecord["decision"] | null>(null);
  const [channel, setChannel] = useState<ConsentRecord["channel"] | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const record = useMutation({
    mutationFn: () => patientsApi.recordConsent(current.tenantId, patientId, { documentId: documentId!, decision: decision!, channel: channel!, reason: reason.trim() }),
    onSuccess: (reply) => {
      queryClient.setQueryData(["patient", current.tenantId, patientId, "consents"], reply.consents);
      toast.success("Decision recorded");
      onOpenChange(false);
    },
    onError: (err) => setError(messageOf(err, "The decision was not recorded. Try again.")),
  });
  return (
    <EditDrawer
      open
      onOpenChange={onOpenChange}
      title="Record a decision"
      description="Only for a decision the patient told you themselves. It applies to the document's current version."
      saving={record.isPending}
      ready={documentId !== null && decision !== null && channel !== null && reason.trim() !== ""}
      error={error}
      onSave={() => {
        setError(null);
        record.mutate();
      }}
      saveLabel="Record decision"
    >
      <div className="field">
        <label htmlFor="consent-document">
          Document <span className="req">*</span>
        </label>
        <ChoiceSelect
          id="consent-document"
          value={documentId}
          onChange={setDocumentId}
          options={published.map((c) => ({ value: c.document!.documentId, label: `${CONSENT_KIND_LABELS[c.kind]}, version ${c.document!.version}` }))}
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="consent-decision">
            Decision <span className="req">*</span>
          </label>
          <ChoiceSelect id="consent-decision" value={decision} onChange={setDecision} options={DECISIONS} />
        </div>
        <div className="field">
          <label htmlFor="consent-channel">
            How they told you <span className="req">*</span>
          </label>
          <ChoiceSelect id="consent-channel" value={channel} onChange={setChannel} options={CHANNELS} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="consent-reason">
          Note <span className="req">*</span>
        </label>
        <Textarea id="consent-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="helper">Kept with the decision, for example the call it was made on.</div>
      </div>
    </EditDrawer>
  );
}
