"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { messageOf } from "@/lib/api/errors";
import { companiesApi } from "@/lib/api/tenant";
import type { AuState, Company } from "@/lib/api/types";
import { formatAbn } from "@/lib/format";
import { AU_STATE_LABELS } from "@/lib/tenant-setup";

const STATES = Object.entries(AU_STATE_LABELS).map(([value, label]) => ({
  value: value as AuState,
  label,
}));

/** Add a company, or change one (docs/decisions/admin.md ADM19). `company` null is a new one. */
export function CompanySheet({
  company,
  open,
  onOpenChange,
}: {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {/* Keyed so a different company, or a new one, starts from its own values. */}
        {open ? <CompanyForm key={company?.companyId ?? "new"} company={company} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function CompanyForm({ company, onDone }: { company: Company | null; onDone: () => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const [legalName, setLegalName] = useState(company?.legalName ?? "");
  const [tradingName, setTradingName] = useState(company?.tradingName ?? "");
  const [abn, setAbn] = useState(company ? formatAbn(company.abn) : "");
  const [state, setState] = useState<AuState>(company?.state ?? "NSW");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const fields = {
        legalName: legalName.trim(),
        tradingName: tradingName.trim() || null,
        abn: abn.replace(/\s+/g, ""),
        state,
      };
      return company ? companiesApi.change(current.tenantId, company.companyId, fields) : companiesApi.create(current.tenantId, fields);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({
        queryKey: ["companies", current.tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["onboarding", current.tenantId],
      });
      toast.success(company ? "Company saved" : "Company added", {
        description: saved.legalName,
      });
      onDone();
    },
    onError: (err) => setError(messageOf(err, "The company was not saved. Try again.")),
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>{company ? `Edit ${company.legalName}` : "New company"}</SheetTitle>
        <SheetDescription>The legal entity patients deal with. Invoices and payouts name it.</SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form
          id="company-form"
          className="field-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="company-legal">
              Legal name <span className="req">*</span>
            </label>
            <Input id="company-legal" required maxLength={200} value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="company-trading">
              Trading name <span className="opt">optional</span>
            </label>
            <Input id="company-trading" maxLength={200} value={tradingName} onChange={(e) => setTradingName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="company-abn">
              ABN <span className="req">*</span>
            </label>
            <Input
              id="company-abn"
              required
              inputMode="numeric"
              maxLength={20}
              autoComplete="off"
              className="font-mono"
              value={abn}
              onChange={(e) => setAbn(e.target.value)}
            />
            <div className="helper">11 digits. Medora checks it against the ATO&apos;s checksum.</div>
          </div>
          <div className="field">
            <label htmlFor="company-state">
              State <span className="req">*</span>
            </label>
            <Select items={STATES} value={state} onValueChange={(next) => next && setState(next as AuState)}>
              <SelectTrigger id="company-state" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" form="company-form" disabled={save.isPending}>
          {save.isPending ? "Saving…" : company ? "Save company" : "Add company"}
        </Button>
      </SheetFooter>
    </>
  );
}
