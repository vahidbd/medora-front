"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import { useShellTenant, useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { messageOf } from "@/lib/api/errors";
import { breakGlassApi } from "@/lib/api/staff";
import { formatTime } from "@/lib/format";

const REASON_MIN = 10;
const REASON_MAX = 500;

/**
 * Break-glass in the topbar (ADR 0220, docs/decisions/admin.md ADM3).
 * Shown only to someone whose role holds clinical permissions it can't use
 * on its own, such as the owner. Opening it takes a reason and lasts 60
 * minutes; while it is open the topbar says until when and offers to end
 * it. The API decides what it unlocks; this only asks and shows.
 */
export function BreakGlassControl() {
  // Platform staff with no tenant have no break-glass.
  return useShellTenant().current ? <TenantBreakGlass /> : null;
}

function TenantBreakGlass() {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  // The API sends `until` only while break-glass is open.
  const until = current.breakGlass.until;
  const [lapsed, setLapsed] = useState<string | null>(null);

  // The window closes on its own: show that, and ask the API again so permissions follow.
  useEffect(() => {
    if (!until) return;
    const timer = window.setTimeout(
      () => {
        setLapsed(until);
        void queryClient.invalidateQueries({ queryKey: ["me"] });
      },
      Math.max(new Date(until).getTime() - Date.now(), 0),
    );
    return () => window.clearTimeout(timer);
  }, [until, queryClient]);

  const end = useMutation({
    mutationFn: () => breakGlassApi.close(current.tenantId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Break-glass ended");
    },
    onError: (err) => toast.error("Break-glass did not end", { description: messageOf(err) }),
  });

  if (!current.breakGlass.available) return null;
  const open = until !== null && lapsed !== until;

  if (open) {
    return (
      <span className="inline-flex items-center gap-2">
        <StatusBadge label={`Break-glass until ${formatTime(until)}`} tone="warning" />
        <Button variant="outline" size="sm" onClick={() => end.mutate()} disabled={end.isPending}>
          End break-glass
        </Button>
      </span>
    );
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAsking(true)}>
        <ShieldAlert />
        Break-glass
      </Button>
      <OpenDialog open={asking} onOpenChange={setAsking} />
    </>
  );
}

function OpenDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const tooShort = reason.trim().length < REASON_MIN;

  const start = useMutation({
    mutationFn: () => breakGlassApi.open(current.tenantId, reason.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      setReason("");
      onOpenChange(false);
    },
    onError: (err) => setError(messageOf(err)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open break-glass</DialogTitle>
          <DialogDescription>
            Your role can see clinical records only for a reason. Break-glass opens them to you for 60 minutes.
          </DialogDescription>
        </DialogHeader>
        <form
          id="break-glass-form"
          className="dlg-body"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!tooShort) start.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="break-glass-reason">
              Reason <span className="req">*</span>
            </label>
            <Textarea
              id="break-glass-reason"
              rows={3}
              required
              minLength={REASON_MIN}
              maxLength={REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="helper">
              Say why, such as the complaint or incident you are looking into. Leave out the patient&apos;s details.
            </div>
            {error ? (
              <div className="err" role="alert">
                {error}
              </div>
            ) : null}
          </div>
        </form>
        <DialogFooter note="Logged, and reviewed by someone else.">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={start.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="break-glass-form" disabled={start.isPending || tooShort}>
            {start.isPending ? "Opening…" : "Open break-glass"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
