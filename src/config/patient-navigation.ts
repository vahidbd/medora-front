import { House, UserRound, type LucideIcon } from "lucide-react";

/**
 * The patient app's areas, in order (docs/decisions/patient-app.md APP6):
 * underline tabs under the brand row on a wide screen, a bar along the
 * bottom on a phone. An area is listed only once its screens exist; the
 * patient's own records need no permission check beyond being theirs,
 * which the API enforces.
 */
export interface PatientNavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export const patientNavigation: readonly PatientNavItem[] = [
  { key: "home", label: "Home", href: "/home", icon: House },
  { key: "account", label: "Account", href: "/account", icon: UserRound },
];

export function isPatientNavActive(item: PatientNavItem, pathname: string): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
