"use client";

import { useCallback } from "react";
import { useShellTenant } from "@/components/shell/tenant-context";
import type { Permission } from "@/lib/api/types";

/**
 * Whether the staff member may see a nav entry, in the tenant they are
 * working in. Platform entries are for platform staff only, and platform
 * staff with no tenant see nothing else. Hiding is a courtesy: the API
 * checks every call itself.
 */
export function useCanSee() {
  const { can, current, platformStaff } = useShellTenant();
  return useCallback(
    (entry: { permission?: Permission; platform?: boolean }) => {
      if (entry.platform) return platformStaff;
      if (!current) return false;
      return !entry.permission || can(entry.permission);
    },
    [can, current, platformStaff],
  );
}
