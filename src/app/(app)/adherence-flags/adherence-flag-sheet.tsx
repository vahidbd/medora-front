"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SEVERITY_LABELS } from "@/components/patient/tracking-fields";
import { LoadFailedState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FLAG_KIND_LABELS, FLAG_OUTCOMES, FLAG_URGENCY } from "@/lib/adherence";
import { adherenceApi } from "@/lib/api/adherence";
import { messageOf } from "@/lib/api/errors";
import type { AdherenceFlagDetail, AdherenceFlagOutcome } from "@/lib/api/types";
import { formatCalendarDate, formatDateTime } from "@/lib/format";

type Resolution = NonNullable<AdherenceFlagDetail["resolution"]>;

const OUTCOMES = Object.keys(FLAG_OUTCOMES) as AdherenceFlagOutcome[];

type Navigation = {
  /** Closes the sheet. */
  onDone: () => void;
  /** Shows another adherence flag in the sheet: the one that reopened this one. */
  onShow: (adherenceFlagId: string) => void;
};

/**
 * One adherence flag (docs/decisions/adherence.md ADH13 to ADH15): the
 * patient's words, then resolving it, or what was done and a way to reopen
 * it once. Opening it is the audited read; nothing here is fetched before.
 */
export function AdherenceFlagSheet({
  adherenceFlagId,
  onShow,
  onOpenChange,
}: {
  adherenceFlagId: string | null;
  onShow: (adherenceFlagId: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={adherenceFlagId !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        {adherenceFlagId ? (
          <FlagReview key={adherenceFlagId} adherenceFlagId={adherenceFlagId} onDone={() => onOpenChange(false)} onShow={onShow} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function FlagReview({ adherenceFlagId, onDone, onShow }: { adherenceFlagId: string } & Navigation) {
  const { current } = useTenant();
  const flag = useQuery({
    queryKey: ["adherence-flag", current.tenantId, adherenceFlagId],
    queryFn: () => adherenceApi.get(current.tenantId, adherenceFlagId),
  });

  if (!flag.isSuccess) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Adherence flag</SheetTitle>
          <SheetDescription>{flag.isError ? "It did not load." : "Loading…"}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {flag.isError ? (
            <LoadFailedState noun="adherence flag" onRetry={() => void flag.refetch()} />
          ) : (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading the adherence flag">
              <Skeleton className="gate-skel-sub" />
              <Skeleton className="gate-skel-sub" />
            </div>
          )}
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Close
          </Button>
        </SheetFooter>
      </>
    );
  }

  return <FlagLoaded row={flag.data} onDone={onDone} onShow={onShow} />;
}

function FlagLoaded({ row, onDone, onShow }: { row: AdherenceFlagDetail } & Navigation) {
  const { current, can } = useTenant();
  const queryClient = useQueryClient();
  const resolving = row.status === "open" && can("adherence:resolve");
  const [outcome, setOutcome] = useState<AdherenceFlagOutcome | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resolve = useMutation({
    mutationFn: (chosen: AdherenceFlagOutcome) =>
      adherenceApi.resolve(current.tenantId, row.adherenceFlagId, { outcome: chosen, note: note.trim() || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["adherence-flags", current.tenantId] });
      void queryClient.invalidateQueries({ queryKey: ["adherence-flag", current.tenantId, row.adherenceFlagId] });
      toast.success("Adherence flag resolved");
      onDone();
    },
    onError: (err) => setError(messageOf(err)),
  });
  const urgency = FLAG_URGENCY[row.urgency];

  return (
    <>
      <SheetHeader>
        <SheetTitle>{row.patientName}</SheetTitle>
        <SheetDescription>
          {FLAG_KIND_LABELS[row.kind]}, {formatDateTime(row.raisedAt)}
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        <div className="field-stack">
          <dl className="facts" aria-label="Adherence flag">
            <dt>Urgency</dt>
            <dd>
              <StatusBadge label={urgency.label} tone={urgency.tone} />
            </dd>
            <dt>Status</dt>
            <dd>
              <StatusBadge label={row.status === "open" ? "Open" : "Resolved"} tone={row.status === "open" ? "info" : "success"} />
            </dd>
          </dl>
          {row.sideEffectId ? <SideEffectReport sideEffectId={row.sideEffectId} /> : null}
          {row.reopenedFrom ? <ResolutionFacts heading="Resolved before, then reopened" resolution={row.reopenedFrom} /> : null}
          {row.resolution ? (
            <ResolutionFacts heading="Resolution" resolution={row.resolution}>
              {row.reopenedAsId ? (
                <>
                  <dt>Reopened</dt>
                  <dd>
                    <Button type="button" variant="outline" size="sm" onClick={() => onShow(row.reopenedAsId!)}>
                      View the reopened adherence flag
                    </Button>
                  </dd>
                </>
              ) : null}
            </ResolutionFacts>
          ) : null}
          {resolving ? (
            <form
              id="resolve-form"
              className="field-stack"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                if (outcome) resolve.mutate(outcome);
                else setError("Choose what was done.");
              }}
            >
              <div className="field" role="group" aria-labelledby="resolve-outcome-label">
                <div className="field-label" id="resolve-outcome-label">
                  What was done <span className="req">*</span>
                </div>
                <RadioGroup value={outcome} onValueChange={(next) => setOutcome(next as AdherenceFlagOutcome)} aria-labelledby="resolve-outcome-label">
                  {OUTCOMES.map((key) => (
                    <label key={key} className="choice-row">
                      <RadioGroupItem value={key} />
                      <span>
                        {FLAG_OUTCOMES[key].label}
                        <span className="choice-sub">{FLAG_OUTCOMES[key].detail}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="field">
                <label htmlFor="resolve-note">
                  Note <span className="opt">optional</span>
                </label>
                <Textarea id="resolve-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="helper">What you did or agreed with the patient, up to 1,000 characters. It stays with this adherence flag.</div>
              </div>
              {error ? (
                <div className="field">
                  <div className="err" role="alert">
                    {error}
                  </div>
                </div>
              ) : null}
            </form>
          ) : null}
        </div>
      </SheetBody>
      {resolving ? (
        <SheetFooter note="A resolved adherence flag can't be changed. If it was a mistake, reopen it.">
          <Button type="button" variant="outline" onClick={onDone} disabled={resolve.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="resolve-form" disabled={resolve.isPending}>
            {resolve.isPending ? "Resolving…" : "Resolve"}
          </Button>
        </SheetFooter>
      ) : row.status === "open" ? (
        <SheetFooter note="Your role can read adherence flags but not resolve them.">
          <Button type="button" variant="outline" onClick={onDone}>
            Close
          </Button>
        </SheetFooter>
      ) : (
        <ReopenFooter row={row} canReopen={can("adherence:resolve")} onDone={onDone} onShow={onShow} />
      )}
    </>
  );
}

/** The report behind the flag, in the patient's words. Reading it is audited by the API. */
function SideEffectReport({ sideEffectId }: { sideEffectId: string }) {
  const { current } = useTenant();
  const report = useQuery({
    queryKey: ["side-effect", current.tenantId, sideEffectId],
    queryFn: () => adherenceApi.sideEffect(current.tenantId, sideEffectId),
  });
  return (
    <section aria-labelledby="flag-report-head" className="flex flex-col gap-2">
      <h3 className="choice-group-head" id="flag-report-head">
        What was reported
      </h3>
      {report.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading the report">
          <Skeleton className="gate-skel-sub" />
          <Skeleton className="gate-skel-sub" />
        </div>
      ) : report.isError ? (
        <LoadFailedState noun="side effect report" onRetry={() => void report.refetch()} />
      ) : (
        <dl className="facts">
          <dt>Severity</dt>
          <dd>{SEVERITY_LABELS[report.data.severity]}</dd>
          <dt>In their words</dt>
          <dd>{report.data.description}</dd>
          <dt>Started</dt>
          <dd>{report.data.startedOn ? formatCalendarDate(report.data.startedOn) : "Not set"}</dd>
          <dt>Reported</dt>
          <dd>
            {formatDateTime(report.data.reportedAt)}, {report.data.reportedBy === "patient" ? "by the patient" : "by the care team for them"}
          </dd>
        </dl>
      )}
    </section>
  );
}

function ResolutionFacts({ heading, resolution, children }: { heading: string; resolution: Resolution; children?: React.ReactNode }) {
  const headingId = heading === "Resolution" ? "flag-resolution-head" : "flag-earlier-head";
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 className="choice-group-head" id={headingId}>
        {heading}
      </h3>
      <dl className="facts">
        <dt>What was done</dt>
        <dd>{FLAG_OUTCOMES[resolution.outcome].label}</dd>
        <dt>Resolved</dt>
        <dd>
          {formatDateTime(resolution.resolvedAt)}
          {resolution.resolvedBy.displayName ? `, by ${resolution.resolvedBy.displayName}` : ""}
        </dd>
        <dt>Note</dt>
        <dd>{resolution.note ?? "Not set"}</dd>
        {children}
      </dl>
    </section>
  );
}

/**
 * Reopening undoes a mistaken resolution with a new open adherence flag,
 * once (ADH7). It asks first, because a reopening is a clinical record that
 * stays; a flag already reopened offers the one that reopened it instead.
 */
function ReopenFooter({ row, canReopen, onDone, onShow }: { row: AdherenceFlagDetail; canReopen: boolean } & Navigation) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reopen = useMutation({
    mutationFn: () => adherenceApi.reopen(current.tenantId, row.adherenceFlagId),
    onSuccess: (reopened) => {
      void queryClient.invalidateQueries({ queryKey: ["adherence-flags", current.tenantId] });
      void queryClient.invalidateQueries({ queryKey: ["adherence-flag", current.tenantId, row.adherenceFlagId] });
      toast.success("Adherence flag reopened", { description: "It is back under Open." });
      onShow(reopened.adherenceFlagId);
    },
    onError: (err) => {
      setConfirming(false);
      setError(messageOf(err));
    },
  });
  const offer = canReopen && row.reopenedAsId === null;
  const note = error ? (
    <span className="err" role="alert">
      {error}
    </span>
  ) : row.reopenedAsId ? (
    "Reopened as a new adherence flag."
  ) : offer ? (
    "Reopen only if it was resolved by mistake."
  ) : undefined;
  return (
    <SheetFooter note={note}>
      {offer ? (
        <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
          Reopen
        </Button>
      ) : null}
      <Button type="button" variant={offer ? "ghost" : "outline"} onClick={onDone}>
        Close
      </Button>
      <AlertDialog open={confirming} onOpenChange={(open) => !reopen.isPending && setConfirming(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this adherence flag?</AlertDialogTitle>
            <AlertDialogDescription>
              A new open adherence flag takes its place, showing this resolution. This one stays as it is, and it can be reopened only
              once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopen.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={reopen.isPending} onClick={() => reopen.mutate()}>
              {reopen.isPending ? "Reopening…" : "Reopen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SheetFooter>
  );
}
