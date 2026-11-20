"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { messageOf } from "@/lib/api/errors";
import { rolesApi } from "@/lib/api/staff";
import type { CustomRole, DataZone, Permission, RolesReply, StartingRoleKey } from "@/lib/api/types";
import { PERMISSION_LABELS, ROLE_LABELS, ZONE_LABELS } from "@/lib/roles";

/** What the sheet shows: a starting role to read, a new custom role copied from one, or a custom role to edit. */
export type RoleSheetTarget =
  | { mode: "view"; key: StartingRoleKey }
  | { mode: "new"; basedOn: StartingRoleKey }
  | { mode: "edit"; role: CustomRole };

const ZONES: DataZone[] = ["platform", "operational", "marketing", "clinical"];

export function RoleSheet({
  target,
  roles,
  onOpenChange,
}: {
  target: RoleSheetTarget | null;
  roles: RolesReply;
  onOpenChange: (open: boolean) => void;
}) {
  const key = target ? (target.mode === "edit" ? target.role.id : `${target.mode}:${"key" in target ? target.key : target.basedOn}`) : "none";
  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent>{target ? <RoleForm key={key} target={target} roles={roles} onDone={() => onOpenChange(false)} /> : null}</SheetContent>
    </Sheet>
  );
}

function startingPermissions(roles: RolesReply, key: StartingRoleKey): Permission[] {
  return roles.startingRoles.find((r) => r.key === key)?.permissions ?? [];
}

function RoleForm({ target, roles, onDone }: { target: RoleSheetTarget; roles: RolesReply; onDone: () => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const readOnly = target.mode === "view";
  const editing = target.mode === "edit" ? target.role : null;
  const [basedOn, setBasedOn] = useState<StartingRoleKey>(
    target.mode === "view" ? target.key : target.mode === "new" ? target.basedOn : target.role.basedOn,
  );
  const [name, setName] = useState(editing?.name ?? (target.mode === "new" ? `${ROLE_LABELS[target.basedOn]} (copy)` : ""));
  const [description, setDescription] = useState(editing?.description ?? "");
  const [permissions, setPermissions] = useState<Permission[]>(
    editing ? editing.permissions : startingPermissions(roles, target.mode === "view" ? target.key : basedOn),
  );
  const [error, setError] = useState<string | null>(null);
  const clinical = roles.startingRoles.find((r) => r.key === basedOn)?.clinical ?? false;
  const members = editing?.memberCount ?? 0;

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description: description.trim(), permissions };
      return editing ? rolesApi.update(current.tenantId, editing.id, body) : rolesApi.create(current.tenantId, { ...body, basedOn });
    },
    onSuccess: (role) => {
      void queryClient.invalidateQueries({ queryKey: ["roles", current.tenantId] });
      void queryClient.invalidateQueries({ queryKey: ["staff", current.tenantId] });
      toast.success(editing ? "Role saved" : "Role created", { description: role.name });
      onDone();
    },
    onError: (err) => setError(messageOf(err)),
  });

  const toggle = (key: Permission, on: boolean) =>
    setPermissions((prev) => (on ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)));

  const title = target.mode === "view" ? ROLE_LABELS[target.key] : editing ? `Edit ${editing.name}` : "New role";
  const description_ =
    target.mode === "view"
      ? "A starting role. Copy it to make a role of your own."
      : editing
        ? `Copied from ${ROLE_LABELS[editing.basedOn]}. ${members === 1 ? "1 staff member has" : `${members} staff members have`} this role.`
        : "A copy of a starting role, with the permissions you choose.";
  const note = editing && members > 0 ? `Saving changes what ${members === 1 ? "1 staff member" : `${members} staff members`} can do straight away.` : undefined;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{description_}</SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form
          id="role-form"
          className="field-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
        >
          {target.mode === "new" ? (
            <div className="field">
              <label htmlFor="role-based-on">Copy from</label>
              <Select
                items={(Object.keys(ROLE_LABELS) as StartingRoleKey[]).map((k) => ({ value: k, label: ROLE_LABELS[k] }))}
                value={basedOn}
                onValueChange={(next) => {
                  if (!next) return;
                  const key = next as StartingRoleKey;
                  setBasedOn(key);
                  setPermissions(startingPermissions(roles, key));
                  setName(`${ROLE_LABELS[key]} (copy)`);
                }}
              >
                <SelectTrigger id="role-based-on" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as StartingRoleKey[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {ROLE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="helper">Starts with its permissions. Whether the role is clinical comes from this and can&apos;t change.</div>
            </div>
          ) : null}
          {readOnly ? null : (
            <>
              <div className="field">
                <label htmlFor="role-name">
                  Name <span className="req">*</span>
                </label>
                <Input id="role-name" required maxLength={60} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="role-description">
                  Description <span className="opt">optional</span>
                </label>
                <Textarea id="role-description" rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
                <div className="helper">Shown when someone picks a role for a staff member.</div>
              </div>
            </>
          )}
          <PermissionList roles={roles} value={permissions} onToggle={toggle} readOnly={readOnly} clinical={clinical} />
          {error ? (
            <div className="field">
              <div className="err" role="alert">
                {error}
              </div>
            </div>
          ) : null}
        </form>
      </SheetBody>
      <SheetFooter note={note}>
        {readOnly ? (
          <Button type="button" variant="outline" onClick={onDone}>
            Close
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="role-form" disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save role" : "Create role"}
            </Button>
          </>
        )}
      </SheetFooter>
    </>
  );
}

/**
 * Every permission, grouped by the data zone it opens (ADR 0036). Clinical
 * ones say plainly that they work only for a clinical role; for anyone
 * else they need break-glass first. Every box can be ticked; the API
 * refuses a permission you don't hold yourself (ADR 0030), and the sheet
 * shows its reason.
 */
function PermissionList({
  roles,
  value,
  onToggle,
  readOnly,
  clinical,
}: {
  roles: RolesReply;
  value: Permission[];
  onToggle: (key: Permission, on: boolean) => void;
  readOnly: boolean;
  clinical: boolean;
}) {
  const held = new Set(value);
  return (
    <div role="group" aria-labelledby="role-permissions-label" className="field-stack">
      <div className="field-label mb-0" id="role-permissions-label">
        Permissions
      </div>
      {ZONES.map((zone) => {
        const keys = roles.permissions.filter((p) => p.zone === zone).map((p) => p.key);
        if (keys.length === 0) return null;
        const headingId = `zone-${zone}`;
        return (
          <div key={zone} role="group" aria-labelledby={headingId} className="flex flex-col gap-2">
            <div className="choice-group-head" id={headingId}>
              {ZONE_LABELS[zone]}
            </div>
            {zone === "clinical" && !clinical ? (
              <div className="alert warning" role="note">
                <ShieldAlert className="ico" aria-hidden />
                <div className="body">
                  <p>This role isn&apos;t clinical, so anyone with it opens break-glass before using these.</p>
                </div>
              </div>
            ) : null}
            {keys.map((key) => (
              <label key={key} className="choice-row">
                <Checkbox checked={held.has(key)} disabled={readOnly} onCheckedChange={(on) => onToggle(key, on === true)} />
                <span>{PERMISSION_LABELS[key]}</span>
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}
