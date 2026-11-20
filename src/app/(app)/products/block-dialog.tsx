"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTenant } from "@/components/shell/tenant-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { productsApi } from "@/lib/api/catalogue";
import { messageOf } from "@/lib/api/errors";
import type { Product } from "@/lib/api/types";

const REASON_MIN = 3;
const REASON_MAX = 300;

/** The tenant's own block on a product, with why (docs/decisions/catalogue.md CAT4). It can be lifted from the product's menu. */
export function BlockDialog({ product, onOpenChange }: { product: Product | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={product !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {product ? <BlockForm key={product.productId} product={product} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function BlockForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const tooShort = reason.trim().length < REASON_MIN;

  const block = useMutation({
    mutationFn: () => productsApi.block(current.tenantId, product.productId, reason.trim()),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["products", current.tenantId] });
      toast.success("Product blocked", { description: saved.name });
      onDone();
    },
    onError: (err) => setError(messageOf(err)),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{`Block ${product.name}?`}</DialogTitle>
        <DialogDescription>It can&apos;t be prescribed, ordered or charged in this tenant until you lift the block.</DialogDescription>
      </DialogHeader>
      <form
        id="block-form"
        className="dlg-body"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!tooShort) block.mutate();
        }}
      >
        <div className="field">
          <label htmlFor="block-reason">
            Reason <span className="req">*</span>
          </label>
          <Textarea
            id="block-reason"
            rows={3}
            required
            minLength={REASON_MIN}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="helper">Such as a recall or a supplier problem. Staff see it beside the product.</div>
          {error ? (
            <div className="err" role="alert">
              {error}
            </div>
          ) : null}
        </div>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={block.isPending}>
          Cancel
        </Button>
        <Button type="submit" form="block-form" disabled={block.isPending || tooShort}>
          {block.isPending ? "Blocking…" : "Block product"}
        </Button>
      </DialogFooter>
    </>
  );
}
