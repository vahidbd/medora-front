"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isPatientNavActive, patientNavigation } from "@/config/patient-navigation";
import { cn } from "@/lib/utils";
import { useBrand } from "./brand-context";
import { useIdleSignOut, usePatientSignOut } from "./sign-out";
import { useAppOpened } from "./use-app-opened";
import "@/styles/sections/patient.css";

/**
 * The signed-in patient app's frame: the brand row with the account menu,
 * the areas as tabs (a bottom bar on a phone), then the page. The brand's
 * name is its mark until logos are served from this app's own origin (APP4).
 */
export function PatientShell({ name, children }: { name: string; children: React.ReactNode }) {
  useIdleSignOut();
  useAppOpened();
  const pathname = usePathname();
  return (
    <div className="pt">
      <header className="pt-top">
        <div className="pt-top-in">
          <BrandRow />
          <AccountMenu name={name} />
        </div>
      </header>
      <div className="pt-nav">
        <nav className="pt-nav-in" aria-label="Your care">
          <div className="tabs-underline">
            {patientNavigation.map((item) => {
              const active = isPatientNavActive(item, pathname);
              return (
                <Link key={item.key} href={item.href} className={cn("tab-u", active && "active")} aria-current={active ? "page" : undefined}>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      <main className="pt-main" id="main">
        {children}
      </main>
      <nav className="pt-bar" aria-label="Your care">
        {patientNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.key} href={item.href} aria-current={isPatientNavActive(item, pathname) ? "page" : undefined}>
              <Icon aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function BrandRow() {
  const brand = useBrand();
  return (
    <Link href="/home" className="pt-brand">
      <span className="pt-brand-mark" aria-hidden>
        {brand.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="pt-brand-name">{brand.name}</span>
    </Link>
  );
}

function AccountMenu({ name }: { name: string }) {
  const signOut = usePatientSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" aria-label="Your account">
            <CircleUserRound aria-hidden />
            <span className="pt-account-label">{name}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href="/account" />}>
          <UserRound aria-hidden />
          <span className="menu-label">Your account</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut aria-hidden />
          <span className="menu-label">Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
