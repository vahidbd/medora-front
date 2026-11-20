"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Ban, Package, Pencil, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadFailedState } from "@/components/shared/empty-state";
import { MoreMenu, PageHeader, type ActionItem } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTenant } from "@/components/shell/tenant-context";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { blockRulesApi, productsApi } from "@/lib/api/catalogue";
import { messageOf } from "@/lib/api/errors";
import type { Product, ProductStatus } from "@/lib/api/types";
import { KIND_LABELS, productDetails, productStatus, ruleTarget } from "@/lib/catalogue";
import { formatMoney } from "@/lib/format";
import { BlockDialog } from "./block-dialog";
import { ProductSheet } from "./product-sheet";

/**
 * Products (docs/decisions/catalogue.md CAT1 to CAT5): what the tenant
 * sells, each with whether it can be supplied now. Everyone reads them;
 * catalogue:manage adds, changes, archives and blocks them. Medora's block
 * rules show above the list, since no tenant can lift one.
 */
export function ProductsPage() {
  const { current, can } = useTenant();
  const queryClient = useQueryClient();
  const manage = can("catalogue:manage");
  const [show, setShow] = useState<ProductStatus>("active");
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [blocking, setBlocking] = useState<Product | null>(null);
  const products = useQuery({
    queryKey: ["products", current.tenantId],
    queryFn: () => productsApi.list(current.tenantId),
  });
  const rules = useQuery({ queryKey: ["block-rules"], queryFn: blockRulesApi.list });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["products", current.tenantId] });
  const archive = useMutation({
    mutationFn: ({ product, to }: { product: Product; to: ProductStatus }) =>
      productsApi.setStatus(current.tenantId, product.productId, to),
    onSuccess: (saved, { to }) => {
      refresh();
      toast.success(to === "archived" ? "Product archived" : "Product restored", { description: saved.name });
    },
    onError: (err) => toast.error("The product did not change", { description: messageOf(err) }),
  });
  const unblock = useMutation({
    mutationFn: (product: Product) => productsApi.unblock(current.tenantId, product.productId),
    onSuccess: (saved) => {
      refresh();
      // CAT4: lifting the tenant's block leaves Medora's rule in place, and says so.
      if (saved.blocked) toast.warning("Your block is lifted, but Medora still blocks it", { description: saved.blocked.reason });
      else toast.success("Block lifted", { description: saved.name });
    },
    onError: (err) => toast.error("The block was not lifted", { description: messageOf(err) }),
  });

  const actions = (product: Product): ActionItem[] => {
    if (!manage) return [];
    if (product.status === "archived") {
      return [{ label: "Restore", icon: ArchiveRestore, onSelect: () => archive.mutate({ product, to: "active" }) }];
    }
    const tenantBlocked = product.blocked?.code === "tenant_block";
    return [
      { label: "Edit product", icon: Pencil, onSelect: () => setEditing(product) },
      tenantBlocked
        ? { label: "Lift block", icon: ShieldOff, onSelect: () => unblock.mutate(product) }
        : { label: "Block product", icon: Ban, onSelect: () => setBlocking(product) },
      { label: "Archive", icon: Archive, onSelect: () => archive.mutate({ product, to: "archived" }) },
    ];
  };

  const shown = products.data?.filter((product) => product.status === show) ?? [];
  const inForce = rules.data?.filter((rule) => new Date(rule.effectiveFrom) <= new Date()) ?? [];

  return (
    <div>
      <PageHeader
        title="Products"
        description="What you sell, and whether it can be supplied"
        primaryAction={manage ? { label: "New product", onClick: () => setAdding(true) } : undefined}
      />
      {inForce.length > 0 ? (
        <div className="alert warning mb-4" role="note">
          <Ban className="ico" aria-hidden />
          <div className="body">
            <p>
              Medora blocks these for every tenant: {inForce.map(ruleTarget).join(", ")}. A matching product can&apos;t be prescribed,
              ordered or charged.
            </p>
          </div>
        </div>
      ) : null}
      <Tabs value={show} onValueChange={(value) => setShow(value as ProductStatus)} className="mb-4">
        <TabsList aria-label="Which products">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>
      {products.isPending ? (
        <Card aria-busy="true" aria-label="Loading products">
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="gate-skel-sub" />
            ))}
          </CardContent>
        </Card>
      ) : products.isError ? (
        <LoadFailedState noun="list of products" onRetry={() => void products.refetch()} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Package}
          title={show === "active" ? "No products yet" : "Nothing archived"}
          description={
            show === "active"
              ? "Add the medicines, devices and services you sell."
              : "Products you stop selling are kept here, never deleted."
          }
          actionLabel={manage && show === "active" ? "New product" : undefined}
          onAction={manage && show === "active" ? () => setAdding(true) : undefined}
        />
      ) : (
        <Card>
          <CardContent className="flush">
            <Table aria-label="Products">
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((product) => {
                  const status = productStatus(product);
                  const items = actions(product);
                  return (
                    <TableRow key={product.productId}>
                      <TableCell>
                        <span className="block">{product.name}</span>
                        <span className="cell-muted block">{productDetails(product).join(", ")}</span>
                      </TableCell>
                      <TableCell>{KIND_LABELS[product.kind]}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">
                        {formatMoney(product.priceCents / 100)}
                        {product.gstFree ? <span className="cell-muted block">GST-free</span> : null}
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={status.label} tone={status.tone} />
                        {product.blocked && product.status === "active" ? (
                          <span className="cell-muted block">{product.blocked.reason}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {items.length > 0 ? <MoreMenu items={items} label={`Actions for ${product.name}`} size="icon-sm" /> : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <ProductSheet
        product={editing}
        open={adding || editing !== null}
        onOpenChange={(next) => {
          if (!next) {
            setAdding(false);
            setEditing(null);
          }
        }}
      />
      <BlockDialog product={blocking} onOpenChange={(next) => !next && setBlocking(null)} />
    </div>
  );
}
