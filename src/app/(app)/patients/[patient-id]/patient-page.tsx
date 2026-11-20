"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, UserRound } from "lucide-react";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { RecordPage, RecordPageSkeleton, RecordSection } from "@/components/shared/record/record-page";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import { patientsApi } from "@/lib/api/patients";
import type { Patient, PatientIntake } from "@/lib/api/types";
import { formatCalendarDate, formatDate } from "@/lib/format";
import { IDENTITY_STATUS, SEX_LABELS } from "@/lib/patients";
import { END_REASON_LABELS, INTAKE_STATUS } from "@/lib/protocols";
import { ConsentsSection } from "./consents-section";
import { IdentitySection } from "./identity-section";

const SECTIONS = [
  { id: "details", label: "Details" },
  { id: "identity", label: "Identity" },
  { id: "consents", label: "Consents" },
  { id: "intakes", label: "Intakes" },
];

function addressInWords(address: Patient["address"]): string | null {
  if (!address) return null;
  return [address.line1, address.line2, `${address.suburb} ${address.state} ${address.postcode}`].filter(Boolean).join(", ");
}

function Fact({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>{value ? value : <span className="empty">Not given</span>}</dd>
    </>
  );
}

/** Side by side, the two columns share their five rows (grid-app.css, .facts-2). */
const FIVE_ROWS = { "--rows": 5 } as CSSProperties;

function DetailsSection({ patient }: { patient: Patient }) {
  const medicare = patient.medicare
    ? [patient.medicare.masked, patient.medicare.irn ? `IRN ${patient.medicare.irn}` : null, patient.medicare.validTo ? `valid to ${patient.medicare.validTo}` : null]
        .filter(Boolean)
        .join(", ")
    : null;
  return (
    <RecordSection id="details" title="Details" subtitle="As the patient gave them">
      <div className="facts-2">
        <dl className="facts" style={FIVE_ROWS}>
          <Fact label="Legal name" value={`${patient.givenName} ${patient.familyName}`} />
          <Fact label="Preferred name" value={patient.preferredName} />
          <Fact label="Date of birth" value={formatCalendarDate(patient.dateOfBirth)} />
          <Fact label="Sex" value={SEX_LABELS[patient.sex]} />
          <Fact label="Time zone" value={patient.timeZone ?? "The tenant's"} />
        </dl>
        <dl className="facts" style={FIVE_ROWS}>
          <Fact label="Email" value={patient.email} />
          <Fact label="Mobile" value={patient.mobile} mono />
          <Fact label="Address" value={addressInWords(patient.address)} />
          <Fact label="Medicare" value={medicare} mono />
          <Fact label="Joined" value={formatDate(patient.createdAt)} />
        </dl>
      </div>
    </RecordSection>
  );
}

/** A finished intake has a prescriber's summary (INT15); one in progress or ended has nothing to read yet. */
const hasSummary = (intake: PatientIntake) => intake.status === "completed" || intake.status === "ineligible";

function IntakesSection({ patientId }: { patientId: string }) {
  const { current, can } = useTenant();
  const intakes = useQuery({ queryKey: ["patient", current.tenantId, patientId, "intakes"], queryFn: () => patientsApi.intakes(current.tenantId, patientId) });
  const reader = can("intakes:read");
  return (
    <RecordSection id="intakes" title="Intakes" subtitle={reader ? "Open a finished one for the prescriber's summary" : "Where each stands, without the answers"} flush>
      {intakes.isPending ? (
        <p className="cell-muted p-4" aria-busy="true">
          Loading intakes
        </p>
      ) : intakes.isError ? (
        <LoadFailedState noun="list of intakes" onRetry={() => void intakes.refetch()} />
      ) : intakes.data.length === 0 ? (
        <EmptyState boxed={false} title="No intakes yet" description="An intake appears here once the patient starts one on a brand's site." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Program</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Sent or stopped</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {intakes.data.map((intake) => {
              const status = INTAKE_STATUS[intake.status];
              return (
                <TableRow key={intake.intakeId}>
                  <TableCell>
                    {reader && hasSummary(intake) ? (
                      <Link className="row-link" href={`/patients/${patientId}/intakes/${intake.intakeId}`}>
                        {intake.programName}
                      </Link>
                    ) : (
                      intake.programName
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge label={status.label} tone={status.tone} />
                    {intake.endedReason ? <span className="cell-muted ml-2">{END_REASON_LABELS[intake.endedReason]}</span> : null}
                  </TableCell>
                  <TableCell>{formatDate(intake.startedAt)}</TableCell>
                  <TableCell>{formatDate(intake.submittedAt ?? intake.endedAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </RecordSection>
  );
}

/**
 * One patient (docs/decisions/patients.md IDN9, IDN22): their details, identity,
 * consents and intakes. Every read is audited by the API; this page keeps
 * nothing of the patient beyond the query cache for the tenant.
 */
export function PatientPage({ patientId }: { patientId: string }) {
  const { current } = useTenant();
  const patient = useQuery({ queryKey: ["patient", current.tenantId, patientId], queryFn: () => patientsApi.get(current.tenantId, patientId) });

  if (patient.isPending) return <RecordPageSkeleton label="Loading patient" />;
  if (patient.isError) {
    if (patient.error instanceof ApiError && patient.error.status === 404) {
      return <EmptyState icon={UserRound} title="Patient not found" description="They aren't in this tenant. Find them from Patients." />;
    }
    return <LoadFailedState noun="patient" onRetry={() => void patient.refetch()} />;
  }
  const p = patient.data;
  const identity = IDENTITY_STATUS[p.identityStatus];

  return (
    <RecordPage
      title={p.displayName}
      avatarName={p.displayName}
      badge={{ label: identity.label, tone: identity.tone }}
      meta={[
        { key: "dob", label: "Born", value: formatCalendarDate(p.dateOfBirth), icon: CalendarDays },
        { key: "sex", value: SEX_LABELS[p.sex] },
        { key: "joined", label: "Joined", value: formatDate(p.createdAt) },
      ]}
      sections={SECTIONS}
    >
      <DetailsSection patient={p} />
      <IdentitySection patientId={patientId} />
      <ConsentsSection patientId={patientId} />
      <IntakesSection patientId={patientId} />
    </RecordPage>
  );
}
