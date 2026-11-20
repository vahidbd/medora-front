"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChoiceSelect, optionsOf } from "@/components/shared/choice-select";
import { EditDrawer } from "@/components/shared/record/edit-drawer";
import { RecordSection } from "@/components/shared/record/record-page";
import { LoadFailedState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { messageOf } from "@/lib/api/errors";
import { patientsApi } from "@/lib/api/patients";
import type { IdentityCheck, IdentityDocument, PatientIdentity } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { DOCUMENT_LABELS, IDENTITY_STATUS, IHI_STATUS_LABELS } from "@/lib/patients";

const OUTCOME_LABELS: Record<IdentityCheck["outcome"], string> = { verified: "Matched", not_matched: "Didn't match", unavailable: "Service unavailable" };
type Drawer = "verify" | "reopen" | null;

function ihiInWords(ihi: PatientIdentity["ihi"]): string {
  if (!ihi) return "Not looked up yet";
  if (!ihi.found) return `Not found (${formatDateTime(ihi.checkedAt)})`;
  return `Found, ${ihi.status ? IHI_STATUS_LABELS[ihi.status].toLowerCase() : "status unknown"} (${formatDateTime(ihi.checkedAt)})`;
}

/**
 * Identity (docs/decisions/patients.md IDN16 to IDN19): where the checks
 * stand and whether an IHI was found. The IHI itself never reaches a
 * staff screen. Staff verify by sighting a document, let a patient whose
 * checks didn't match try again, or look the IHI up again.
 */
export function IdentitySection({ patientId }: { patientId: string }) {
  const { current, can } = useTenant();
  const queryClient = useQueryClient();
  const key = ["patient", current.tenantId, patientId, "identity"];
  const identity = useQuery({ queryKey: key, queryFn: () => patientsApi.identity(current.tenantId, patientId) });
  const [drawer, setDrawer] = useState<Drawer>(null);
  const saved = (next: PatientIdentity, message: string) => {
    queryClient.setQueryData(key, next);
    void queryClient.invalidateQueries({ queryKey: ["patient", current.tenantId, patientId] });
    toast.success(message);
  };
  const lookUp = useMutation({
    mutationFn: () => patientsApi.lookUpIhi(current.tenantId, patientId),
    onSuccess: (next) => saved(next, "IHI looked up"),
    onError: (err) => toast.error("The IHI was not looked up", { description: messageOf(err) }),
  });

  const data = identity.data;
  const actions = data ? (
    <>
      {can("patients:verify_identity") && data.identityStatus !== "verified" ? (
        <Button variant="outline" size="sm" onClick={() => setDrawer("verify")}>
          Verify by sighting
        </Button>
      ) : null}
      {can("patients:manage") && data.identityStatus === "failed" ? (
        <Button variant="outline" size="sm" onClick={() => setDrawer("reopen")}>
          Let them try again
        </Button>
      ) : null}
      {can("patients:manage") && data.identityStatus === "verified" ? (
        <Button variant="outline" size="sm" disabled={lookUp.isPending} onClick={() => lookUp.mutate()}>
          Look up IHI again
        </Button>
      ) : null}
    </>
  ) : null;

  return (
    <RecordSection id="identity" title="Identity" subtitle="Checked before the first script" actions={actions}>
      {identity.isPending ? (
        <p className="cell-muted" aria-busy="true">
          Loading identity checks
        </p>
      ) : identity.isError ? (
        <LoadFailedState noun="identity check" onRetry={() => void identity.refetch()} />
      ) : (
        <>
          <dl className="facts">
            <dt>Status</dt>
            <dd>
              <StatusBadge label={IDENTITY_STATUS[identity.data.identityStatus].label} tone={IDENTITY_STATUS[identity.data.identityStatus].tone} />
            </dd>
            <dt>Verified with</dt>
            <dd>
              {identity.data.verification
                ? `${DOCUMENT_LABELS[identity.data.verification.documentType]}, ${identity.data.verification.method === "manual" ? "sighted by staff" : "checked online"}, ${formatDateTime(identity.data.verification.at)}`
                : "Not yet"}
            </dd>
            <dt>Online checks left</dt>
            <dd className="num">{identity.data.attemptsLeft}</dd>
            <dt>IHI</dt>
            <dd>{ihiInWords(identity.data.ihi)}</dd>
          </dl>
          {identity.data.checks.length > 0 ? (
            <Table aria-label="Identity checks">
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>How</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {identity.data.checks.map((check) => (
                  <TableRow key={`${check.at}:${check.documentType}`}>
                    <TableCell className="cell-muted">{formatDateTime(check.at)}</TableCell>
                    <TableCell>{DOCUMENT_LABELS[check.documentType]}</TableCell>
                    <TableCell>{check.method === "manual" ? "Sighted by staff" : "Online"}</TableCell>
                    <TableCell>{OUTCOME_LABELS[check.outcome]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </>
      )}
      {drawer === "verify" ? <VerifyDrawer patientId={patientId} onDone={(next) => saved(next, "Identity verified")} onOpenChange={(open) => !open && setDrawer(null)} /> : null}
      {drawer === "reopen" ? <ReopenDrawer patientId={patientId} onDone={(next) => saved(next, "They can check their identity again")} onOpenChange={(open) => !open && setDrawer(null)} /> : null}
    </RecordSection>
  );
}

function VerifyDrawer({ patientId, onDone, onOpenChange }: { patientId: string; onDone: (next: PatientIdentity) => void; onOpenChange: (open: boolean) => void }) {
  const { current } = useTenant();
  const [documentType, setDocumentType] = useState<IdentityDocument | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const verify = useMutation({
    mutationFn: () => patientsApi.verifyManually(current.tenantId, patientId, { documentType: documentType!, reason: reason.trim() }),
    onSuccess: (next) => {
      onDone(next);
      onOpenChange(false);
    },
    onError: (err) => setError(messageOf(err, "Identity was not verified. Try again.")),
  });
  return (
    <EditDrawer
      open
      onOpenChange={onOpenChange}
      title="Verify by sighting"
      description="Only after you have seen the original document, on a video call or in person, and it matches their legal name and date of birth."
      saving={verify.isPending}
      ready={documentType !== null && reason.trim() !== ""}
      error={error}
      onSave={() => {
        setError(null);
        verify.mutate();
      }}
      saveLabel="Verify identity"
    >
      <div className="field">
        <label htmlFor="verify-document">
          Document sighted <span className="req">*</span>
        </label>
        <ChoiceSelect id="verify-document" value={documentType} onChange={setDocumentType} options={optionsOf(DOCUMENT_LABELS)} />
      </div>
      <div className="field">
        <label htmlFor="verify-reason">
          How you sighted it <span className="req">*</span>
        </label>
        <Textarea id="verify-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="helper">Kept in the audit log. Don&apos;t type the document&apos;s number.</div>
      </div>
    </EditDrawer>
  );
}

function ReopenDrawer({ patientId, onDone, onOpenChange }: { patientId: string; onDone: (next: PatientIdentity) => void; onOpenChange: (open: boolean) => void }) {
  const { current } = useTenant();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reopen = useMutation({
    mutationFn: () => patientsApi.reopenIdentity(current.tenantId, patientId, reason.trim()),
    onSuccess: (next) => {
      onDone(next);
      onOpenChange(false);
    },
    onError: (err) => setError(messageOf(err, "Nothing changed. Try again.")),
  });
  return (
    <EditDrawer
      open
      onOpenChange={onOpenChange}
      title="Let them try again"
      description="Unlocks their online identity checks, once you know why the last ones didn't match."
      saving={reopen.isPending}
      ready={reason.trim() !== ""}
      error={error}
      onSave={() => {
        setError(null);
        reopen.mutate();
      }}
      saveLabel="Unlock checks"
    >
      <div className="field">
        <label htmlFor="reopen-reason">
          Reason <span className="req">*</span>
        </label>
        <Textarea id="reopen-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </EditDrawer>
  );
}
