"use client";

import { RecordSection } from "@/components/shared/record/record-page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProtocolVersion } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { conditionInWords, QUESTION_KIND_LABELS, type ShownDefinition } from "@/lib/protocol-definition";

/** One version's questions, derived numbers and rules, for reading (INT1, INT2). Section ids match the rail in protocol-page.tsx. */
export function VersionSections({ version, definition }: { version: ProtocolVersion; definition: ShownDefinition }) {
  const stops = definition.rules.filter((rule) => rule.outcome === "hard_stop");
  const flags = definition.rules.filter((rule) => rule.outcome === "red_flag");
  return (
    <>
      <RecordSection id="questions" title="Questions" subtitle={`Version ${version.version}, in the order patients answer them`}>
        <div className="flex flex-col gap-6">
          {definition.steps.map((step, i) => (
            <div key={step.key}>
              <h3 className="text-sm font-semibold">
                Step {i + 1}: {step.title}
              </h3>
              {step.showIf ? <p className="cell-muted text-sm">Only when {conditionInWords(step.showIf, definition)}</p> : null}
              <Table aria-label={`Questions in ${step.title}`}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Answer</TableHead>
                    <TableHead>Required</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {step.questions.map((question) => (
                    <TableRow key={question.key}>
                      <TableCell>
                        <span className="block">{question.label}</span>
                        {question.showIf ? <span className="cell-muted block">Only when {conditionInWords(question.showIf, definition)}</span> : null}
                      </TableCell>
                      <TableCell className="cell-muted">
                        {QUESTION_KIND_LABELS[question.kind] ?? question.kind}
                        {question.unit ? ` (${question.unit})` : ""}
                        {question.options ? `: ${question.options.map((o) => o.label).join(", ")}` : ""}
                      </TableCell>
                      <TableCell>{question.required === false ? "No" : "Yes"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </RecordSection>

      <RecordSection id="hard-stops" title="Hard stops" subtitle="End the intake as not eligible. Patients see the message." flush>
        {stops.length === 0 ? (
          <p className="cell-muted p-4">None.</p>
        ) : (
          <Table aria-label="Hard stops">
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>The prescriber reads</TableHead>
                <TableHead>The patient reads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stops.map((rule) => (
                <TableRow key={rule.key}>
                  <TableCell>{conditionInWords(rule.when, definition)}</TableCell>
                  <TableCell>{rule.prescriberLabel}</TableCell>
                  <TableCell>
                    {rule.patientMessage}
                    {rule.urgentHelp ? (
                      <span className="block pt-1">
                        <StatusBadge label="Shows urgent help" tone="danger" size="sm" />
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </RecordSection>

      <RecordSection id="red-flags" title="Red flags" subtitle="The intake goes on; the prescriber sees the flag. Never shown to the patient." flush>
        {flags.length === 0 ? (
          <p className="cell-muted p-4">None.</p>
        ) : (
          <Table aria-label="Red flags">
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>The prescriber reads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((rule) => (
                <TableRow key={rule.key}>
                  <TableCell>{conditionInWords(rule.when, definition)}</TableCell>
                  <TableCell>{rule.prescriberLabel}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </RecordSection>

      <RecordSection id="sign-off" title="Sign-off" subtitle="Who approved this version for patients">
        <dl className="facts">
          <dt>Signed off</dt>
          <dd>{version.signedOffAt ? formatDateTime(version.signedOffAt) : "Not yet"}</dd>
          <dt>Ahpra registration</dt>
          <dd className="mono">{version.signerRegistration ?? "Not set"}</dd>
          <dt>Attestation</dt>
          <dd>{version.attestation ?? "Not set"}</dd>
          {version.withdrawnAt ? (
            <>
              <dt>Withdrawn</dt>
              <dd>
                {formatDateTime(version.withdrawnAt)}: {version.withdrawnReason}
              </dd>
            </>
          ) : null}
        </dl>
      </RecordSection>
    </>
  );
}
