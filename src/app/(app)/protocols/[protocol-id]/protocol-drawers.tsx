"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EditDrawer } from "@/components/shared/record/edit-drawer";
import { useTenant } from "@/components/shell/tenant-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { messageOf } from "@/lib/api/errors";
import { protocolsApi } from "@/lib/api/protocols";
import type { ProtocolDetail, ProtocolVersion } from "@/lib/api/types";
import { attestationOf, REGISTRATION } from "@/lib/protocols";

type Problem = { path: string; message: string };
const problemsOf = (err: unknown): Problem[] =>
  err instanceof ApiError && err.code === "protocol_problems" && typeof err.details === "object" && err.details !== null && "problems" in err.details
    ? ((err.details as { problems: Problem[] }).problems ?? [])
    : [];

function useRefresh(protocolId: string) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["protocol", current.tenantId, protocolId] });
    void queryClient.invalidateQueries({ queryKey: ["protocols", current.tenantId] });
  };
}

/**
 * Edit a draft's questions and rules as the definition the API checks
 * (INT1). The API answers with each problem's path; nothing is saved until
 * there are none. Only a draft is ever edited (INT3).
 */
export function EditDraftDrawer({ protocol, draft, onOpenChange }: { protocol: ProtocolDetail; draft: ProtocolVersion; onOpenChange: (open: boolean) => void }) {
  const { current } = useTenant();
  const refresh = useRefresh(protocol.protocolId);
  const [text, setText] = useState(() => JSON.stringify(draft.definition, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);

  const save = useMutation({
    mutationFn: (definition: Record<string, unknown>) => protocolsApi.saveDraft(current.tenantId, protocol.protocolId, definition),
    onSuccess: () => {
      refresh();
      toast.success("Draft saved", { description: `${protocol.name}, version ${draft.version}` });
      onOpenChange(false);
    },
    onError: (err) => {
      setProblems(problemsOf(err));
      setError(messageOf(err, "The draft was not saved. Try again."));
    },
  });

  return (
    <EditDrawer
      open
      onOpenChange={onOpenChange}
      title={`Edit draft version ${draft.version}`}
      description="Steps, questions, derived numbers and rules, as the protocol language writes them."
      note="Nothing reaches patients until a medical director signs this version off."
      saving={save.isPending}
      ready={text.trim() !== ""}
      error={error}
      onSave={() => {
        setError(null);
        setProblems([]);
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          setError("This isn't valid JSON. Check for a missing comma, bracket or quote.");
          return;
        }
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setError("The definition is an object with steps, derived numbers and rules.");
          return;
        }
        save.mutate(parsed as Record<string, unknown>);
      }}
      saveLabel="Save draft"
    >
      <div className="field">
        <label htmlFor="draft-definition">Definition</label>
        <Textarea id="draft-definition" rows={24} className="font-mono" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {problems.length > 0 ? (
        <Alert variant="danger">
          <AlertDescription>
            <ul aria-label="Problems to fix" className="list-disc pl-4">
              {problems.map((problem) => (
                <li key={`${problem.path}:${problem.message}`}>
                  <span className="font-mono">{problem.path || "definition"}</span>: {problem.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </EditDrawer>
  );
}

/**
 * A medical director signs off the draft under their Ahpra registration
 * (INT4). The attestation shown is the one the API stores, word for word.
 * Signing makes the draft live and retires the live version.
 */
export function SignOffDrawer({ protocol, onOpenChange }: { protocol: ProtocolDetail; onOpenChange: (open: boolean) => void }) {
  const { current } = useTenant();
  const refresh = useRefresh(protocol.protocolId);
  const version = protocol.draftVersion!;
  const [registration, setRegistration] = useState("");
  const [attest, setAttest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typed = registration.trim().toUpperCase();
  const valid = REGISTRATION.test(typed);

  const sign = useMutation({
    mutationFn: () => protocolsApi.signOff(current.tenantId, protocol.protocolId, { version, registration: typed, attest: true }),
    onSuccess: () => {
      refresh();
      toast.success("Signed off. This version is live", { description: `${protocol.name}, version ${version}` });
      onOpenChange(false);
    },
    onError: (err) => setError(messageOf(err, "The version was not signed off. Try again.")),
  });

  return (
    <EditDrawer
      open
      onOpenChange={onOpenChange}
      title={`Sign off version ${version}`}
      description="Read every question and rule first. Signing puts this version in front of patients."
      note={protocol.liveVersion ? `Version ${protocol.liveVersion} retires. Intakes already started finish on it.` : undefined}
      saving={sign.isPending}
      ready={valid && attest}
      error={error}
      onSave={() => {
        setError(null);
        sign.mutate();
      }}
      saveLabel="Sign off"
    >
      <div className="field">
        <label htmlFor="sign-off-registration">
          Your Ahpra registration <span className="req">*</span>
        </label>
        <Input id="sign-off-registration" autoComplete="off" className="font-mono" maxLength={13} placeholder="MED0001234567" value={registration} onChange={(e) => setRegistration(e.target.value)} />
        <div className="helper">As a medical practitioner: MED and ten digits.</div>
      </div>
      <label className="choice-row">
        <Checkbox checked={attest} onCheckedChange={(on) => setAttest(on === true)} />
        <span>{attestationOf(protocol.name, version, valid ? typed : "")}</span>
      </label>
    </EditDrawer>
  );
}

/** Withdraw the live version for safety, with a reason (INT4). */
export function WithdrawDrawer({ protocol, onOpenChange }: { protocol: ProtocolDetail; onOpenChange: (open: boolean) => void }) {
  const { current } = useTenant();
  const refresh = useRefresh(protocol.protocolId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const withdraw = useMutation({
    mutationFn: () => protocolsApi.withdraw(current.tenantId, protocol.protocolId, reason.trim()),
    onSuccess: () => {
      refresh();
      toast.success("Version withdrawn", { description: `${protocol.name}, version ${protocol.liveVersion}` });
      onOpenChange(false);
    },
    onError: (err) => setError(messageOf(err, "The version was not withdrawn. Try again.")),
  });

  return (
    <EditDrawer
      open
      onOpenChange={onOpenChange}
      title={`Withdraw version ${protocol.liveVersion}`}
      description="For safety. New intakes stop, and intakes in progress on it end and must start again."
      note="Prescribers see that the version was withdrawn on completed intakes not yet consulted."
      saving={withdraw.isPending}
      ready={reason.trim() !== ""}
      error={error}
      onSave={() => {
        setError(null);
        withdraw.mutate();
      }}
      saveLabel="Withdraw version"
    >
      <div className="field">
        <label htmlFor="withdraw-reason">
          Reason <span className="req">*</span>
        </label>
        <Textarea id="withdraw-reason" rows={4} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="helper">Kept with the version. Don&apos;t include patient details.</div>
      </div>
    </EditDrawer>
  );
}
