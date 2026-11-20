"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, MailPlus, Send, Trash2, UserCog, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { messageOf } from "@/lib/api/errors";
import { staffApi } from "@/lib/api/staff";
import type { StaffMember } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { roleName } from "@/lib/roles";
import { accessLabel, accessStateOf } from "@/lib/staff-access";
import { ChangeSheet } from "./change-sheet";
import { announceInvitation, InviteSheet } from "./invite-sheet";
import { SignInsSheet } from "./sign-ins-sheet";

/**
 * Staff: who works in this tenant, their role, where their access stands
 * and when they last signed in. Whoever holds staff:manage invites people,
 * changes roles and access, and resends or withdraws invitations; the API
 * checks every one of those itself (ADR 0036, docs/decisions/admin.md).
 */
export function StaffPage() {
  const { current, can } = useTenant();
  const queryClient = useQueryClient();
  const staff = useQuery({ queryKey: ["staff", current.tenantId], queryFn: () => staffApi.list(current.tenantId) });
  const manage = can("staff:manage");
  const [inviting, setInviting] = useState(false);
  const [changing, setChanging] = useState<StaffMember | null>(null);
  const [history, setHistory] = useState<StaffMember | null>(null);
  const [withdrawing, setWithdrawing] = useState<StaffMember | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff", current.tenantId] });

  const resend = useMutation({
    mutationFn: (member: StaffMember) => staffApi.resend(current.tenantId, member.membershipId),
    onSuccess: (reply) => {
      void refresh();
      announceInvitation(reply, true);
    },
    onError: (err) => toast.error("The invitation was not sent again", { description: messageOf(err) }),
  });

  const withdraw = useMutation({
    mutationFn: (member: StaffMember) => staffApi.withdraw(current.tenantId, member.membershipId),
    onSuccess: (_reply, member) => {
      void refresh();
      toast.success("Invitation withdrawn", { description: member.email });
    },
    onError: (err) => toast.error("The invitation was not withdrawn", { description: messageOf(err) }),
  });

  const actionsFor = (member: StaffMember): ActionItem[] => {
    const self = member.membershipId === current.membershipId;
    const ownHistory = { label: "Sign-in history", icon: History, onSelect: () => setHistory(member) };
    if (self) return [ownHistory];
    if (!manage) return [];
    if (member.status === "invited") {
      return [
        { label: "Resend invitation", icon: Send, onSelect: () => resend.mutate(member) },
        { label: "Withdraw invitation", icon: Trash2, destructive: true, onSelect: () => setWithdrawing(member) },
      ];
    }
    return [{ label: "Change role and access", icon: UserCog, onSelect: () => setChanging(member) }, ownHistory];
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Who works here and what they can do"
        primaryAction={manage ? { label: "Invite staff", icon: MailPlus, onClick: () => setInviting(true) } : undefined}
      />
      {staff.isPending ? (
        <Card aria-busy="true" aria-label="Loading staff">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : staff.isError ? (
        <LoadFailedState noun="list of staff" onRetry={() => void staff.refetch()} />
      ) : staff.data.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No staff yet"
          description="Nobody has been invited to this tenant."
          actionLabel={manage ? "Invite staff" : undefined}
          onAction={manage ? () => setInviting(true) : undefined}
        />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.data.map((member) => (
                  <StaffRow key={member.membershipId} member={member} actions={actionsFor(member)} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <InviteSheet open={inviting} onOpenChange={setInviting} />
      <ChangeSheet member={changing} onOpenChange={(open) => !open && setChanging(null)} />
      <SignInsSheet
        member={history}
        self={history?.membershipId === current.membershipId}
        onOpenChange={(open) => !open && setHistory(null)}
      />
      <AlertDialog open={withdrawing !== null} onOpenChange={(open) => !open && setWithdrawing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              {withdrawing?.email} can no longer use it to join. You can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (withdrawing) withdraw.mutate(withdrawing);
                setWithdrawing(null);
              }}
            >
              Withdraw invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StaffRow({ member, actions }: { member: StaffMember; actions: ActionItem[] }) {
  const state = accessStateOf(member);
  const { label, tone } = accessLabel(state);
  const name = member.displayName ?? member.email;
  const until =
    state === "invited" && member.invitationExpiresAt
      ? `Until ${formatDate(member.invitationExpiresAt)}`
      : state === "active" && member.expiresAt
        ? `Ends ${formatDate(member.expiresAt)}`
        : null;
  return (
    <TableRow>
      <TableCell>
        <span className="inline-flex items-center gap-2">
          <InitialsAvatar name={name} size={28} />
          <span className="min-w-0">
            <span className="block">{name}</span>
            {member.displayName ? <span className="cell-muted block">{member.email}</span> : null}
          </span>
        </span>
      </TableCell>
      <TableCell>{roleName(member)}</TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-2">
          <StatusBadge label={label} tone={tone} />
          {until ? <span className="cell-muted">{until}</span> : null}
        </span>
      </TableCell>
      <TableCell>{formatDateTime(member.lastSignInAt)}</TableCell>
      <TableCell className="text-right">
        {actions.length > 0 ? <MoreMenu items={actions} label={`Actions for ${name}`} size="icon-sm" /> : null}
      </TableCell>
    </TableRow>
  );
}
