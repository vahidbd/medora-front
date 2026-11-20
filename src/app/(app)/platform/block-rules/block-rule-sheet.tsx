"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { blockRulesApi } from "@/lib/api/catalogue";
import { messageOf } from "@/lib/api/errors";
import type { BlockRuleMatch } from "@/lib/api/types";
import { MATCH_LABELS, ruleTarget } from "@/lib/catalogue";

const MATCHES = Object.entries(MATCH_LABELS).map(([value, label]) => ({ value: value as BlockRuleMatch, label }));
const SCHEDULES = (["S2", "S3", "S4", "S8"] as const).map((value) => ({ value, label: `Schedule ${value.slice(1)} (${value})` }));
const REASON_MIN = 10;

/**
 * A new block rule for every tenant (docs/decisions/catalogue.md CAT2). It
 * applies at once; announcing one for a later date is for an operator,
 * through the API. Only a reviewed script retires a rule, so the sheet says
 * so before it is added.
 */
export function BlockRuleSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>{open ? <BlockRuleForm onDone={() => onOpenChange(false)} /> : null}</SheetContent>
    </Sheet>
  );
}

function BlockRuleForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [match, setMatch] = useState<BlockRuleMatch>("schedule");
  const [schedule, setSchedule] = useState("S8");
  const [artgNumber, setArtgNumber] = useState("");
  const [reason, setReason] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const value = match === "schedule" ? schedule : match === "artg_number" ? artgNumber.trim() : null;

  const add = useMutation({
    mutationFn: () => blockRulesApi.add({ match, value, reason: reason.trim(), sourceUrl: sourceUrl.trim() || null }),
    onSuccess: (rule) => {
      void queryClient.invalidateQueries({ queryKey: ["block-rules"] });
      // Every tenant's products answer differently now.
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Block rule added", { description: ruleTarget(rule) });
      onDone();
    },
    onError: (err) => setError(messageOf(err, "The rule was not added. Try again.")),
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>New block rule</SheetTitle>
        <SheetDescription>Matching products stop at once in every tenant. Only a reviewed script can retire a rule.</SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form
          id="block-rule-form"
          className="field-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            add.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="rule-match">
              Block <span className="req">*</span>
            </label>
            <Select items={MATCHES} value={match} onValueChange={(next) => next && setMatch(next as BlockRuleMatch)}>
              <SelectTrigger id="rule-match" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATCHES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {match === "schedule" ? (
            <div className="field">
              <label htmlFor="rule-schedule">
                Schedule <span className="req">*</span>
              </label>
              <Select items={SCHEDULES} value={schedule} onValueChange={(next) => next && setSchedule(String(next))}>
                <SelectTrigger id="rule-schedule" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {match === "artg_number" ? (
            <div className="field">
              <label htmlFor="rule-artg">
                ARTG number <span className="req">*</span>
              </label>
              <Input
                id="rule-artg"
                required
                inputMode="numeric"
                maxLength={20}
                autoComplete="off"
                className="font-mono"
                value={artgNumber}
                onChange={(e) => setArtgNumber(e.target.value)}
              />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="rule-reason">
              Reason <span className="req">*</span>
            </label>
            <Textarea
              id="rule-reason"
              rows={3}
              required
              minLength={REASON_MIN}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="helper">Tenants see it beside every product it blocks.</div>
          </div>
          <div className="field">
            <label htmlFor="rule-source">
              Source <span className="opt">optional</span>
            </label>
            <Input
              id="rule-source"
              type="url"
              maxLength={500}
              placeholder="https://"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
            <div className="helper">The regulator&apos;s notice or the decision behind the rule.</div>
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
        <Button type="button" variant="outline" onClick={onDone} disabled={add.isPending}>
          Cancel
        </Button>
        <Button type="submit" form="block-rule-form" disabled={add.isPending || reason.trim().length < REASON_MIN}>
          {add.isPending ? "Adding…" : "Add block rule"}
        </Button>
      </SheetFooter>
    </>
  );
}
