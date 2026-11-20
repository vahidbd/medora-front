"use client";

import { useQuery } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { staffApi } from "@/lib/api/staff";
import { MEMBERSHIP_STATUS, ROLE_LABELS } from "@/lib/roles";

/**
 * Staff: who works in this tenant, their role and whether their access is
 * active. Read-only for now; changing a role comes with its own screen
 * (the API's PATCH /v1/staff/:membershipId and FND6 are ready for it).
 */
export function StaffPage() {
  const { current } = useTenant();
  const staff = useQuery({ queryKey: ["staff", current.tenantId], queryFn: () => staffApi.list(current.tenantId) });

  return (
    <div>
      <PageHeader title="Staff" description="Who works here and what they can do" />
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
        <EmptyState icon={UsersRound} title="No staff yet" description="Nobody has been invited to this tenant." />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.data.map((member) => {
                  const status = MEMBERSHIP_STATUS[member.status];
                  return (
                    <TableRow key={member.membershipId}>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <InitialsAvatar name={member.email} size={28} />
                          {member.email}
                        </span>
                      </TableCell>
                      <TableCell>{ROLE_LABELS[member.role]}</TableCell>
                      <TableCell>
                        <StatusBadge label={status.label} tone={status.tone} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
