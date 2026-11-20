"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { messageOf } from "@/lib/api/errors";
import { breakGlassApi } from "@/lib/api/staff";
import type { BreakGlassRecord } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

/**
 * Break-glass reviews (docs/decisions/admin.md ADM3): every time someone
 * opened clinical records outside a clinical role, with their reason, for
 * whoever holds break_glass:review to read and mark reviewed. Nobody
 * reviews their own; the API refuses it.
 */
export function BreakGlassPage() {
  const { current } = useTenant();
  const [show, setShow] = useState<"waiting" | "all">("waiting");
  const [reviewing, setReviewing] = useState<BreakGlassRecord | null>(null);
  const list = useQuery({
    queryKey: ["break-glass", current.tenantId, show],
    queryFn: () => breakGlassApi.list(current.tenantId, show === "waiting"),
  });

  return (
    <div>
      <PageHeader title="Break-glass" description="Clinical access opened outside a clinical role" />
      <Tabs value={show} onValueChange={(value) => setShow(value as "waiting" | "all")} className="mb-4">
        <TabsList aria-label="Which break-glass">
          <TabsTrigger value="waiting">Waiting for review</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      {list.isPending ? (
        <Card aria-busy="true" aria-label="Loading break-glass">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : list.isError ? (
        <LoadFailedState noun="list of break-glass" onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={show === "waiting" ? "Nothing waiting for review" : "No break-glass yet"}
          description="Each time someone opens break-glass, it shows here with their reason."
        />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff member</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((row) => (
                  <TableRow key={row.breakGlassId}>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>
                      <span className="block">{formatDateTime(row.openedAt)}</span>
                      <span className="cell-muted block">Until {formatDateTime(row.endsAt)}</span>
                    </TableCell>
                    <TableCell>{row.reason}</TableCell>
                    <TableCell>
                      {row.reviewedAt ? (
                        <>
                          <StatusBadge label="Reviewed" tone="success" />
                          {row.reviewNote ? <span className="cell-muted block">{row.reviewNote}</span> : null}
                        </>
                      ) : (
                        <StatusBadge label="Waiting" tone="warning" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.reviewedAt ? null : (
                        <Button variant="outline" size="sm" onClick={() => setReviewing(row)}>
                          Mark reviewed
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <ReviewDialog row={reviewing} onOpenChange={(open) => !open && setReviewing(null)} />
    </div>
  );
}

function ReviewDialog({ row, onOpenChange }: { row: BreakGlassRecord | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent>{row ? <ReviewForm key={row.breakGlassId} row={row} onDone={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function ReviewForm({ row, onDone }: { row: BreakGlassRecord; onDone: () => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const review = useMutation({
    mutationFn: () => breakGlassApi.review(current.tenantId, row.breakGlassId, note.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["break-glass", current.tenantId] });
      toast.success("Marked reviewed");
      onDone();
    },
    onError: (err) => setError(messageOf(err)),
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle>Mark reviewed</DialogTitle>
        <DialogDescription>
          {row.email}, {formatDateTime(row.openedAt)}
        </DialogDescription>
      </DialogHeader>
      <form
        id="review-form"
        className="dlg-body"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          review.mutate();
        }}
      >
        <div className="field">
          <label htmlFor="review-note">
            Note <span className="opt">optional</span>
          </label>
          <Textarea id="review-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="helper">What you checked, such as the complaint or incident it matches.</div>
          {error ? (
            <div className="err" role="alert">
              {error}
            </div>
          ) : null}
        </div>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={review.isPending}>
          Cancel
        </Button>
        <Button type="submit" form="review-form" disabled={review.isPending}>
          {review.isPending ? "Saving…" : "Mark reviewed"}
        </Button>
      </DialogFooter>
    </>
  );
}
