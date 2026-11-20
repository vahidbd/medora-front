"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { patientsApi } from "@/lib/api/patients";
import { formatCalendarDate, formatDate } from "@/lib/format";
import { IDENTITY_STATUS } from "@/lib/patients";

/**
 * Patients (docs/decisions/patients.md IDN9, IDN21): newest first, or matching a
 * search by name, email or mobile. The search lives in this screen's state
 * and the request to the API, never in the page's address, because it
 * carries a name. Every patient shown is audited by the API.
 */
export function PatientsPage() {
  const { current } = useTenant();
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const patients = useQuery({
    queryKey: ["patients", current.tenantId, search],
    queryFn: () => patientsApi.list(current.tenantId, search || undefined),
  });

  return (
    <div>
      <PageHeader title="Patients" description="Everyone with an account at this tenant" />
      <form
        role="search"
        className="mb-4 flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(typed.trim());
        }}
      >
        <label htmlFor="patient-search" className="sr-only">
          Search patients
        </label>
        <Input id="patient-search" type="search" autoComplete="off" placeholder="Name, email or mobile" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <Button type="submit" variant="outline">
          <Search aria-hidden />
          Search
        </Button>
      </form>
      {patients.isPending ? (
        <Card aria-busy="true" aria-label="Loading patients">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : patients.isError ? (
        <LoadFailedState noun="list of patients" onRetry={() => void patients.refetch()} />
      ) : patients.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No patients match" : "No patients yet"}
          description={search ? "Try their family name, or their full email or mobile." : "Patients appear here once they create an account on one of your brands."}
        />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table aria-label="Patients">
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Date of birth</TableHead>
                  <TableHead>Identity</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.data.map((patient) => (
                  <TableRow key={patient.patientId}>
                    <TableCell>
                      <Link className="row-link" href={`/patients/${patient.patientId}`}>
                        {patient.displayName}
                      </Link>
                    </TableCell>
                    <TableCell>{formatCalendarDate(patient.dateOfBirth)}</TableCell>
                    <TableCell>
                      <StatusBadge label={IDENTITY_STATUS[patient.identityStatus].label} tone={IDENTITY_STATUS[patient.identityStatus].tone} />
                    </TableCell>
                    <TableCell className="cell-muted">{formatDate(patient.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
