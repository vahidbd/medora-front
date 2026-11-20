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
import { brandsApi } from "@/lib/api/tenant";
import type { Brand, Company } from "@/lib/api/types";

const HEX = /^#[0-9a-f]{6}$/i;

/** Add a brand as a draft, or change one (docs/decisions/admin.md ADM16, ADM17). `brand` null is a new one. */
export function BrandSheet({
  brand,
  companies,
  open,
  onOpenChange,
}: {
  brand: Brand | null;
  companies: Company[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {open ? <BrandForm key={brand?.brandId ?? "new"} brand={brand} companies={companies} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function BrandForm({ brand, companies, onDone }: { brand: Brand | null; companies: Company[]; onDone: () => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState(brand?.companyId ?? companies[0]?.companyId ?? "");
  const [name, setName] = useState(brand?.name ?? "");
  const [slug, setSlug] = useState(brand?.slug ?? "");
  const [supportEmail, setSupportEmail] = useState(brand?.supportEmail ?? "");
  const [supportPhone, setSupportPhone] = useState(brand?.supportPhone ?? "");
  const [colour, setColour] = useState(brand?.primaryColour ?? "");
  const [logoUrl, setLogoUrl] = useState(brand?.logoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const items = companies.map((company) => ({
    value: company.companyId,
    label: company.tradingName ?? company.legalName,
  }));
  // A live or paused brand stays with its company (ADM19); the API refuses a move, so the picker doesn't offer one.
  const companyFixed = brand !== null && brand.status !== "draft";

  const save = useMutation({
    mutationFn: () => {
      const fields = {
        companyId,
        name: name.trim(),
        supportEmail: supportEmail.trim() || null,
        supportPhone: supportPhone.trim() || null,
        primaryColour: colour.trim().toLowerCase() || null,
        logoUrl: logoUrl.trim() || null,
      };
      return brand
        ? brandsApi.change(current.tenantId, brand.brandId, fields)
        : brandsApi.create(current.tenantId, { ...fields, slug: slug.trim() });
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({
        queryKey: ["brands", current.tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["companies", current.tenantId],
      });
      toast.success(brand ? "Brand saved" : "Brand added", {
        description: saved.name,
      });
      onDone();
    },
    onError: (err) => setError(messageOf(err, "The brand was not saved. Try again.")),
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>{brand ? `Edit ${brand.name}` : "New brand"}</SheetTitle>
        <SheetDescription>
          {brand
            ? "Patients see these details on the brand's pages."
            : "A new brand starts as a draft. Nobody can reach it until it goes live."}
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form
          id="brand-form"
          className="field-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="brand-company">
              Company <span className="req">*</span>
            </label>
            <Select items={items} value={companyId} onValueChange={(next) => next && setCompanyId(String(next))} disabled={companyFixed}>
              <SelectTrigger id="brand-company" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="helper">
              {companyFixed ? "A live or paused brand stays with its company." : "The legal entity this brand trades as."}
            </div>
          </div>
          <div className="field">
            <label htmlFor="brand-name">
              Name <span className="req">*</span>
            </label>
            <Input id="brand-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="brand-slug">
              Address name <span className="req">*</span>
            </label>
            <Input
              id="brand-slug"
              required
              minLength={2}
              maxLength={40}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              autoComplete="off"
              className="font-mono"
              value={slug}
              disabled={brand !== null}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
            />
            <div className="helper">
              {brand
                ? "Part of the brand's public address. It never changes."
                : "Lower-case letters, numbers and hyphens. Unique across Medora, and it never changes."}
            </div>
          </div>
          <div className="field">
            <label htmlFor="brand-email">
              Support email <span className="opt">needed to go live</span>
            </label>
            <Input id="brand-email" type="email" maxLength={254} value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="brand-phone">
              Support phone <span className="opt">optional</span>
            </label>
            <Input id="brand-phone" type="tel" maxLength={20} value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="brand-colour">
              Colour <span className="opt">optional</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="brand-swatch" aria-hidden style={HEX.test(colour) ? { background: colour } : undefined} />
              <Input
                id="brand-colour"
                maxLength={7}
                placeholder="#1f6feb"
                autoComplete="off"
                className="font-mono"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
              />
            </div>
            <div className="helper">Buttons on the brand&apos;s pages. Medora refuses a colour text can&apos;t be read on.</div>
          </div>
          <div className="field">
            <label htmlFor="brand-logo">
              Logo address <span className="opt">optional</span>
            </label>
            <Input
              id="brand-logo"
              type="url"
              maxLength={500}
              placeholder="https://"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
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
        <Button type="submit" form="brand-form" disabled={save.isPending || !companyId}>
          {save.isPending ? "Saving…" : brand ? "Save brand" : "Add brand"}
        </Button>
      </SheetFooter>
    </>
  );
}
