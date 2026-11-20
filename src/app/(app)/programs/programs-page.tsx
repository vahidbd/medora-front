"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Layers, Pause, Pencil, Play, Rocket } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { messageOf } from "@/lib/api/errors";
import { programsApi, protocolsApi } from "@/lib/api/protocols";
import { brandsApi } from "@/lib/api/tenant";
import type { Program, ProgramStatus } from "@/lib/api/types";
import { MEASUREMENT_LABELS, PROGRAM_STATUS } from "@/lib/protocols";
import { ProgramSheet } from "./program-sheet";

type Move = { program: Program; to: Exclude<ProgramStatus, "draft"> };

const MOVE_COPY: Record<Move["to"], { title: (p: Program) => string; text: string; action: string; done: string }> = {
  live: { title: (p) => `Take ${p.name} live?`, text: "People can start its intake on the brand's site.", action: "Go live", done: "Program is live" },
  paused: { title: (p) => `Pause ${p.name}?`, text: "No new intakes start. Patients already in it keep their care.", action: "Pause program", done: "Program paused" },
  retired: { title: (p) => `Retire ${p.name}?`, text: "It can't start new intakes again, and it can't be changed. Patients already in it keep their care.", action: "Retire program", done: "Program retired" },
};

/**
 * Programs (docs/decisions/intake.md INT9, INT21): one brand's offer on one
 * protocol. Everyone in the tenant reads them; programs:manage adds them
 * and moves them between draft, live, paused and retired. The API refuses
 * going live without a signed-off protocol version, and the refusal shows.
 */
export function ProgramsPage() {
  const { current, can } = useTenant();
  const queryClient = useQueryClient();
  const programs = useQuery({ queryKey: ["programs", current.tenantId], queryFn: () => programsApi.list(current.tenantId) });
  const brands = useQuery({ queryKey: ["brands", current.tenantId], queryFn: () => brandsApi.list(current.tenantId) });
  const readsProtocols = can("protocols:read");
  const protocols = useQuery({ queryKey: ["protocols", current.tenantId], queryFn: () => protocolsApi.list(current.tenantId), enabled: readsProtocols });
  const manage = can("programs:manage");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [move, setMove] = useState<Move | null>(null);

  const setStatus = useMutation({
    mutationFn: ({ program, to }: Move) => programsApi.change(current.tenantId, program.programId, { status: to }),
    onSuccess: (saved, { program, to }) => {
      void queryClient.invalidateQueries({ queryKey: ["programs", current.tenantId] });
      toast.success(program.status === "paused" && to === "live" ? "Program resumed" : MOVE_COPY[to].done, { description: saved.name });
    },
    onError: (err) => toast.error("The program's status did not change", { description: messageOf(err) }),
  });

  const actions = (program: Program): ActionItem[] => {
    if (!manage || program.status === "retired") return [];
    return [
      { label: "Edit program", icon: Pencil, onSelect: () => setEditing(program) },
      ...(program.status === "draft" ? [{ label: "Go live", icon: Rocket, onSelect: () => setMove({ program, to: "live" }) }] : []),
      ...(program.status === "live" ? [{ label: "Pause new intakes", icon: Pause, onSelect: () => setMove({ program, to: "paused" }) }] : []),
      ...(program.status === "paused" ? [{ label: "Resume", icon: Play, onSelect: () => setStatus.mutate({ program, to: "live" }) }] : []),
      { label: "Retire", icon: Archive, destructive: true, onSelect: () => setMove({ program, to: "retired" }) },
    ];
  };

  const loading = programs.isPending || brands.isPending || (readsProtocols && protocols.isPending);
  const failed = programs.isError || brands.isError || (readsProtocols && protocols.isError);
  const canAdd = manage && readsProtocols;

  return (
    <div>
      <PageHeader
        title="Programs"
        description="What each brand offers, on which protocol"
        primaryAction={canAdd ? { label: "New program", onClick: () => setAdding(true) } : undefined}
      />
      {loading ? (
        <Card aria-busy="true" aria-label="Loading programs">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : failed ? (
        <LoadFailedState
          noun="list of programs"
          onRetry={() => {
            void programs.refetch();
            void brands.refetch();
            if (readsProtocols) void protocols.refetch();
          }}
        />
      ) : programs.data!.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No programs yet"
          description="A program puts a protocol on a brand's site, so people can start its intake."
          actionLabel={canAdd ? "New program" : undefined}
          onAction={canAdd ? () => setAdding(true) : undefined}
        />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table aria-label="Programs">
              <TableHeader>
                <TableRow>
                  <TableHead>Program</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>{readsProtocols ? "Protocol" : "Condition"}</TableHead>
                  <TableHead>Patients record</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.data!.map((program) => {
                  const brand = brands.data!.find((b) => b.brandId === program.brandId);
                  const protocol = protocols.data?.find((p) => p.protocolId === program.protocolId);
                  const items = actions(program);
                  return (
                    <TableRow key={program.programId}>
                      <TableCell>
                        <span className="block">{program.name}</span>
                        {program.checkInEveryDays ? <span className="cell-muted block">Check-in every {program.checkInEveryDays} days</span> : null}
                      </TableCell>
                      <TableCell>{brand?.name ?? ""}</TableCell>
                      <TableCell>{readsProtocols ? (protocol?.name ?? "") : program.condition}</TableCell>
                      <TableCell className="cell-muted">{program.measurements.map((m) => MEASUREMENT_LABELS[m]).join(", ")}</TableCell>
                      <TableCell>
                        <StatusBadge label={PROGRAM_STATUS[program.status].label} tone={PROGRAM_STATUS[program.status].tone} />
                      </TableCell>
                      <TableCell className="text-right">{items.length > 0 ? <MoreMenu items={items} label={`Actions for ${program.name}`} size="icon-sm" /> : null}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ProgramSheet
        program={editing}
        open={adding || editing !== null}
        brands={brands.data ?? []}
        protocols={protocols.data ?? []}
        onOpenChange={(next) => {
          if (!next) {
            setAdding(false);
            setEditing(null);
          }
        }}
      />
      <AlertDialog open={move !== null} onOpenChange={(next) => !next && setMove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{move ? MOVE_COPY[move.to].title(move.program) : ""}</AlertDialogTitle>
            <AlertDialogDescription>{move ? MOVE_COPY[move.to].text : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (move) setStatus.mutate(move);
                setMove(null);
              }}
            >
              {move ? MOVE_COPY[move.to].action : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
