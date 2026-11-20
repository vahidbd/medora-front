"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MoreHorizontal, Plus } from "lucide-react";
import { ChoiceSelect, optionsOf } from "@/components/shared/choice-select";
import { EmptyState } from "@/components/shared/empty-state";
import { EditDrawer } from "@/components/shared/record/edit-drawer";
import { RecordSection } from "@/components/shared/record/record-page";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateField } from "@/components/ui/date-field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cliniciansApi } from "@/lib/api/clinicians";
import type { ClinicianDetail, Credential, NewCredential } from "@/lib/api/types";
import {
  CREDENTIAL_KIND_LABELS,
  credentialState,
  REGISTERED_BY,
  REGISTERING_BODY_LABELS,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_TYPE_LABELS,
} from "@/lib/clinicians";
import { formatDate } from "@/lib/format";
import { errorText, useClinicianAccess, useClinicianUpdate } from "./clinician-page";

type Kind = Credential["kind"];

/** What a credential is, in one line: its reference, insurer or endorsement. */
function describe(credential: Credential): string {
  if (credential.kind === "indemnity") return [credential.insurer, credential.reference].filter(Boolean).join(", ");
  if (credential.kind === "registration") {
    const parts = [credential.reference, credential.registrationStatus ? REGISTRATION_STATUS_LABELS[credential.registrationStatus] : null];
    return parts.filter(Boolean).join(", ");
  }
  return credential.reference ?? "";
}

/**
 * Registrations, endorsements and indemnity. The clinician or a manager
 * records one; someone else who manages clinicians checks it (WRK2, WRK4 in
 * the API). Withdrawn and replaced ones stay listed, so the history shows.
 */
export function CredentialsSection({ clinician, credentials }: { clinician: ClinicianDetail; credentials: Credential[] }) {
  const access = useClinicianAccess(clinician);
  const [adding, setAdding] = useState(false);
  return (
    <RecordSection
      id="credentials"
      title="Credentials"
      subtitle="Each one counts once someone other than the clinician checks it"
      flush
      actions={
        access.mayEdit ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            Add credential
          </Button>
        ) : null
      }
    >
      {credentials.length === 0 ? (
        <div className="record-pad">
          <EmptyState title="No credentials yet" description="Add their registration and indemnity." />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Credential</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Ends</TableHead>
              <TableHead>State</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {credentials.map((credential) => {
              const state = credentialState(credential);
              return (
                <TableRow key={credential.credentialId}>
                  <TableCell>{CREDENTIAL_KIND_LABELS[credential.kind]}</TableCell>
                  <TableCell>{describe(credential)}</TableCell>
                  <TableCell>{formatDate(credential.expiresOn)}</TableCell>
                  <TableCell>
                    <StatusBadge label={state.label} tone={state.tone} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CredentialActions clinician={clinician} credential={credential} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {adding ? <AddCredentialDrawer clinician={clinician} onClose={() => setAdding(false)} /> : null}
    </RecordSection>
  );
}

function CredentialActions({ clinician, credential }: { clinician: ClinicianDetail; credential: Credential }) {
  const access = useClinicianAccess(clinician);
  const { current } = useTenant();
  const update = useClinicianUpdate(clinician.clinicianId);
  const act = useMutation({
    mutationFn: (action: "verify" | "review-conditions" | "withdraw") =>
      action === "withdraw"
        ? cliniciansApi.withdrawCredential(current.tenantId, clinician.clinicianId, credential.credentialId, "no_longer_held")
        : cliniciansApi.credentialAction(current.tenantId, clinician.clinicianId, credential.credentialId, action),
    onSuccess: update,
  });
  if (credential.withdrawnAt) return null;
  const items: { action: "verify" | "review-conditions" | "withdraw"; label: string; destructive?: boolean }[] = [];
  if (access.mayCheck) items.push({ action: "verify", label: credential.verifiedAt ? "Record a re-check today" : "Record it was checked today" });
  if (access.mayCheck && credential.conditions && !credential.conditionsReviewedAt) items.push({ action: "review-conditions", label: "Record the conditions were reviewed" });
  if (access.manages || (access.isSelf && !credential.verifiedAt)) items.push({ action: "withdraw", label: "Withdraw, no longer held", destructive: true });
  if (items.length === 0) return null;
  const name = `Actions for ${CREDENTIAL_KIND_LABELS[credential.kind].toLowerCase()}`;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={name} title={name} disabled={act.isPending}>
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-max min-w-(--menu-min-w)">
          {items.map((item) => (
            <DropdownMenuItem key={item.action} variant={item.destructive ? "destructive" : "default"} onClick={() => act.mutate(item.action)}>
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {act.error ? (
        <span className="err" role="alert">
          {errorText(act.error, "That didn't save. Try again.")}
        </span>
      ) : null}
    </>
  );
}

type Draft = {
  kind: Kind | null;
  reference: string;
  registrationType: NonNullable<Credential["registrationType"]> | null;
  registrationStatus: NonNullable<Credential["registrationStatus"]> | null;
  conditions: string;
  insurer: string;
  coversTelehealthNewPatients: boolean;
  expiresOn: string;
};

function bodyOf(draft: Draft, registeringBody: "ahpra" | "dietitians_australia" | null): NewCredential | null {
  const reference = draft.reference.trim();
  if (draft.kind === "registration" && registeringBody && reference && draft.registrationStatus && draft.expiresOn) {
    return {
      kind: "registration",
      registeringBody,
      reference,
      registrationType: draft.registrationType,
      registrationStatus: draft.registrationStatus,
      conditions: draft.conditions.trim() || null,
      expiresOn: draft.expiresOn,
    };
  }
  if (draft.kind === "indemnity" && draft.insurer.trim() && draft.expiresOn) {
    return { kind: "indemnity", insurer: draft.insurer.trim(), reference: reference || null, coversTelehealthNewPatients: draft.coversTelehealthNewPatients, expiresOn: draft.expiresOn };
  }
  if (draft.kind === "endorsement") return { kind: "endorsement", endorsement: "nurse_practitioner", reference: reference || null, expiresOn: draft.expiresOn || null };
  return null;
}

function AddCredentialDrawer({ clinician, onClose }: { clinician: ClinicianDetail; onClose: () => void }) {
  const { current } = useTenant();
  const update = useClinicianUpdate(clinician.clinicianId);
  const registeringBody = REGISTERED_BY[clinician.profession];
  const kinds = (["registration", "endorsement", "indemnity"] as const).filter(
    (kind) => (kind !== "registration" || registeringBody) && (kind !== "endorsement" || clinician.profession === "nurse_practitioner"),
  );
  const [draft, setDraft] = useState<Draft>({
    kind: null,
    reference: "",
    registrationType: null,
    registrationStatus: "practising",
    conditions: "",
    insurer: "",
    coversTelehealthNewPatients: true,
    expiresOn: "",
  });
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const body = bodyOf(draft, registeringBody);
  const add = useMutation({
    mutationFn: (next: NewCredential) => cliniciansApi.addCredential(current.tenantId, clinician.clinicianId, next),
    onSuccess: (detail) => {
      update(detail);
      onClose();
    },
  });

  return (
    <EditDrawer
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Add credential"
      description="Record it as the register or the policy shows it."
      note="Someone else checks it before it counts."
      saveLabel="Add credential"
      saving={add.isPending}
      ready={body !== null}
      error={add.error ? errorText(add.error, "The credential wasn't added. Try again.") : null}
      onSave={() => (body ? add.mutate(body) : undefined)}
    >
      <div className="field">
        <label htmlFor="credential-kind">Credential</label>
        <ChoiceSelect id="credential-kind" value={draft.kind} onChange={(kind) => set({ kind })} options={kinds.map((k) => ({ value: k, label: CREDENTIAL_KIND_LABELS[k] }))} />
      </div>
      {draft.kind === "registration" && registeringBody ? (
        <>
          <div className="field-row">
            <div className="field">
              <label htmlFor="credential-reference">{REGISTERING_BODY_LABELS[registeringBody]} registration number</label>
              <Input id="credential-reference" value={draft.reference} onChange={(e) => set({ reference: e.target.value })} maxLength={40} />
            </div>
            <div className="field">
              <label htmlFor="credential-status">Status</label>
              <ChoiceSelect id="credential-status" value={draft.registrationStatus} onChange={(registrationStatus) => set({ registrationStatus })} options={optionsOf(REGISTRATION_STATUS_LABELS)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="credential-type">
                Type <span className="opt">optional</span>
              </label>
              <ChoiceSelect id="credential-type" value={draft.registrationType} onChange={(registrationType) => set({ registrationType })} options={optionsOf(REGISTRATION_TYPE_LABELS)} />
            </div>
            <ExpiryField draft={draft} set={set} />
          </div>
          <div className="field">
            <label htmlFor="credential-conditions">
              Conditions, undertakings or notations <span className="opt">optional</span>
            </label>
            <Textarea id="credential-conditions" value={draft.conditions} onChange={(e) => set({ conditions: e.target.value })} maxLength={2000} />
            <p className="helper">As the register shows them. Someone else reviews them before the clinician can see patients.</p>
          </div>
        </>
      ) : null}
      {draft.kind === "indemnity" ? (
        <>
          <div className="field-row">
            <div className="field">
              <label htmlFor="credential-insurer">Insurer</label>
              <Input id="credential-insurer" value={draft.insurer} onChange={(e) => set({ insurer: e.target.value })} maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="credential-reference">
                Policy number <span className="opt">optional</span>
              </label>
              <Input id="credential-reference" value={draft.reference} onChange={(e) => set({ reference: e.target.value })} maxLength={60} />
            </div>
          </div>
          <ExpiryField draft={draft} set={set} />
          <div className="toggle-row">
            <div className="flex min-w-0 items-center gap-3">
              <Checkbox id="credential-telehealth" checked={draft.coversTelehealthNewPatients} onCheckedChange={(checked) => set({ coversTelehealthNewPatients: checked === true })} />
              <label htmlFor="credential-telehealth" className="min-w-0">
                <span className="t block">Covers telehealth with new patients</span>
                <span className="d block">Without it the clinician can&apos;t consult.</span>
              </label>
            </div>
          </div>
        </>
      ) : null}
      {draft.kind === "endorsement" ? (
        <div className="field-row">
          <div className="field">
            <label htmlFor="credential-reference">
              Reference <span className="opt">optional</span>
            </label>
            <Input id="credential-reference" value={draft.reference} onChange={(e) => set({ reference: e.target.value })} maxLength={40} />
          </div>
          <ExpiryField draft={draft} set={set} optional />
        </div>
      ) : null}
    </EditDrawer>
  );
}

function ExpiryField({ draft, set, optional = false }: { draft: Draft; set: (patch: Partial<Draft>) => void; optional?: boolean }) {
  return (
    <div className="field">
      <label htmlFor="credential-expires">
        Ends on {optional ? <span className="opt">optional</span> : null}
      </label>
      <DateField id="credential-expires" value={draft.expiresOn} onValueChange={(expiresOn) => set({ expiresOn })} />
    </div>
  );
}
