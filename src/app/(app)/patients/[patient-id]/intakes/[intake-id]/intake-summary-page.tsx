"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, Lock, ShieldAlert } from "lucide-react";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { RecordPage, RecordPageSkeleton, RecordSection } from "@/components/shared/record/record-page";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import { intakesApi } from "@/lib/api/patients";
import type { IntakeSummary } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { OUTCOME } from "@/lib/protocols";

const SECTIONS = [
  { id: "outcome", label: "Outcome" },
  { id: "numbers", label: "Worked out" },
  { id: "answers", label: "Answers" },
  { id: "earlier", label: "Earlier hard stops" },
];

/** What the prescriber should weigh before reading on: an old answer, a withdrawn version, a date of birth that isn't the patient's. */
function ReadFirst({ summary }: { summary: IntakeSummary }) {
  return (
    <>
      {summary.dateOfBirthDiffers ? (
        <Alert variant="danger">
          <AlertTitle>Started with another date of birth</AlertTitle>
          <AlertDescription>
            The date of birth given on this intake isn&apos;t the one on the patient&apos;s record. It may have been answered by someone else on the same device.
          </AlertDescription>
        </Alert>
      ) : null}
      {summary.versionWithdrawn ? (
        <Alert variant="warning">
          <AlertTitle>Answered on a withdrawn version</AlertTitle>
          <AlertDescription>Version {summary.protocolVersion} of this protocol was withdrawn for safety after these answers were given.</AlertDescription>
        </Alert>
      ) : null}
      {summary.stale ? (
        <Alert variant="warning">
          <AlertTitle>Answered more than 30 days ago</AlertTitle>
          <AlertDescription>Check what may have changed, such as weight or medicines, before relying on these answers.</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

function OutcomeSection({ summary }: { summary: IntakeSummary }) {
  return (
    <RecordSection id="outcome" title="Outcome" subtitle="The protocol's rules, in its words for the prescriber">
      <div className="flex flex-col gap-3">
        <ReadFirst summary={summary} />
        {summary.stop ? (
          <Alert variant="danger">
            <AlertTitle>Stopped: {summary.stop.message}</AlertTitle>
            <AlertDescription>A hard stop ended this intake, so it was never sent for a consult.</AlertDescription>
          </Alert>
        ) : null}
        {summary.redFlags.length > 0 ? (
          <dl className="facts">
            {summary.redFlags.map((flag) => (
              <Fragment key={flag.rule}>
                <dt>Red flag</dt>
                <dd>{flag.message}</dd>
              </Fragment>
            ))}
          </dl>
        ) : summary.stop ? null : (
          <p className="cell-muted">No red flags. Nothing in the answers met a red flag rule.</p>
        )}
      </div>
    </RecordSection>
  );
}

function NumbersSection({ summary }: { summary: IntakeSummary }) {
  return (
    <RecordSection id="numbers" title="Worked out" subtitle="Numbers the protocol works out from the answers">
      {summary.derived.length === 0 ? (
        <p className="cell-muted">This protocol works nothing out.</p>
      ) : (
        <dl className="facts">
          {summary.derived.map((number) => (
            <Fragment key={number.key}>
              <dt>{number.label}</dt>
              <dd className="num">{number.value === null ? <span className="empty">Not enough answers</span> : `${number.value}${number.unit ? ` ${number.unit}` : ""}`}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </RecordSection>
  );
}

function AnswersSection({ summary }: { summary: IntakeSummary }) {
  return (
    <RecordSection id="answers" title="Answers" subtitle="In question order, as the patient saw them" flush>
      {summary.items.length === 0 ? (
        <EmptyState boxed={false} title="No answers" description="Nothing was answered before this intake ended." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Answer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.items.map((item) => (
              <TableRow key={item.questionKey}>
                <TableCell className="cell-muted">{item.question}</TableCell>
                <TableCell>
                  <span className="whitespace-pre-wrap">{item.answer}</span>
                  {item.redFlag ? (
                    <span className="ml-2">
                      <StatusBadge label="Red flag" tone="warning" />
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </RecordSection>
  );
}

function EarlierSection({ summary }: { summary: IntakeSummary }) {
  return (
    <RecordSection id="earlier" title="Earlier hard stops" subtitle="This patient's earlier intakes that a hard stop ended" flush>
      {summary.earlierIneligible.length === 0 ? (
        <EmptyState boxed={false} title="None" description="No earlier intake of this patient's was stopped." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stopped</TableHead>
              <TableHead>Rule</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.earlierIneligible.map((earlier) => (
              <TableRow key={earlier.intakeId}>
                <TableCell>{formatDate(earlier.submittedAt)}</TableCell>
                <TableCell>{earlier.rule}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </RecordSection>
  );
}

/**
 * The prescriber's summary of one finished intake (docs/decisions/intake.md
 * INT15, INT22). Reading it needs intakes:read, a clinical permission, so a role
 * that holds it without clinical access opens break-glass first; the API
 * audits every read.
 */
export function IntakeSummaryPage({ patientId, intakeId }: { patientId: string; intakeId: string }) {
  const { current } = useTenant();
  // No automatic retry: a refusal or a missing intake won't change by asking again, and Try again is on every failure.
  const summary = useQuery({ queryKey: ["intake", current.tenantId, intakeId], queryFn: () => intakesApi.summary(current.tenantId, intakeId), retry: false });

  if (summary.isPending) return <RecordPageSkeleton label="Loading intake summary" />;
  const error = summary.error instanceof ApiError ? summary.error : null;
  if (error?.code === "break_glass_required") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Break-glass needed"
        description="Your role reads intake answers only for a reason. Open break-glass in the top bar, then try again."
        actionLabel="Try again"
        onAction={() => void summary.refetch()}
      />
    );
  }
  if (error?.status === 403) {
    return <EmptyState icon={Lock} title="Not open to your role" description="Intake answers are for the people who prescribe and care for this patient." />;
  }
  if (error?.status === 404 || (summary.data && summary.data.patientId !== patientId)) {
    return <EmptyState icon={ClipboardList} title="Intake not found" description="It isn't one of this patient's finished intakes. Choose one from the patient's record." />;
  }
  if (summary.isError) return <LoadFailedState noun="intake summary" onRetry={() => void summary.refetch()} />;

  const s = summary.data;
  const outcome = OUTCOME[s.outcome];
  return (
    <RecordPage
      title={`${s.programName} intake`}
      badge={{ label: outcome.label, tone: outcome.tone }}
      meta={[
        { key: "protocol", label: "Protocol", value: `${s.protocolName}, version ${s.protocolVersion}` },
        { key: "at", label: s.status === "completed" ? "Sent" : "Stopped", value: formatDateTime(s.submittedAt), icon: CalendarDays },
      ]}
      actions={
        <Link href={`/patients/${patientId}#intakes`} className="btn btn-outline btn-sm">
          Open patient
        </Link>
      }
      sections={SECTIONS}
    >
      <OutcomeSection summary={s} />
      <NumbersSection summary={s} />
      <AnswersSection summary={s} />
      <EarlierSection summary={s} />
    </RecordPage>
  );
}
