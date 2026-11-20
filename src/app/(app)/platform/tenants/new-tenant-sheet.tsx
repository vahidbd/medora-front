"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { messageOf } from "@/lib/api/errors";
import { platformApi } from "@/lib/api/tenant";
import type { TimeZone } from "@/lib/api/types";
import { TIME_ZONE_LABELS } from "@/lib/tenant-setup";

const ZONES = Object.entries(TIME_ZONE_LABELS).map(([value, label]) => ({
  value: value as TimeZone,
  label,
}));

/** What to say once an owner's invitation is saved: the email may not have gone out (ADM5, ADM14). */
export function announceOwnerInvitation(email: "sent" | "failed" | "not_configured", saved: string) {
  if (email === "sent") toast.success(saved, { description: "The owner has 14 days to accept." });
  else if (email === "failed")
    toast.warning(`${saved}, but the email did not go out`, {
      description: "Use Send owner invitation again.",
    });
  else
    toast.info(saved, {
      description: "Email isn't set up here, so nothing was sent.",
    });
}

/** A new tenant and its first owner's invitation (docs/decisions/admin.md ADM14). */
export function NewTenantSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>{open ? <NewTenantForm onDone={() => onOpenChange(false)} /> : null}</SheetContent>
    </Sheet>
  );
}

function NewTenantForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [timeZone, setTimeZone] = useState<TimeZone>("Australia/Sydney");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      platformApi.createTenant({
        name: name.trim(),
        timeZone,
        ownerEmail: ownerEmail.trim(),
        ...(ownerName.trim() ? { ownerName: ownerName.trim() } : {}),
      }),
    onSuccess: (reply) => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
      announceOwnerInvitation(reply.email, "Tenant created");
      onDone();
    },
    onError: (err) => setError(messageOf(err, "The tenant was not created. Try again.")),
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>New tenant</SheetTitle>
        <SheetDescription>Its first owner gets an invitation and sets up the rest. You don&apos;t join it.</SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form
          id="tenant-form"
          className="field-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="tenant-new-name">
              Name <span className="req">*</span>
            </label>
            <Input id="tenant-new-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tenant-new-zone">
              Time zone <span className="req">*</span>
            </label>
            <Select items={ZONES} value={timeZone} onValueChange={(next) => next && setTimeZone(next as TimeZone)}>
              <SelectTrigger id="tenant-new-zone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZONES.map((zone) => (
                  <SelectItem key={zone.value} value={zone.value}>
                    {zone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="field">
            <label htmlFor="tenant-owner-email">
              Owner&apos;s email <span className="req">*</span>
            </label>
            <Input
              id="tenant-owner-email"
              type="email"
              required
              maxLength={254}
              autoComplete="off"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="tenant-owner-name">
              Owner&apos;s name <span className="opt">optional</span>
            </label>
            <Input
              id="tenant-owner-name"
              maxLength={120}
              autoComplete="off"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
            <div className="helper">Used only if this email is new to Medora.</div>
          </div>
          {error ? (
            <div className="field">
              <div className="err" role="alert">
                {error}
              </div>
            </div>
          ) : null}
        </form>
      </SheetBody>
      <SheetFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={create.isPending}>
          Cancel
        </Button>
        <Button type="submit" form="tenant-form" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create tenant"}
        </Button>
      </SheetFooter>
    </>
  );
}
