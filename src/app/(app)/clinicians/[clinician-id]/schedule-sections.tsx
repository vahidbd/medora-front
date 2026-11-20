"use client";

import { Fragment, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ChoiceSelect, optionsOf } from "@/components/shared/choice-select";
import { EmptyState } from "@/components/shared/empty-state";
import { EditDrawer } from "@/components/shared/record/edit-drawer";
import { RecordSection } from "@/components/shared/record/record-page";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { DateTimeField, TimeField } from "@/components/ui/date-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cliniciansApi } from "@/lib/api/clinicians";
import type { ClinicianDetail, HoursBlock, TimeOffReason } from "@/lib/api/types";
import { TIME_OFF_REASON_LABELS, WEEKDAYS } from "@/lib/clinicians";
import { formatDateTime } from "@/lib/format";
import { errorText, useClinicianAccess, useClinicianUpdate } from "./clinician-page";


/** Weekly hours in the clinician's own time zone; booking cuts slots from them (WRK6 in the API). */
export function HoursSection({ clinician }: { clinician: ClinicianDetail }) {
  const access = useClinicianAccess(clinician);
  const [editing, setEditing] = useState(false);
  const byDay = WEEKDAYS.map((d) => ({ ...d, blocks: clinician.hours.filter((h) => h.weekday === d.day) }));
  return (
    <RecordSection
      id="hours"
      title="Working hours"
      subtitle={`Each week, in ${clinician.timeZone} time`}
      actions={
        access.mayEdit ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            Edit
          </Button>
        ) : null
      }
    >
      <dl className="facts">
        {byDay.map((day) => (
          <Fragment key={day.day}>
            <dt>{day.label}</dt>
            <dd>
              {day.blocks.length > 0 ? (
                day.blocks.map((b) => `${b.startsAt} to ${b.endsAt}, ${b.slotMinutes} minute slots`).join("; ")
              ) : (
                <span className="empty">Not working</span>
              )}
            </dd>
          </Fragment>
        ))}
      </dl>
      {editing ? <HoursDrawer clinician={clinician} onClose={() => setEditing(false)} /> : null}
    </RecordSection>
  );
}

function HoursDrawer({ clinician, onClose }: { clinician: ClinicianDetail; onClose: () => void }) {
  const { current } = useTenant();
  const update = useClinicianUpdate(clinician.clinicianId);
  const [blocks, setBlocks] = useState<HoursBlock[]>(clinician.hours);
  const save = useMutation({
    mutationFn: () => cliniciansApi.replaceHours(current.tenantId, clinician.clinicianId, blocks),
    onSuccess: (hours) => {
      update({ ...clinician, hours });
      onClose();
    },
  });
  const change = (i: number, patch: Partial<HoursBlock>) => setBlocks((all) => all.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const complete = blocks.every((b) => b.startsAt && b.endsAt && b.startsAt < b.endsAt);

  return (
    <EditDrawer
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Edit working hours"
      description={`Blocks of time each week, in ${clinician.timeZone} time.`}
      note="Booked consults stay as they are."
      saving={save.isPending}
      ready={complete}
      error={save.error ? errorText(save.error, "The hours weren't saved. Try again.") : null}
      onSave={() => save.mutate()}
    >
      {blocks.length === 0 ? <EmptyState title="No working hours" description="Add a block for each stretch of time they work." /> : null}
      {blocks.map((block, i) => (
        <div key={i} className="field-row-3" role="group" aria-label={`Block ${i + 1}`}>
          <div className="field">
            <label htmlFor={`block-${i}-day`}>Day</label>
            <ChoiceSelect
              id={`block-${i}-day`}
              value={String(block.weekday)}
              onChange={(day) => change(i, { weekday: Number(day) })}
              options={WEEKDAYS.map((d) => ({ value: String(d.day), label: d.label }))}
            />
          </div>
          <div className="field">
            <label htmlFor={`block-${i}-start`}>Starts</label>
            <TimeField id={`block-${i}-start`} value={block.startsAt} onValueChange={(startsAt) => change(i, { startsAt })} />
          </div>
          <div className="field">
            <div className="field-head">
              <label htmlFor={`block-${i}-end`}>Ends</label>
              <Button variant="ghost" size="xs" onClick={() => setBlocks((all) => all.filter((_, j) => j !== i))} aria-label={`Remove block ${i + 1}`}>
                <Trash2 aria-hidden />
                Remove
              </Button>
            </div>
            <TimeField id={`block-${i}-end`} value={block.endsAt} onValueChange={(endsAt) => change(i, { endsAt })} />
          </div>
        </div>
      ))}
      <div>
        <Button variant="outline" size="sm" onClick={() => setBlocks((all) => [...all, { weekday: 1, startsAt: "09:00", endsAt: "17:00", slotMinutes: 15 }])}>
          <Plus aria-hidden />
          Add a block
        </Button>
      </div>
    </EditDrawer>
  );
}

/** Time the clinician can't be booked; removing it opens those times again (WRK7 in the API). */
export function TimeOffSection({ clinician }: { clinician: ClinicianDetail }) {
  const access = useClinicianAccess(clinician);
  const { current } = useTenant();
  const update = useClinicianUpdate(clinician.clinicianId);
  const [adding, setAdding] = useState(false);
  const remove = useMutation({
    mutationFn: (timeOffId: string) => cliniciansApi.removeTimeOff(current.tenantId, clinician.clinicianId, timeOffId),
    onSuccess: (_reply, timeOffId) => update({ ...clinician, timeOff: clinician.timeOff.filter((t) => t.timeOffId !== timeOffId) }),
  });
  return (
    <RecordSection
      id="time-off"
      title="Time off"
      subtitle="Upcoming and current, in your time"
      flush
      actions={
        access.mayEdit ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            Add time off
          </Button>
        ) : null
      }
    >
      {clinician.timeOff.length === 0 ? (
        <div className="record-pad">
          <EmptyState title="No time off coming up" description="They can be booked in all their working hours." />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>Until</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinician.timeOff.map((t) => (
              <TableRow key={t.timeOffId}>
                <TableCell>{formatDateTime(t.startsAt)}</TableCell>
                <TableCell>{formatDateTime(t.endsAt)}</TableCell>
                <TableCell>{TIME_OFF_REASON_LABELS[t.reason]}</TableCell>
                <TableCell className="text-right">
                  {access.mayEdit ? (
                    <Button variant="ghost" size="sm" onClick={() => remove.mutate(t.timeOffId)} disabled={remove.isPending}>
                      Remove time off
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {remove.error ? <p className="err record-pad">{errorText(remove.error, "The time off wasn't removed. Try again.")}</p> : null}
      {adding ? <TimeOffDrawer clinician={clinician} onClose={() => setAdding(false)} /> : null}
    </RecordSection>
  );
}

function TimeOffDrawer({ clinician, onClose }: { clinician: ClinicianDetail; onClose: () => void }) {
  const { current } = useTenant();
  const update = useClinicianUpdate(clinician.clinicianId);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState<TimeOffReason | null>("leave");
  // The fields are in this browser's time; the API stores instants.
  const instant = (local: string) => new Date(local).toISOString();
  const ready = Boolean(startsAt && endsAt && reason && startsAt < endsAt);
  const add = useMutation({
    mutationFn: () => cliniciansApi.addTimeOff(current.tenantId, clinician.clinicianId, { startsAt: instant(startsAt), endsAt: instant(endsAt), reason: reason! }),
    onSuccess: (added) => {
      update({ ...clinician, timeOff: [...clinician.timeOff, added].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) });
      onClose();
    },
  });
  return (
    <EditDrawer
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Add time off"
      description="No consult can be booked with them in this time."
      saveLabel="Add time off"
      saving={add.isPending}
      ready={ready}
      error={add.error ? errorText(add.error, "The time off wasn't added. Try again.") : null}
      onSave={() => add.mutate()}
    >
      <div className="field">
        <label htmlFor="time-off-start">From</label>
        <DateTimeField id="time-off-start" value={startsAt} onValueChange={setStartsAt} />
      </div>
      <div className="field">
        <label htmlFor="time-off-end">Until</label>
        <DateTimeField id="time-off-end" value={endsAt} onValueChange={setEndsAt} />
      </div>
      <div className="field">
        <label htmlFor="time-off-reason">Reason</label>
        <ChoiceSelect id="time-off-reason" value={reason} onChange={setReason} options={optionsOf(TIME_OFF_REASON_LABELS)} />
      </div>
    </EditDrawer>
  );
}

