"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DataZone, StaffMember } from "@/lib/api/types";
import { type AuditFilters, NO_FILTERS } from "@/lib/audit";
import { ZONE_LABELS } from "@/lib/roles";

const ANY = "any";
const ZONES = [{ value: ANY, label: "Any zone" }, ...Object.entries(ZONE_LABELS).map(([value, label]) => ({ value, label }))];

/** The audit log's filters, in a drawer (DESIGN.md, "List pages"). Nothing applies until Apply filters. */
export function FiltersSheet({
  open,
  filters,
  staff,
  onApply,
  onOpenChange,
}: {
  open: boolean;
  filters: AuditFilters;
  /** The tenant's staff, for the person picker; empty while they load or when they didn't. */
  staff: StaffMember[];
  onApply: (filters: AuditFilters) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {open ? (
          <FiltersForm
            filters={filters}
            staff={staff}
            onApply={(next) => {
              onApply(next);
              onOpenChange(false);
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function FiltersForm({
  filters,
  staff,
  onApply,
}: {
  filters: AuditFilters;
  staff: StaffMember[];
  onApply: (filters: AuditFilters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const people = [
    { value: ANY, label: "Anyone" },
    ...staff.map((member) => ({ value: member.userId, label: member.displayName ?? member.email })),
  ];

  return (
    <>
      <SheetHeader>
        <SheetTitle>Filters</SheetTitle>
        <SheetDescription>Dates are days in your own time zone, and include both ends.</SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form
          id="audit-filters"
          className="field-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.fromDay && draft.toDay && draft.toDay < draft.fromDay) {
              setError("The end date is before the start date.");
              return;
            }
            onApply(draft);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label htmlFor="audit-from">From</label>
              <Input id="audit-from" type="date" value={draft.fromDay} onChange={(e) => set("fromDay", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="audit-to">To</label>
              <Input id="audit-to" type="date" value={draft.toDay} onChange={(e) => set("toDay", e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="audit-person">Person</label>
            <Select
              items={people}
              value={draft.actorId || ANY}
              onValueChange={(next) => next && set("actorId", next === ANY ? "" : String(next))}
            >
              <SelectTrigger id="audit-person" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {people.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="field">
            <label htmlFor="audit-action">Action</label>
            <Input
              id="audit-action"
              maxLength={80}
              autoComplete="off"
              className="font-mono"
              value={draft.action}
              onChange={(e) => set("action", e.target.value)}
            />
            <div className="helper">An action, or the start of one: product. finds every product change.</div>
          </div>
          <div className="field">
            <label htmlFor="audit-zone">Zone</label>
            <Select
              items={ZONES}
              value={draft.zone || ANY}
              onValueChange={(next) => next && set("zone", next === ANY ? "" : (next as DataZone))}
            >
              <SelectTrigger id="audit-zone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZONES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="field">
            <label htmlFor="audit-record">Record id</label>
            <Input
              id="audit-record"
              maxLength={80}
              autoComplete="off"
              className="font-mono"
              value={draft.recordId}
              onChange={(e) => set("recordId", e.target.value)}
            />
            <div className="helper">Every entry about one record, such as a product or a membership.</div>
          </div>
          {error ? (
            <div className="field">
              <div className="err" role="alert">
                {error}
              </div>
            </div>
          ) : null}
        </form>
      </SheetBody>
      <SheetFooter>
        <Button type="button" variant="outline" onClick={() => onApply(NO_FILTERS)}>
          Clear all
        </Button>
        <Button type="submit" form="audit-filters">
          Apply filters
        </Button>
      </SheetFooter>
    </>
  );
}
