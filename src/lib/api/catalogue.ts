import { request } from "./client";
import type { BlockRule, BlockRuleInput, Product, ProductChange, ProductInput, ProductStatus } from "./types";

const id = (value: string) => encodeURIComponent(value);

/** A tenant's products, their status and its own blocks (docs/decisions/catalogue.md CAT1, CAT4). */
export const productsApi = {
  list: async (tenant: string) => (await request<{ products: Product[] }>("/products", { tenant })).products,
  create: (tenant: string, input: ProductInput) => request<Product>("/products", { method: "POST", body: input, tenant }),
  change: (tenant: string, productId: string, change: ProductChange) =>
    request<Product>(`/products/${id(productId)}`, { method: "PATCH", body: change, tenant }),
  setStatus: (tenant: string, productId: string, status: ProductStatus) =>
    request<Product>(`/products/${id(productId)}/status`, { method: "POST", body: { status }, tenant }),
  block: (tenant: string, productId: string, reason: string) =>
    request<Product>(`/products/${id(productId)}/block`, { method: "POST", body: { reason }, tenant }),
  unblock: (tenant: string, productId: string) => request<Product>(`/products/${id(productId)}/block`, { method: "DELETE", tenant }),
};

/** Medora's block rules: everyone signed in reads them; platform staff add them (CAT2). No tenant header. */
export const blockRulesApi = {
  list: async () => (await request<{ rules: BlockRule[] }>("/block-rules")).rules,
  add: (input: BlockRuleInput) => request<BlockRule>("/platform/block-rules", { method: "POST", body: input }),
};
