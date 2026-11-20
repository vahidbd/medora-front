"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Globe } from "lucide-react";
import { ChoiceSelect, optionsOf } from "@/components/shared/choice-select";
import { LoadFailedState } from "@/components/shared/empty-state";
import { EditDrawer } from "@/components/shared/record/edit-drawer";
import { RecordPage, RecordPageSkeleton, RecordSection } from "@/components/shared/record/record-page";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { cliniciansApi } from "@/lib/api/clinicians";
import type { ClinicianDetail, SuspensionReason } from "@/lib/api/types";
import { PROFESSION_LABELS, STANDING_REASON_LABELS, STANDING_WARNING_LABELS, standingBadge, SUSPENSION_REASON_LABELS } from "@/lib/clinicians";
import { formatDateTime } from "@/lib/format";
import { CredentialsSection } from "./credentials-section";
import { HoursSection, TimeOffSection } from "./schedule-sections";

export const errorText = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback);

/** Who is looking: the clinician themselves, someone who manages clinicians, or both (WRK4 in the API). */
export function useClinicianAccess(clinician: ClinicianDetail) {
  const { current, can } = useTenant();
  const isSelf = clinician.membershipId === current.membershipId;
  const manages = can("clinicians:manage");
  return { isSelf, manages, mayEdit: manages || isSelf, mayCheck: manages && !isSelf };
}

/** Writes the clinician the API sent back, and refreshes the list behind it. */
export function useClinicianUpdate(clinicianId: string) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  return (detail: ClinicianDetail) => {
    queryClient.setQueryData(["clinician", current.tenantId, clinicianId], detail);
    void queryClient.invalidateQueries({ queryKey: ["clinicians", current.tenantId] });
  };
}

/** One clinician as a record page: standing, credentials, working hours and time off. */
export function ClinicianPage({ clinicianId }: { clinicianId: string }) {
  const { current } = useTenant();
  const clinician = useQuery({
    queryKey: ["clinician", current.tenantId, clinicianId],
    queryFn: () => cliniciansApi.get(current.tenantId, clinicianId),
  });
  if (clinician.isPending) return <RecordPageSkeleton label="Loading clinician" />;
  if (clinician.isError) return <LoadFailedState noun="clinician" onRetry={() => void clinician.refetch()} />;
  return <ClinicianRecord clinician={clinician.data} />;
}

function ClinicianRecord({ clinician }: { clinician: ClinicianDetail }) {
  const access = useClinicianAccess(clinician);
  const [suspending, setSuspending] = useState(false);
  const update = useClinicianUpdate(clinician.clinicianId);
  const { current } = useTenant();
  const resume = useMutation({ mutationFn: () => cliniciansApi.resume(current.tenantId, clinician.clinicianId), onSuccess: update });
  const standing = clinician.standing;
  const needsLook = standing.reasons.length > 0 && !(standing.mayConsult && standing.reasons.every((r) => r === "not_a_prescriber"));

  return (
    <RecordPage
      title={clinician.email}
      avatarName={clinician.email}
      badge={standingBadge(standing)}
      meta={[
        { key: "profession", value: PROFESSION_LABELS[clinician.profession] },
        { key: "zone", icon: Globe, value: clinician.timeZone },
        ...(clinician.suspension ? [{ key: "suspended", icon: Clock, label: "Suspended", value: formatDateTime(clinician.suspension.at) }] : []),
      ]}
      actions={
        access.mayCheck ? (
          clinician.suspension ? (
            <Button variant="outline" onClick={() => resume.mutate()} disabled={resume.isPending}>
              Lift suspension
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setSuspending(true)}>
              Suspend
            </Button>
          )
        ) : null
      }
      sections={[
        { id: "standing", label: "Standing", attention: needsLook ? "Something stops them seeing patients" : undefined },
        ...(clinician.credentials ? [{ id: "credentials", label: "Credentials", count: clinician.credentials.filter((c) => !c.withdrawnAt).length }] : []),
        { id: "hours", label: "Working hours", count: clinician.hours.length },
        { id: "time-off", label: "Time off", count: clinician.timeOff.length },
      ]}
    >
      <RecordSection id="standing" title="Standing" subtitle="Worked out from their credentials each time it is asked">
        <dl className="facts">
          <dt>Can consult</dt>
          <dd>{standing.mayConsult ? "Yes" : "No"}</dd>
          <dt>Can prescribe</dt>
          <dd>{standing.mayPrescribe ? "Yes" : "No"}</dd>
          <dt>Why not</dt>
          <dd>{standing.reasons.length > 0 ? standing.reasons.map((r) => STANDING_REASON_LABELS[r]).join(". ") : <span className="empty">Nothing stops them</span>}</dd>
          <dt>To do soon</dt>
          <dd>{standing.warnings.length > 0 ? standing.warnings.map((w) => STANDING_WARNING_LABELS[w]).join(". ") : <span className="empty">Nothing</span>}</dd>
        </dl>
        {resume.error ? <p className="err">{errorText(resume.error, "The suspension wasn't lifted. Try again.")}</p> : null}
      </RecordSection>
      {clinician.credentials ? <CredentialsSection clinician={clinician} credentials={clinician.credentials} /> : null}
      <HoursSection clinician={clinician} />
      <TimeOffSection clinician={clinician} />
      {suspending ? <SuspendDrawer clinician={clinician} onClose={() => setSuspending(false)} /> : null}
    </RecordPage>
  );
}

function SuspendDrawer({ clinician, onClose }: { clinician: ClinicianDetail; onClose: () => void }) {
  const { current } = useTenant();
  const update = useClinicianUpdate(clinician.clinicianId);
  const [reason, setReason] = useState<SuspensionReason | null>(null);
  const suspend = useMutation({
    mutationFn: (why: SuspensionReason) => cliniciansApi.suspend(current.tenantId, clinician.clinicianId, why),
    onSuccess: (detail) => {
      update(detail);
      onClose();
    },
  });
  return (
    <EditDrawer
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Suspend clinician"
      description="They can't be booked or start a consult until someone lifts it."
      note="A call already in progress isn't cut."
      saveLabel="Suspend now"
      saving={suspend.isPending}
      ready={reason !== null}
      error={suspend.error ? errorText(suspend.error, "The clinician wasn't suspended. Try again.") : null}
      onSave={() => (reason ? suspend.mutate(reason) : undefined)}
    >
      <div className="field">
        <label htmlFor="suspend-reason">Reason</label>
        <ChoiceSelect id="suspend-reason" value={reason} onChange={setReason} options={optionsOf(SUSPENSION_REASON_LABELS)} />
      </div>
    </EditDrawer>
  );
}
