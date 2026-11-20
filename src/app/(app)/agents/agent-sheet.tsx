"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MoneyField, NumberField } from "@/components/ui/number-field";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { AGENT_DESCRIPTIONS, AGENT_LABELS, EVAL_LABELS, OFF_LABELS, toolLabel } from "@/lib/agents";
import { agentsApi } from "@/lib/api/agents";
import { messageOf } from "@/lib/api/errors";
import type { AgentChange, AgentSummary, AgentToolLine } from "@/lib/api/types";

type Values = { enabled: boolean; displayName: string; spendCap: string; dailyCap: string; refundCap: string; autoTools: string[] };

const dollars = (cents: number) => (cents / 100).toFixed(2);
const cents = (value: string) => Math.round(Number(value || "0") * 100);

function valuesOf(agent: AgentSummary): Values {
  return {
    enabled: agent.enabled,
    displayName: agent.name === agent.defaultName ? "" : agent.name,
    spendCap: dollars(agent.monthlySpendCapCents),
    dailyCap: String(agent.dailyReplyCap),
    refundCap: dollars(agent.refundCapCents),
    autoTools: [...agent.autoTools].sort(),
  };
}

/** Only what changed is sent, so the audit entry names exactly what moved. */
function changeOf(before: Values, after: Values): AgentChange | null {
  const change: AgentChange = {};
  if (after.enabled !== before.enabled) change.enabled = after.enabled;
  if (after.displayName.trim() !== before.displayName) change.displayName = after.displayName.trim() || null;
  if (cents(after.spendCap) !== cents(before.spendCap)) change.monthlySpendCapCents = cents(after.spendCap);
  if (Number(after.dailyCap || "0") !== Number(before.dailyCap)) change.dailyReplyCap = Number(after.dailyCap || "0");
  if (cents(after.refundCap) !== cents(before.refundCap)) change.refundCapCents = cents(after.refundCap);
  if (after.autoTools.join() !== before.autoTools.join()) change.autoTools = after.autoTools;
  return Object.keys(change).length > 0 ? change : null;
}

/**
 * One agent's settings (docs/decisions/agents.md AGT5 to AGT7). Switching
 * on needs a passing eval and a spend cap; a tool runs without approval
 * only where its ceiling allows. The API refuses anything else and the
 * sheet shows its reason. Without agents:manage the sheet is read-only.
 */
export function AgentSheet({ agent, manage, onOpenChange }: { agent: AgentSummary | null; manage: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={agent !== null} onOpenChange={onOpenChange}>
      <SheetContent>{agent ? <AgentForm key={agent.agent} agent={agent} manage={manage} onDone={() => onOpenChange(false)} /> : null}</SheetContent>
    </Sheet>
  );
}

function AgentForm({ agent, manage, onDone }: { agent: AgentSummary; manage: boolean; onDone: () => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const before = valuesOf(agent);
  const [values, setValues] = useState<Values>(before);
  const [error, setError] = useState<string | null>(null);
  const change = changeOf(before, values);
  const label = AGENT_LABELS[agent.agent];
  const canSwitchOn = agent.evals === "passed";
  const refundCapped = agent.tools.some((tool) => tool.name === "request_refund" && tool.ceiling === "auto");

  const save = useMutation({
    mutationFn: (body: AgentChange) => agentsApi.change(current.tenantId, agent.agent, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agents", current.tenantId] });
      toast.success("Saved", { description: label });
      onDone();
    },
    onError: (err) => setError(messageOf(err)),
  });

  const setAuto = (name: string, on: boolean) =>
    setValues((v) => ({ ...v, autoTools: (on ? [...v.autoTools, name] : v.autoTools.filter((t) => t !== name)).sort() }));

  return (
    <>
      <SheetHeader>
        <SheetTitle>{label}</SheetTitle>
        <SheetDescription>{AGENT_DESCRIPTIONS[agent.agent]}</SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form
          id="agent-form"
          className="field-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (change) save.mutate(change);
          }}
        >
          <div className="field">
            <label className="choice-row">
              <Switch
                checked={values.enabled}
                disabled={!manage || (!values.enabled && !canSwitchOn)}
                onCheckedChange={(enabled) => setValues((v) => ({ ...v, enabled }))}
              />
              <span>
                Switched on
                <span className="choice-sub">{switchHelp(agent, canSwitchOn)}</span>
              </span>
            </label>
          </div>
          <div className="field">
            <label htmlFor="agent-name">
              Name patients see <span className="opt">optional</span>
            </label>
            <Input
              id="agent-name"
              maxLength={40}
              placeholder={agent.defaultName}
              value={values.displayName}
              disabled={!manage}
              onChange={(e) => setValues((v) => ({ ...v, displayName: e.target.value }))}
            />
            <div className="helper">Patients are always told it is an AI agent. A name must not suggest a clinician.</div>
          </div>
          <div className="field">
            <label htmlFor="agent-spend">Monthly spend cap</label>
            <MoneyField
              id="agent-spend"
              min={0}
              max={5000}
              value={values.spendCap}
              disabled={!manage}
              onValueChange={(spendCap) => setValues((v) => ({ ...v, spendCap }))}
            />
            <div className="helper">Up to $5,000. At the cap the agent stops and hands conversations to your team. Owners hear at 80% and 100%.</div>
          </div>
          <div className="field">
            <label htmlFor="agent-daily">Runs per day</label>
            <NumberField
              id="agent-daily"
              min={0}
              max={10000}
              value={values.dailyCap}
              disabled={!manage}
              onValueChange={(dailyCap) => setValues((v) => ({ ...v, dailyCap }))}
            />
            <div className="helper">Up to 10,000, counted in your time zone. Each conversation also stops at 30 a day.</div>
          </div>
          {refundCapped ? (
            <div className="field">
              <label htmlFor="agent-refund">Largest refund without approval</label>
              <MoneyField
                id="agent-refund"
                min={0}
                max={500}
                value={values.refundCap}
                disabled={!manage}
                onValueChange={(refundCap) => setValues((v) => ({ ...v, refundCap }))}
              />
              <div className="helper">Up to $500. A larger refund always waits for a person.</div>
            </div>
          ) : null}
          <div className="field" role="group" aria-labelledby="agent-tools-label">
            <div className="choice-group-head" id="agent-tools-label">
              Tools
            </div>
            {agent.tools.map((tool) => (
              <ToolRow key={tool.name} tool={tool} auto={values.autoTools.includes(tool.name)} disabled={!manage} onAuto={(on) => setAuto(tool.name, on)} />
            ))}
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
      <SheetFooter note={manage ? "Changes apply to the agent's next run." : "Only an owner can change agents."}>
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          {manage ? "Cancel" : "Close"}
        </Button>
        {manage ? (
          <Button type="submit" form="agent-form" disabled={save.isPending || !change}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </SheetFooter>
    </>
  );
}

function switchHelp(agent: AgentSummary, canSwitchOn: boolean): string {
  if (!canSwitchOn) return EVAL_LABELS[agent.evals].help;
  if (agent.off === "platform_off" || agent.off === "tenant_paused") return `${OFF_LABELS[agent.off]}, so it won't run until that changes.`;
  return "It answers on its channels and runs its jobs. Switching off sends its conversations to your team.";
}

/** A tool, what it may do without a person, and whether it is here yet. */
function ToolRow({ tool, auto, disabled, onAuto }: { tool: AgentToolLine; auto: boolean; disabled: boolean; onAuto: (on: boolean) => void }) {
  const waiting = !tool.available ? `Arrives with ${tool.waitingOn ?? "its module"}.` : null;
  if (tool.changesData && tool.ceiling === "auto") {
    return (
      <label className="choice-row">
        <Checkbox checked={auto} disabled={disabled || !tool.available} onCheckedChange={(on) => onAuto(on === true)} />
        <span>
          {toolLabel(tool.name)}
          <span className="choice-sub">{waiting ?? (auto ? "Runs without approval." : "Waits for approval. Tick to let it run without.")}</span>
        </span>
      </label>
    );
  }
  return (
    <div className="choice-row">
      <span aria-hidden className="w-4" />
      <span>
        {toolLabel(tool.name)}
        <span className="choice-sub">{[waiting, tool.changesData ? "Always waits for approval." : "Looks things up only."].filter(Boolean).join(" ")}</span>
      </span>
    </div>
  );
}
