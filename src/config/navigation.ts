import type { LucideIcon } from "lucide-react";
import { Building2, Globe, House, Landmark, Settings, ShieldAlert, ShieldCheck, Store, UsersRound } from "lucide-react";
import type { Permission } from "@/lib/api/types";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Shown only to a staff member whose role holds this permission in the current tenant. */
  permission?: Permission;
  /** Shown only to platform staff, who may have no tenant (docs/decisions/admin.md ADM15). */
  platform?: boolean;
  /** The topbar crumb, when it should differ from the sidebar title. */
  crumb?: string;
  /** Other words that find it in ⌘K. */
  keywords?: string[];
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  /** Top-level rows: shown as plain sidebar rows, not a group with a second rail. */
  topLevel?: boolean;
  /** A gap above this group in the sidebar: it starts a new block. */
  gapBefore?: boolean;
};

/**
 * The staff console's sidebar, in the Grid UI kit's two layers (DESIGN.md,
 * "The shell"): Home on its own; then the work areas, each a group that
 * opens its own 232px second rail; then Workspace, set apart at the end.
 *
 * A screen is added here in the same pull request that builds it. Nothing
 * is listed before it exists: an entry that leads nowhere is a broken
 * promise, not a plan.
 */
export const navigation: NavGroup[] = [
  {
    label: "Home",
    icon: House,
    topLevel: true,
    items: [{ title: "Home", href: "/home", icon: House }],
  },
  {
    label: "Workspace",
    icon: Settings,
    gapBefore: true,
    items: [
      { title: "Staff", href: "/staff", icon: UsersRound, permission: "staff:read", keywords: ["Members", "Team", "Invite"] },
      { title: "Roles", href: "/roles", icon: ShieldCheck, permission: "staff:read", keywords: ["Permissions"] },
      { title: "Break-glass", href: "/break-glass", icon: ShieldAlert, permission: "break_glass:review", keywords: ["Reviews"] },
      { title: "Brands", href: "/brands", icon: Store, keywords: ["Domains", "Go live", "Pause"] },
      { title: "Companies", href: "/companies", icon: Landmark, keywords: ["ABN", "Legal entity"] },
      { title: "Settings", href: "/settings", icon: Settings, keywords: ["Time zone", "Onboarding", "Tenant name"] },
    ],
  },
  {
    label: "Platform",
    icon: Building2,
    gapBefore: true,
    items: [
      { title: "Tenants", href: "/platform/tenants", icon: Building2, platform: true, keywords: ["New tenant", "Owner invitation"] },
      { title: "Domains", href: "/platform/domains", icon: Globe, platform: true, crumb: "Domains to verify", keywords: ["Verify", "DNS"] },
    ],
  },
];

const prefixOf = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Nav group and item for a pathname (the longest href prefix wins). */
export function navFor(pathname: string): { group: NavGroup; item: NavItem } | undefined {
  let best: { group: NavGroup; item: NavItem } | undefined;
  let bestLength = 0;
  for (const group of navigation) {
    for (const item of group.items) {
      if (prefixOf(pathname, item.href) && item.href.length > bestLength) {
        best = { group, item };
        bestLength = item.href.length;
      }
    }
  }
  return best;
}

/** Whether a sidebar row is the screen you are on, or one of its sub-screens. */
export function isItemActive(item: NavItem, pathname: string): boolean {
  return navFor(pathname)?.item.href === item.href;
}
