"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MoneyField } from "@/components/ui/number-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { productsApi } from "@/lib/api/catalogue";
import { messageOf } from "@/lib/api/errors";
import type { Product, ProductKind, Schedule, Storage } from "@/lib/api/types";
import { KIND_LABELS, STORAGE_LABELS } from "@/lib/catalogue";

const KINDS = Object.entries(KIND_LABELS).map(([value, label]) => ({ value: value as ProductKind, label }));
const STORAGES = Object.entries(STORAGE_LABELS).map(([value, label]) => ({ value: value as Storage, label }));
const UNSCHEDULED = "none";
const SCHEDULE_ITEMS = [
  { value: UNSCHEDULED, label: "Unscheduled" },
  ...(["S2", "S3", "S4", "S8"] as const).map((value) => ({ value, label: `Schedule ${value.slice(1)} (${value})` })),
];

const toCents = (dollars: string) => Math.round(Number(dollars) * 100);
const toDollars = (cents: number) => (cents / 100).toFixed(2);

/** Add a product, or change one (docs/decisions/catalogue.md CAT1). `product` null is a new one. */
export function ProductSheet({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {open ? <ProductForm key={product?.productId ?? "new"} product={product} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function ProductForm({ product, onDone }: { product: Product | null; onDone: () => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const [name, setName] = useState(product?.name ?? "");
  const [kind, setKind] = useState<ProductKind>(product?.kind ?? "medicine");
  const [schedule, setSchedule] = useState<string>(product?.schedule ?? UNSCHEDULED);
  const [artgNumber, setArtgNumber] = useState(product?.artgNumber ?? "");
  const [compounded, setCompounded] = useState(product?.compounded ?? false);
  const [strength, setStrength] = useState(product?.strength ?? "");
  const [form, setForm] = useState(product?.form ?? "");
  const [packSize, setPackSize] = useState(product?.packSize ?? "");
  const [storage, setStorage] = useState<Storage>(product?.storage ?? "room");
  const [price, setPrice] = useState(product ? toDollars(product.priceCents) : "");
  const [gstFree, setGstFree] = useState(product?.gstFree ?? true);
  const [error, setError] = useState<string | null>(null);
  const medicine = kind === "medicine";

  const save = useMutation({
    mutationFn: () => {
      const fields = {
        name: name.trim(),
        kind,
        // CAT1: only a medicine has a schedule or the compounded mark; the API refuses them on anything else.
        schedule: medicine && schedule !== UNSCHEDULED ? (schedule as Schedule) : null,
        artgNumber: artgNumber.trim() || null,
        compounded: medicine && compounded,
        strength: strength.trim() || null,
        form: form.trim() || null,
        packSize: packSize.trim() || null,
        storage,
        priceCents: toCents(price),
        gstFree,
      };
      return product ? productsApi.change(current.tenantId, product.productId, fields) : productsApi.create(current.tenantId, fields);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["products", current.tenantId] });
      toast.success(product ? "Product saved" : "Product added", { description: saved.name });
      onDone();
    },
    onError: (err) => setError(messageOf(err, "The product was not saved. Try again.")),
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>{product ? `Edit ${product.name}` : "New product"}</SheetTitle>
        <SheetDescription>
          The list price, for a product bought on its own. A program&apos;s own price decides what its patients pay.
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form
          id="product-form"
          className="field-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="product-name">
              Name <span className="req">*</span>
            </label>
            <Input id="product-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="product-kind">
              Kind <span className="req">*</span>
            </label>
            <Select items={KINDS} value={kind} onValueChange={(next) => next && setKind(next as ProductKind)}>
              <SelectTrigger id="product-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {medicine ? (
            <div className="field">
              <label htmlFor="product-schedule">
                Schedule <span className="req">*</span>
              </label>
              <Select items={SCHEDULE_ITEMS} value={schedule} onValueChange={(next) => next && setSchedule(String(next))}>
                <SelectTrigger id="product-schedule" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="product-artg">
              ARTG number <span className="opt">{medicine ? "or mark it compounded" : "optional"}</span>
            </label>
            <Input
              id="product-artg"
              inputMode="numeric"
              maxLength={20}
              autoComplete="off"
              className="font-mono"
              value={artgNumber}
              onChange={(e) => setArtgNumber(e.target.value)}
            />
            {medicine ? (
              <label className="choice-row mt-2">
                <Checkbox checked={compounded} onCheckedChange={(on) => setCompounded(on === true)} />
                <span>
                  Compounded
                  <span className="choice-sub">Made up by a pharmacy for the patient, so it has no ARTG number.</span>
                </span>
              </label>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="field">
              <label htmlFor="product-strength">
                Strength <span className="opt">optional</span>
              </label>
              <Input id="product-strength" maxLength={60} value={strength} onChange={(e) => setStrength(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="product-form">
                Form <span className="opt">optional</span>
              </label>
              <Input id="product-form" maxLength={60} value={form} onChange={(e) => setForm(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="product-pack">
                Pack size <span className="opt">optional</span>
              </label>
              <Input id="product-pack" maxLength={60} value={packSize} onChange={(e) => setPackSize(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="product-storage">
              Storage <span className="req">*</span>
            </label>
            <Select items={STORAGES} value={storage} onValueChange={(next) => next && setStorage(next as Storage)}>
              <SelectTrigger id="product-storage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORAGES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="field">
            <label htmlFor="product-price">
              Price <span className="req">*</span>
            </label>
            <MoneyField id="product-price" required min={0} max={100000} value={price} onValueChange={setPrice} />
            <label className="choice-row mt-2">
              <Checkbox checked={gstFree} onCheckedChange={(on) => setGstFree(on === true)} />
              <span>GST-free</span>
            </label>
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
        <Button type="submit" form="product-form" disabled={save.isPending}>
          {save.isPending ? "Saving…" : product ? "Save product" : "Add product"}
        </Button>
      </SheetFooter>
    </>
  );
}
