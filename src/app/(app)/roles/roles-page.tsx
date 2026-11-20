"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { MoreMenu, PageHeader, type ActionItem } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { messageOf } from "@/lib/api/errors";
import { rolesApi } from "@/lib/api/staff";
import type { CustomRole, StartingRole } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles";
import { useRoles } from "../staff/role-select";
import { RoleSheet, type RoleSheetTarget } from "./role-sheet";

const staffCount = (n: number) => (n === 1 ? "1 staff member" : `${n} staff members`);

/**
 * Roles (docs/decisions/admin.md ADM1): the starting roles every tenant
 * has, which can be read and copied but not changed, then the tenant's
 * own custom roles. Whoever holds roles:manage makes, edits and deletes
 * custom roles; the API checks each change against what they hold.
 */
export function RolesPage() {
  const { current, can } = useTenant();
  const queryClient = useQueryClient();
  const roles = useRoles();
  const manage = can("roles:manage");
  const [target, setTarget] = useState<RoleSheetTarget | null>(null);
  const [deleting, setDeleting] = useState<CustomRole | null>(null);

  const remove = useMutation({
    mutationFn: (role: CustomRole) => rolesApi.remove(current.tenantId, role.id),
    onSuccess: (_reply, role) => {
      void queryClient.invalidateQueries({ queryKey: ["roles", current.tenantId] });
      toast.success("Role deleted", { description: role.name });
    },
    onError: (err) => toast.error("The role was not deleted", { description: messageOf(err) }),
  });

  const startingActions = (role: StartingRole): ActionItem[] => [
    { label: "See permissions", icon: Eye, onSelect: () => setTarget({ mode: "view", key: role.key }) },
    ...(manage ? [{ label: "Copy to a new role", icon: Copy, onSelect: () => setTarget({ mode: "new", basedOn: role.key }) }] : []),
  ];
  const customActions = (role: CustomRole): ActionItem[] =>
    manage
      ? [
          { label: "Edit role", icon: Pencil, onSelect: () => setTarget({ mode: "edit", role }) },
          { label: "Delete role", icon: Trash2, destructive: true, onSelect: () => setDeleting(role) },
        ]
      : [];

  return (
    <div>
      <PageHeader
        title="Roles"
        description="What each role lets staff do"
        primaryAction={manage ? { label: "New role", onClick: () => setTarget({ mode: "new", basedOn: "support" }) } : undefined}
      />
      {roles.isPending ? (
        <Card aria-busy="true" aria-label="Loading roles">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : roles.isError ? (
        <LoadFailedState noun="list of roles" onRetry={() => void roles.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <h2>Custom roles</h2>
            </CardHeader>
            {roles.data.customRoles.length === 0 ? (
              <CardContent>
                <EmptyState
                  icon={ShieldCheck}
                  title="No custom roles yet"
                  description="Copy a starting role to make one with the permissions you choose."
                  boxed={false}
                />
              </CardContent>
            ) : (
              <CardContent className="flush">
                <Table aria-label="Custom roles">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Copied from</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Last changed</TableHead>
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.data.customRoles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell>
                          <span className="block">{role.name}</span>
                          {role.description ? <span className="cell-muted block">{role.description}</span> : null}
                        </TableCell>
                        <TableCell>{ROLE_LABELS[role.basedOn]}</TableCell>
                        <TableCell>{role.memberCount}</TableCell>
                        <TableCell>{formatDate(role.updatedAt)}</TableCell>
                        <TableCell className="text-right">
                          <RowMenu name={role.name} items={customActions(role)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
          <Card>
            <CardHeader>
              <h2>Starting roles</h2>
            </CardHeader>
            <CardContent className="flush">
              <Table aria-label="Starting roles">
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Clinical</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.data.startingRoles.map((role) => (
                    <TableRow key={role.key}>
                      <TableCell>
                        <span className="block">{ROLE_LABELS[role.key]}</span>
                        <span className="cell-muted block">{ROLE_DESCRIPTIONS[role.key]}</span>
                      </TableCell>
                      <TableCell>{role.clinical ? <StatusBadge label="Clinical" tone="info" /> : null}</TableCell>
                      <TableCell>{role.memberCount}</TableCell>
                      <TableCell className="text-right">
                        <RowMenu name={ROLE_LABELS[role.key]} items={startingActions(role)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {roles.data ? <RoleSheet target={target} roles={roles.data} onOpenChange={(open) => !open && setTarget(null)} /> : null}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleting ? `Delete ${deleting.name}?` : "Delete role?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.memberCount > 0
                ? `${staffCount(deleting.memberCount)} still ${deleting.memberCount === 1 ? "has" : "have"} this role. Give them another role first.`
                : "Nobody has this role, so nobody loses access."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!deleting || deleting.memberCount > 0}
              onClick={() => {
                if (deleting) remove.mutate(deleting);
                setDeleting(null);
              }}
            >
              Delete role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowMenu({ name, items }: { name: string; items: ActionItem[] }) {
  return items.length > 0 ? <MoreMenu items={items} label={`Actions for ${name}`} size="icon-sm" /> : null;
}
