"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { messageOf } from "@/lib/api/errors";
import { staffApi } from "@/lib/api/staff";
import type { InvitationReply } from "@/lib/api/types";
import { endOfDay } from "@/lib/staff-access";
import { RoleSelect, roleHelp, useRoles, type RoleChoice } from "./role-select";

const START: RoleChoice = { role: "support", customRoleId: null };

/** What to say once an invitation is saved: the email may not have gone out (docs/decisions/admin.md ADM5). */
export function announceInvitation(reply: InvitationReply, resent = false) {
  const saved = resent ? "Invitation sent again" : "Invitation sent";
  if (reply.email === "sent") toast.success(saved, { description: reply.member.email });
  else if (reply.email === "failed")
    toast.warning("Invitation saved, but the email did not go out", { description: "Use Resend invitation to try again." });
  else toast.info("Invitation saved", { description: "Email isn't set up here, so nothing was sent." });
}

/**
 * Invite staff: an email, a name for a new account, a role and an
 * optional end date. The reply is the same whether or not the address
 * already has a Medora account, so the sheet never says which.
 */
export function InviteSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const roles = useRoles();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<RoleChoice>(START);
  const [ends, setEnds] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setName("");
    setChoice(START);
    setEnds("");
    setError(null);
  };

  const invite = useMutation({
    mutationFn: () =>
      staffApi.invite(current.tenantId, {
        email: email.trim(),
        ...(name.trim() ? { displayName: name.trim() } : {}),
        role: choice.role,
        customRoleId: choice.customRoleId,
        expiresAt: ends ? endOfDay(ends) : null,
      }),
    onSuccess: (reply) => {
      void queryClient.invalidateQueries({ queryKey: ["staff", current.tenantId] });
      announceInvitation(reply);
      reset();
      onOpenChange(false);
    },
    onError: (err) => setError(messageOf(err, "The invitation was not sent. Try again.")),
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Invite staff</SheetTitle>
          <SheetDescription>They get an email and have 14 days to accept it.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form
            id="invite-form"
            className="field-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              invite.mutate();
            }}
          >
            <div className="field">
              <label htmlFor="invite-email">
                Email <span className="req">*</span>
              </label>
              <Input
                id="invite-email"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="invite-name">
                Name <span className="opt">optional</span>
              </label>
              <Input id="invite-name" maxLength={120} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="helper">Used only if this email is new to Medora. Otherwise their own name is kept.</div>
            </div>
            <div className="field">
              <label htmlFor="invite-role">
                Role <span className="req">*</span>
              </label>
              <RoleSelect id="invite-role" value={choice} onChange={setChoice} roles={roles.data} />
              <div className="helper">{roleHelp(roles.data, choice)}</div>
            </div>
            <div className="field">
              <label htmlFor="invite-ends">
                Access ends <span className="opt">optional</span>
              </label>
              <DateField id="invite-ends" value={ends} onValueChange={setEnds} />
              <div className="helper">For a contractor or a locum. Their access stops at the end of that day.</div>
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={invite.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" disabled={invite.isPending}>
            {invite.isPending ? "Sending…" : "Send invitation"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
