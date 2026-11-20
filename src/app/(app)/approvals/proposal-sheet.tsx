"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyField, NumberField } from "@/components/ui/number-field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AGENT_LABELS, DECISION_REASON_LABELS, PROPOSAL_STATUS, REJECT_REASONS, fieldLabel, fieldValue, toolLabel } from "@/lib/agents";
import { proposalsApi } from "@/lib/api/agents";
import { messageOf } from "@/lib/api/errors";
import type { DecisionReason, Proposal } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

type Fields = Record<string, unknown>;

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const asFields = (value: unknown): Fields => (value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : {});

/** Text and numbers can be corrected before approving; times and nested values are approved or rejected as they are. */
const editable = (value: unknown) => typeof value === "number" || (typeof value === "string" && !ISO_TIME.test(value));

/**
 * One proposal as an approval card (AIP-13): exactly what will run, which
 * the approver may correct before approving. The patient it is for is set
 * by the API from the conversation, so it is never shown or changed here.
 */
export function ProposalSheet({ proposal, onOpenChange }: { proposal: Proposal | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={proposal !== null} onOpenChange={onOpenChange}>
      <SheetContent>{proposal ? <ProposalCard key={proposal.proposalId} proposal={proposal} onDone={() => onOpenChange(false)} /> : null}</SheetContent>
    </Sheet>
  );
}

function ProposalCard({ proposal, onDone }: { proposal: Proposal; onDone: () => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const pending = proposal.status === "pending";
  const original = asFields(proposal.input);
  const [fields, setFields] = useState<Fields>(original);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const edited = Object.keys(original).some((key) => fields[key] !== original[key]);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["proposals", current.tenantId] });

  const approve = useMutation({
    mutationFn: () => proposalsApi.approve(current.tenantId, proposal.proposalId, edited ? { finalInput: fields } : {}),
    onSuccess: (reply) => {
      refresh();
      if (reply.status === "executed") toast.success("Approved and done", { description: toolLabel(proposal.tool) });
      else toast.error("Approved, but it did not go through", { description: "The agent is told, and nothing was changed." });
      onDone();
    },
    onError: (err) => {
      refresh();
      setError(messageOf(err));
    },
  });

  const shown = pending ? fields : asFields(proposal.finalInput ?? proposal.input);

  return (
    <>
      <SheetHeader>
        <SheetTitle>{toolLabel(proposal.tool)}</SheetTitle>
        <SheetDescription>
          {AGENT_LABELS[proposal.agent]}, {formatDateTime(proposal.createdAt)}
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form
          id="proposal-form"
          className="field-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            approve.mutate();
          }}
        >
          <h3 className="choice-group-head">What will happen</h3>
          {Object.keys(shown).length === 0 ? <p className="helper">Nothing to fill in: it runs as it is.</p> : null}
          {Object.entries(shown).map(([key, value]) =>
            pending && editable(value) ? (
              <EditField key={key} name={key} value={value as string | number} onChange={(next) => setFields((f) => ({ ...f, [key]: next }))} />
            ) : (
              <dl key={key} className="facts">
                <dt>{fieldLabel(key)}</dt>
                <dd>{fieldValue(key, value)}</dd>
              </dl>
            ),
          )}
          {proposal.rationale ? (
            <dl className="facts">
              <dt>The agent&apos;s reason</dt>
              <dd>{proposal.rationale}</dd>
            </dl>
          ) : null}
          <dl className="facts">
            {pending ? (
              <>
                <dt>Expires</dt>
                <dd>{formatDateTime(proposal.expiresAt)}</dd>
              </>
            ) : (
              <>
                <dt>Outcome</dt>
                <dd>
                  <StatusBadge label={PROPOSAL_STATUS[proposal.status].label} tone={PROPOSAL_STATUS[proposal.status].tone} />
                </dd>
                {proposal.decidedAt ? (
                  <>
                    <dt>Decided</dt>
                    <dd>{formatDateTime(proposal.decidedAt)}</dd>
                  </>
                ) : null}
                {proposal.decisionReason ? (
                  <>
                    <dt>Reason</dt>
                    <dd>{DECISION_REASON_LABELS[proposal.decisionReason as DecisionReason] ?? proposal.decisionReason}</dd>
                  </>
                ) : null}
              </>
            )}
          </dl>
          {error ? (
            <div className="err" role="alert">
              {error}
            </div>
          ) : null}
        </form>
      </SheetBody>
      <SheetFooter note={pending ? "It runs once, with your access, the moment you approve." : undefined}>
        {pending ? (
          <>
            <Button type="button" variant="outline" onClick={() => setRejecting(true)} disabled={approve.isPending}>
              Reject
            </Button>
            <Button type="submit" form="proposal-form" disabled={approve.isPending}>
              {approve.isPending ? "Approving…" : edited ? "Approve with changes" : "Approve"}
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" onClick={onDone}>
            Close
          </Button>
        )}
      </SheetFooter>
      <RejectDialog
        open={rejecting}
        proposal={proposal}
        onOpenChange={setRejecting}
        onRejected={() => {
          refresh();
          onDone();
        }}
      />
    </>
  );
}

function EditField({ name, value, onChange }: { name: string; value: string | number; onChange: (value: string | number) => void }) {
  const id = `proposal-${name}`;
  if (typeof value === "number") {
    const money = name.endsWith("Cents");
    return (
      <div className="field">
        <label htmlFor={id}>{fieldLabel(name)}</label>
        {money ? (
          <MoneyField id={id} min={0} value={(value / 100).toFixed(2)} onValueChange={(next) => onChange(Math.round(Number(next || "0") * 100))} />
        ) : (
          <NumberField id={id} value={String(value)} onValueChange={(next) => onChange(Number(next || "0"))} />
        )}
      </div>
    );
  }
  return (
    <div className="field">
      <label htmlFor={id}>{fieldLabel(name)}</label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function RejectDialog({
  open,
  proposal,
  onOpenChange,
  onRejected,
}: {
  open: boolean;
  proposal: Proposal;
  onOpenChange: (open: boolean) => void;
  onRejected: () => void;
}) {
  const { current } = useTenant();
  const [reason, setReason] = useState<DecisionReason>("not_needed");
  const [error, setError] = useState<string | null>(null);
  const reject = useMutation({
    mutationFn: () => proposalsApi.reject(current.tenantId, proposal.proposalId, reason),
    onSuccess: () => {
      toast.success("Rejected", { description: toolLabel(proposal.tool) });
      onOpenChange(false);
      onRejected();
    },
    onError: (err) => setError(messageOf(err)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this proposal?</DialogTitle>
          <DialogDescription>Nothing changes, and the agent is told your reason the next time it runs.</DialogDescription>
        </DialogHeader>
        <form
          id="reject-form"
          className="dlg-body"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            reject.mutate();
          }}
        >
          <div className="field" role="group" aria-labelledby="reject-reason-label">
            <div className="field-label" id="reject-reason-label">
              Reason
            </div>
            <RadioGroup value={reason} onValueChange={(next) => setReason(next as DecisionReason)} aria-labelledby="reject-reason-label">
              {REJECT_REASONS.map((key) => (
                <label key={key} className="choice-row">
                  <RadioGroupItem value={key} />
                  <span>{DECISION_REASON_LABELS[key]}</span>
                </label>
              ))}
            </RadioGroup>
            {error ? (
              <div className="err" role="alert">
                {error}
              </div>
            ) : null}
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={reject.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="reject-form" variant="destructive" disabled={reject.isPending}>
            {reject.isPending ? "Rejecting…" : "Reject proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
