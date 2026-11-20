"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { meApi } from "@/lib/api/staff";
import type { Membership, Permission } from "@/lib/api/types";
import { isUsable } from "@/lib/staff-access";

/**
 * The tenant the console is working in. A staff member can belong to more
 * than one; every call that acts in a tenant names it (the API's FND1), so
 * the choice lives here and is remembered in this browser. Only active
 * memberships that haven't reached their end date can be chosen.
 */
type TenantContextValue = {
  /** The person's active memberships, one per tenant. */
  memberships: Membership[];
  /** The membership in the tenant being worked in. */
  current: Membership;
  setTenant: (tenantId: string) => void;
  can: (permission: Permission) => boolean;
};

/** As above, except that platform staff with no tenant of their own have none (docs/decisions/admin.md ADM15). */
type ShellValue = Omit<TenantContextValue, "current"> & { current: Membership | null; platformStaff: boolean };

const TenantContext = createContext<ShellValue | null>(null);
const STORAGE_KEY = "medora:tenant";

function stored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  // AuthGate has loaded it before this renders.
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: meApi.get, enabled: false });
  const memberships = useMemo(() => (me?.memberships ?? []).filter((m) => isUsable(m)), [me]);
  const [chosen, setChosen] = useState<string | null>(() => (typeof window === "undefined" ? null : stored()));

  const current = memberships.find((m) => m.tenantId === chosen) ?? memberships[0];

  const setTenant = useCallback(
    (tenantId: string) => {
      setChosen(tenantId);
      try {
        window.localStorage.setItem(STORAGE_KEY, tenantId);
      } catch {
        /* storage unavailable: the choice lasts until the page reloads */
      }
      // Another tenant's data must never show under this one's name.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
    },
    [queryClient],
  );

  const platformStaff = me?.platformStaff === true;
  const value = useMemo<ShellValue | null>(
    () =>
      current || platformStaff
        ? {
            memberships,
            current: current ?? null,
            setTenant,
            can: (permission: Permission) => current?.permissions.includes(permission) === true,
            platformStaff,
          }
        : null,
    [memberships, current, setTenant, platformStaff],
  );

  // AuthGate shows its own screen when there is no active membership and the person isn't platform staff.
  if (!value) return null;
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

/** The tenant a screen works in. Only screens inside a tenant call it; the shell keeps platform staff with no tenant on their own screens. */
export function useTenant(): TenantContextValue {
  const value = useContext(TenantContext);
  if (!value) throw new Error("useTenant must be used inside TenantProvider");
  if (!value.current) throw new Error("useTenant needs a tenant, and platform staff with none have no tenant screens");
  return { ...value, current: value.current };
}

/** For the shell and the platform screens: the tenant if there is one, and whether the person is platform staff. */
export function useShellTenant(): ShellValue {
  const value = useContext(TenantContext);
  if (!value) throw new Error("useShellTenant must be used inside TenantProvider");
  return value;
}
