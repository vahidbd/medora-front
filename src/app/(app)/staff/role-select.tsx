"use client";

import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/shell/tenant-context";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rolesApi } from "@/lib/api/staff";
import type { Role, RolesReply, StartingRoleKey } from "@/lib/api/types";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles";

/** A role as the API takes it: a starting role's key, or `custom` with the custom role's id. */
export type RoleChoice = { role: Role; customRoleId: string | null };

/** The tenant's roles, shared by every screen that names or picks one. */
export function useRoles() {
  const { current } = useTenant();
  return useQuery({ queryKey: ["roles", current.tenantId], queryFn: () => rolesApi.list(current.tenantId) });
}

const encode = (choice: RoleChoice) => (choice.role === "custom" ? `custom:${choice.customRoleId}` : choice.role);

function decode(value: string): RoleChoice {
  if (value.startsWith("custom:")) return { role: "custom", customRoleId: value.slice("custom:".length) };
  return { role: value as StartingRoleKey, customRoleId: null };
}

/** One line on what the chosen role is for: a starting role's purpose, or a custom role's own description. */
export function roleHelp(roles: RolesReply | undefined, choice: RoleChoice): string {
  if (choice.role !== "custom") return ROLE_DESCRIPTIONS[choice.role];
  const custom = roles?.customRoles.find((r) => r.id === choice.customRoleId);
  if (!custom) return "";
  return custom.description || `Copied from ${ROLE_LABELS[custom.basedOn]}.`;
}

/**
 * Pick a role: the starting roles, then the tenant's custom roles. Every
 * role is offered; a role whose permissions the person doesn't all hold
 * is refused by the API with a message that says so (ADR 0030), because
 * only the API knows what they hold under break-glass rules.
 */
export function RoleSelect({
  id,
  value,
  onChange,
  roles,
  disabled,
}: {
  id: string;
  value: RoleChoice;
  onChange: (choice: RoleChoice) => void;
  roles: RolesReply | undefined;
  disabled?: boolean;
}) {
  const custom = roles?.customRoles ?? [];
  const items = [
    ...(Object.keys(ROLE_LABELS) as StartingRoleKey[]).map((key) => ({ value: key, label: ROLE_LABELS[key] })),
    ...custom.map((r) => ({ value: `custom:${r.id}`, label: r.name })),
  ];
  return (
    <Select
      items={items}
      value={encode(value)}
      onValueChange={(next) => {
        if (next) onChange(decode(String(next)));
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Starting roles</SelectLabel>
          {(Object.keys(ROLE_LABELS) as StartingRoleKey[]).map((key) => (
            <SelectItem key={key} value={key}>
              {ROLE_LABELS[key]}
            </SelectItem>
          ))}
        </SelectGroup>
        {custom.length > 0 ? (
          <SelectGroup>
            <SelectLabel>Custom roles</SelectLabel>
            {custom.map((r) => (
              <SelectItem key={r.id} value={`custom:${r.id}`}>
                {r.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
      </SelectContent>
    </Select>
  );
}
