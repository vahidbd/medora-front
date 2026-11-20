"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * The topbar's last crumb. The shell knows the section from the URL
 * ("Staff"); a record page knows the record's name and sets it here, so
 * the crumbs read "Staff / <name>".
 */
type Ctx = { label: string | null; setLabel: (label: string | null) => void };

const BreadcrumbContext = createContext<Ctx>({ label: null, setLabel: () => {} });

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  return <BreadcrumbContext.Provider value={{ label, setLabel }}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbLabel(): string | null {
  return useContext(BreadcrumbContext).label;
}

/** Name the current record in the topbar crumbs. Cleared when the page unmounts. */
export function useBreadcrumb(label: string | null | undefined) {
  const { setLabel } = useContext(BreadcrumbContext);
  useEffect(() => {
    setLabel(label ?? null);
    return () => setLabel(null);
  }, [label, setLabel]);
}
