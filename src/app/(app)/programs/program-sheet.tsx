"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChoiceSelect } from "@/components/shared/choice-select";
import { EditDrawer } from "@/components/shared/record/edit-drawer";
import { useTenant } from "@/components/shell/tenant-context";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import { messageOf } from "@/lib/api/errors";
import { programsApi } from "@/lib/api/protocols";
import type { Brand, MeasurementKind, Program, ProtocolSummary } from "@/lib/api/types";
import { MEASUREMENT_LABELS } from "@/lib/protocols";

/** Add a program as a draft, or change one (INT9). `program` null is a new one. Its brand and protocol never change. */
export function ProgramSheet({
  program,
  open,
  brands,
  protocols,
  onOpenChange,
}: {
  program: Program | null;
  open: boolean;
  brands: Brand[];
  protocols: ProtocolSummary[];
  onOpenChange: (open: boolean) => void;
}) {
  return open ? <ProgramForm key={program?.programId ?? "new"} program={program} brands={brands} protocols={protocols} onOpenChange={onOpenChange} /> : null;
}

function ProgramForm({ program, brands, protocols, onOpenChange }: { program: Program | null; brands: Brand[]; protocols: ProtocolSummary[]; onOpenChange: (open: boolean) => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const [brandId, setBrandId] = useState<string | null>(program?.brandId ?? null);
  const [protocolId, setProtocolId] = useState<string | null>(program?.protocolId ?? null);
  const [name, setName] = useState(program?.name ?? "");
  const [measurements, setMeasurements] = useState<MeasurementKind[]>(program?.measurements ?? []);
  const [checkIn, setCheckIn] = useState(program?.checkInEveryDays ? String(program.checkInEveryDays) : "");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const fields = { name: name.trim(), measurements, checkInEveryDays: checkIn ? Number(checkIn) : null };
      return program ? programsApi.change(current.tenantId, program.programId, fields) : programsApi.create(current.tenantId, { ...fields, brandId: brandId!, protocolId: protocolId! });
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["programs", current.tenantId] });
      toast.success(program ? "Program saved" : "Program added", { description: saved.name });
      onOpenChange(false);
    },
    onError: (err) => setError(messageOf(err, "The program was not saved. Try again.")),
  });

  const toggle = (kind: MeasurementKind, on: boolean) => setMeasurements((now) => (on ? [...now, kind] : now.filter((k) => k !== kind)));
  const days = Number(checkIn);
  const daysOk = checkIn === "" || (Number.isInteger(days) && days >= 1 && days <= 365);

  return (
    <EditDrawer
      open
      onOpenChange={onOpenChange}
      title={program ? `Edit ${program.name}` : "New program"}
      description={program ? "Its brand and protocol stay as they are." : "A new program starts as a draft. Nobody can start it until it goes live."}
      saving={save.isPending}
      ready={name.trim() !== "" && brandId !== null && protocolId !== null && daysOk}
      error={error}
      onSave={() => {
        setError(null);
        save.mutate();
      }}
      saveLabel={program ? "Save changes" : "Add program"}
    >
      <div className="field">
        <label htmlFor="program-brand">
          Brand <span className="req">*</span>
        </label>
        {program ? (
          <Input id="program-brand" disabled value={brands.find((b) => b.brandId === brandId)?.name ?? ""} />
        ) : (
          <ChoiceSelect id="program-brand" value={brandId} onChange={setBrandId} options={brands.map((b) => ({ value: b.brandId, label: b.name }))} />
        )}
      </div>
      <div className="field">
        <label htmlFor="program-protocol">
          Protocol <span className="req">*</span>
        </label>
        {program ? (
          <Input id="program-protocol" disabled value={protocols.find((p) => p.protocolId === protocolId)?.name ?? program.condition} />
        ) : (
          <ChoiceSelect id="program-protocol" value={protocolId} onChange={setProtocolId} options={protocols.map((p) => ({ value: p.protocolId, label: p.name }))} />
        )}
        <div className="helper">Its questions and rules. A program can go live once the protocol has a signed-off version.</div>
      </div>
      <div className="field">
        <label htmlFor="program-name">
          Name <span className="req">*</span>
        </label>
        <Input id="program-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="helper">Patients see this name on the brand&apos;s site.</div>
      </div>
      <fieldset className="field">
        <legend>What patients record</legend>
        {(Object.keys(MEASUREMENT_LABELS) as MeasurementKind[]).map((kind) => (
          <label key={kind} className="choice-row">
            <Checkbox checked={measurements.includes(kind)} onCheckedChange={(on) => toggle(kind, on === true)} />
            <span>{MEASUREMENT_LABELS[kind]}</span>
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="program-check-in">Check-in every (days)</label>
        <NumberField id="program-check-in" decimals={0} value={checkIn} onValueChange={setCheckIn} aria-invalid={!daysOk} />
        <div className="helper">{daysOk ? "Leave empty for no regular check-in." : "Between 1 and 365 days."}</div>
      </div>
    </EditDrawer>
  );
}
