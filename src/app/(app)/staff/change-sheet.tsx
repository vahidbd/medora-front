"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { messageOf } from "@/lib/api/errors";
import { staffApi } from "@/lib/api/staff";
import type { MembershipChange, StaffMember } from "@/lib/api/types";
import { dayOf, endOfDay } from "@/lib/staff-access";
import { RoleSelect, roleHelp, useRoles, type RoleChoice } from "./role-select";

type Values = { choice: RoleChoice; status: "active" | "suspended"; ends: string };

function valuesOf(member: StaffMember): Values {
  return {
    choice: { role: member.role, customRoleId: member.customRole?.id ?? null },
    status: member.status === "suspended" ? "suspended" : "active",
    ends: dayOf(member.expiresAt),
  };
}

/** Only what changed is sent, so the audit entry and events name exactly what moved (FND6). */
function changeOf(before: Values, after: Values): MembershipChange | null {
  const change: MembershipChange = {};
  if (after.choice.role !== before.choice.role || after.choice.customRoleId !== before.choice.customRoleId) {
    change.role = after.choice.role;
    change.customRoleId = after.choice.customRoleId;
  }
  if (after.status !== before.status) change.status = after.status;
  if (after.ends !== before.ends) change.expiresAt = after.ends ? endOfDay(after.ends) : null;
  return Object.keys(change).length > 0 ? change : null;
}

/**
 * Change a staff member's role, pause or restore their access, or give it
 * an end date. The API refuses your own membership, a role you don't
 * fully hold and leaving the tenant without an active owner; the sheet
 * shows its reason and keeps what was picked.
 */
export function ChangeSheet({ member, onOpenChange }: { member: StaffMember | null; onOpenChange: (open: boolean) => void }) {
  const open = member !== null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>{member ? <ChangeForm key={member.membershipId} member={member} onDone={() => onOpenChange(false)} /> : null}</SheetContent>
    </Sheet>
  );
}

function ChangeForm({ member, onDone }: { member: StaffMember; onDone: () => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const roles = useRoles();
  const before = valuesOf(member);
  const [values, setValues] = useState<Values>(before);
  const [error, setError] = useState<string | null>(null);
  const change = changeOf(before, values);
  const who = member.displayName ?? member.email;

  const save = useMutation({
    mutationFn: (body: MembershipChange) => staffApi.change(current.tenantId, member.membershipId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff", current.tenantId] });
      void queryClient.invalidateQueries({ queryKey: ["roles", current.tenantId] });
      toast.success("Saved", { description: who });
      onDone();
    },
    onError: (err) => setError(messageOf(err)),
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>Change role and access</SheetTitle>
        <SheetDescription>{who}</SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form
          id="change-form"
          className="field-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (change) save.mutate(change);
          }}
        >
          <div className="field">
            <label htmlFor="change-role">Role</label>
            <RoleSelect id="change-role" value={values.choice} onChange={(choice) => setValues((v) => ({ ...v, choice }))} roles={roles.data} />
            <div className="helper">{roleHelp(roles.data, values.choice)}</div>
          </div>
          <div className="field" role="group" aria-labelledby="change-status-label">
            <div className="field-label" id="change-status-label">
              Access
            </div>
            <RadioGroup
              value={values.status}
              onValueChange={(status) => setValues((v) => ({ ...v, status: status as Values["status"] }))}
              aria-labelledby="change-status-label"
            >
              <label className="choice-row">
                <RadioGroupItem value="active" />
                <span>Active</span>
              </label>
              <label className="choice-row">
                <RadioGroupItem value="suspended" />
                <span>
                  Paused
                  <span className="choice-sub">They can&apos;t open this tenant until it is made active again.</span>
                </span>
              </label>
            </RadioGroup>
          </div>
          <div className="field">
            <label htmlFor="change-ends">
              Access ends <span className="opt">optional</span>
            </label>
            <DateField id="change-ends" value={values.ends} onValueChange={(ends) => setValues((v) => ({ ...v, ends }))} />
            <div className="helper">Their access stops at the end of that day. Clear it to keep access open.</div>
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
      <SheetFooter note={change ? "They see the change the next time they open Medora." : undefined}>
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" form="change-form" disabled={save.isPending || !change}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </SheetFooter>
    </>
  );
}
