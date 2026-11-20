import type { StatusTone } from "@/components/shared/status-badge";
import type { BlockRule, BlockRuleMatch, Product, ProductKind, Storage } from "@/lib/api/types";

/** Words for the catalogue and Medora's block rules (docs/decisions/catalogue.md CAT1 to CAT5). */

export const KIND_LABELS: Record<ProductKind, string> = {
  medicine: "Medicine",
  device: "Device",
  service: "Service",
};

export const STORAGE_LABELS: Record<Storage, string> = {
  room: "Room temperature",
  refrigerated: "Refrigerated",
};

export const MATCH_LABELS: Record<BlockRuleMatch, string> = {
  schedule: "Schedule",
  artg_number: "ARTG number",
  compounded: "Compounded medicines",
};

/** What a rule blocks, in a few words: "Schedule 8 medicines", "ARTG 123456", "Compounded medicines". */
export function ruleTarget(rule: Pick<BlockRule, "match" | "value">): string {
  if (rule.match === "schedule") return `Schedule ${rule.value?.replace(/^S/, "") ?? ""} medicines`;
  if (rule.match === "artg_number") return `ARTG ${rule.value ?? ""}`;
  return MATCH_LABELS.compounded;
}

/** A product's state on the list: archived, blocked by Medora, blocked by the tenant, or active. */
export function productStatus(product: Pick<Product, "status" | "blocked">): { label: string; tone: StatusTone } {
  if (product.status === "archived") return { label: "Archived", tone: "neutral" };
  if (product.blocked?.code === "platform_rule") return { label: "Blocked by Medora", tone: "danger" };
  if (product.blocked?.code === "tenant_block") return { label: "Blocked", tone: "warning" };
  return { label: "Active", tone: "success" };
}

/** "S4 · ARTG 123456 · Tablet · 30" style details, without the separators a screen reader would read out. */
export function productDetails(
  product: Pick<Product, "schedule" | "artgNumber" | "compounded" | "strength" | "form" | "packSize">,
): string[] {
  return [
    product.schedule,
    product.compounded ? "Compounded" : null,
    product.artgNumber ? `ARTG ${product.artgNumber}` : null,
    product.strength,
    product.form,
    product.packSize ? `Pack of ${product.packSize}` : null,
  ].filter((part): part is string => Boolean(part));
}
