"use client";

import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { useShellTenant } from "@/components/shell/tenant-context";

/**
 * Platform screens are for Medora's own platform staff (docs/decisions/admin.md
 * ADM15). Anyone else who opens one by its address sees why it is empty;
 * the API refuses them anyway.
 */
export function PlatformOnly({ children }: { children: React.ReactNode }) {
  const { platformStaff } = useShellTenant();
  if (platformStaff) return <>{children}</>;
  return (
    <EmptyState
      icon={Building2}
      title="For Medora's platform staff"
      description="These screens create tenants, verify brands' domains and block products for every tenant. Your account isn't platform staff."
    />
  );
}
