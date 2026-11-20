"use client";

import { useCallback } from "react";
import { useTenant } from "@/components/shell/tenant-context";
import type { Permission } from "@/lib/api/types";

/**
 * Whether the staff member may see a nav entry, in the tenant they are
 * working in. Hiding is a courtesy: the API checks every call itself.
 */
export function useCanSee() {
  const { can } = useTenant();
  return useCallback((entry: { permission?: Permission }) => !entry.permission || can(entry.permission), [can]);
}
