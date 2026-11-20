"use client";

import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { useTenant } from "@/components/shell/tenant-context";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { meApi, staffApi } from "@/lib/api/staff";
import type { SignIn, StaffMember } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

/**
 * Recent sign-ins (docs/decisions/admin.md ADM6): one row per session,
 * with where from and on what device, newest first. Your own come from
 * /me/sign-ins; anyone else's need staff:manage.
 */
export function SignInsSheet({
  member,
  self,
  onOpenChange,
}: {
  member: StaffMember | null;
  /** The member is the person signed in. */
  self: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={member !== null} onOpenChange={onOpenChange}>
      <SheetContent>{member ? <SignInsBody member={member} self={self} /> : null}</SheetContent>
    </Sheet>
  );
}

function SignInsBody({ member, self }: { member: StaffMember; self: boolean }) {
  const { current } = useTenant();
  const signIns = useQuery({
    queryKey: self ? ["me", "sign-ins"] : ["staff", current.tenantId, member.membershipId, "sign-ins"],
    queryFn: () => (self ? meApi.signIns() : staffApi.signIns(current.tenantId, member.membershipId)),
  });
  return (
    <>
      <SheetHeader>
        <SheetTitle>Sign-in history</SheetTitle>
        <SheetDescription>{member.displayName ?? member.email}</SheetDescription>
      </SheetHeader>
      <SheetBody>
        {signIns.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading sign-ins">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </div>
        ) : signIns.isError ? (
          <LoadFailedState noun="sign-in history" onRetry={() => void signIns.refetch()} />
        ) : signIns.data.length === 0 ? (
          <EmptyState icon={History} title="No sign-ins yet" description="Each new sign-in shows here, newest first." />
        ) : (
          <SignInTable rows={signIns.data} />
        )}
      </SheetBody>
    </>
  );
}

function SignInTable({ rows }: { rows: SignIn[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Device</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Two-step</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.at}>
            <TableCell>{formatDateTime(row.at)}</TableCell>
            <TableCell>{row.device ?? ""}</TableCell>
            <TableCell>
              <span className="cell-mono">{row.clientIp ?? ""}</span>
            </TableCell>
            <TableCell>{row.secondFactor ? "Yes" : "No"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
