"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stethoscope } from "lucide-react";
import { ChoiceSelect, optionsOf } from "@/components/shared/choice-select";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import { cliniciansApi } from "@/lib/api/clinicians";
import { staffApi } from "@/lib/api/staff";
import type { Profession } from "@/lib/api/types";
import { PROFESSION_LABELS, standingBadge, TIME_ZONES } from "@/lib/clinicians";

/**
 * Clinicians: who sees patients here, and whether each may consult and
 * prescribe right now. The API works standing out from their credentials
 * each time (docs/decisions/workforce.md WRK3 in the API).
 */
export function CliniciansPage() {
  const { current, can } = useTenant();
  const [adding, setAdding] = useState(false);
  const clinicians = useQuery({ queryKey: ["clinicians", current.tenantId], queryFn: () => cliniciansApi.list(current.tenantId) });

  return (
    <div>
      <PageHeader
        title="Clinicians"
        description="Who sees patients, and whether they can now"
        primaryAction={can("clinicians:manage") ? { label: "Add clinician", onClick: () => setAdding(true) } : undefined}
      />
      {clinicians.isPending ? (
        <Card aria-busy="true" aria-label="Loading clinicians">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : clinicians.isError ? (
        <LoadFailedState noun="list of clinicians" onRetry={() => void clinicians.refetch()} />
      ) : clinicians.data.length === 0 ? (
        <EmptyState icon={Stethoscope} title="No clinicians yet" description="Add a staff member who sees patients." />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinician</TableHead>
                  <TableHead>Profession</TableHead>
                  <TableHead>Standing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clinicians.data.map((clinician) => {
                  const badge = standingBadge(clinician.standing);
                  return (
                    <TableRow key={clinician.clinicianId}>
                      <TableCell>
                        <Link href={`/clinicians/${clinician.clinicianId}`} className="inline-flex items-center gap-2">
                          <InitialsAvatar name={clinician.email} size={28} />
                          {clinician.email}
                        </Link>
                      </TableCell>
                      <TableCell>{PROFESSION_LABELS[clinician.profession]}</TableCell>
                      <TableCell>
                        <StatusBadge label={badge.label} tone={badge.tone} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {adding ? <AddClinicianDialog onClose={() => setAdding(false)} taken={new Set(clinicians.data?.map((c) => c.membershipId))} /> : null}
    </div>
  );
}

function AddClinicianDialog({ onClose, taken }: { onClose: () => void; taken: Set<string> }) {
  const { current } = useTenant();
  const router = useRouter();
  const queryClient = useQueryClient();
  const staff = useQuery({ queryKey: ["staff", current.tenantId], queryFn: () => staffApi.list(current.tenantId) });
  const [membershipId, setMembershipId] = useState<string | null>(null);
  const [profession, setProfession] = useState<Profession | null>(null);
  const [timeZone, setTimeZone] = useState<string>("Australia/Sydney");
  const create = useMutation({
    mutationFn: () => cliniciansApi.create(current.tenantId, { membershipId: membershipId!, profession: profession!, timeZone }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["clinicians", current.tenantId] });
      router.push(`/clinicians/${created.clinicianId}`);
    },
  });
  const candidates = (staff.data ?? []).filter((m) => m.status === "active" && !taken.has(m.membershipId));
  const ready = membershipId !== null && profession !== null;

  return (
    <Dialog open onOpenChange={(open) => (!open && !create.isPending ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add clinician</DialogTitle>
          <DialogDescription>They can see patients once someone else checks their credentials.</DialogDescription>
        </DialogHeader>
        <form
          id="add-clinician"
          className="dlg-body"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="clinician-member">Staff member</label>
            <ChoiceSelect
              id="clinician-member"
              value={membershipId}
              onChange={setMembershipId}
              options={candidates.map((m) => ({ value: m.membershipId, label: m.email }))}
              placeholder={staff.isPending ? "Loading staff" : "Choose a staff member"}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="clinician-profession">Profession</label>
              <ChoiceSelect id="clinician-profession" value={profession} onChange={setProfession} options={optionsOf(PROFESSION_LABELS)} />
            </div>
            <div className="field">
              <label htmlFor="clinician-zone">Works in time zone</label>
              <ChoiceSelect id="clinician-zone" value={timeZone} onChange={setTimeZone} options={TIME_ZONES.map((z) => ({ value: z, label: z.replace("Australia/", "") }))} />
            </div>
          </div>
          {create.error ? (
            <Alert variant="danger">
              <AlertDescription>{create.error instanceof ApiError ? create.error.message : "The clinician wasn't added. Try again."}</AlertDescription>
            </Alert>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="add-clinician" disabled={!ready || create.isPending}>
            {create.isPending ? "Adding…" : "Add clinician"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
