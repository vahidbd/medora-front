"use client";

import Link from "next/link";
import { MoreHorizontal, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ActionItem = {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
};

/**
 * The Grid UI kit's page header (grid-kit.css: .page-head). One title per
 * screen at 30/600, one short description under it (60 characters at most,
 * no counts, no explainer box), and the actions on the description's
 * baseline: the one primary action, then "⋯".

 */
export function PageHeader({
  title,
  titleAside,
  description,
  primaryAction,
  moreActions,
  children,
}: {
  title: string;
  /** Something that sits beside the title on its line (a picker). */
  titleAside?: React.ReactNode;
  description?: string;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ElementType | null;
    /** While the action runs (a button only). */
    disabled?: boolean;
  };
  /** Secondary page actions, shown in the "⋯" menu. Destructive ones go last. */
  moreActions?: ActionItem[];
  /** Extra header actions (outline buttons), placed before the primary action. */
  children?: React.ReactNode;
}) {
  const Icon = primaryAction?.icon === undefined ? Plus : primaryAction.icon;
  return (
    <>
      <div className="page-head">
        <div>
          {titleAside ? (
            <div className="page-title-row">
              <h1 className="page-title">{title}</h1>
              {titleAside}
            </div>
          ) : (
            <h1 className="page-title">{title}</h1>
          )}
          {description ? <p className="page-sub">{description}</p> : null}
        </div>
        {children || primaryAction || moreActions?.length ? (
          <div className="page-actions">
            {children}
            {primaryAction ? (
              primaryAction.href ? (
                <Link href={primaryAction.href} className="btn btn-primary">
                  {Icon ? <Icon /> : null}
                  {primaryAction.label}
                </Link>
              ) : (
                <Button onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                  {Icon ? <Icon /> : null}
                  {primaryAction.label}
                </Button>
              )
            ) : null}
            {moreActions?.length ? <MoreMenu items={moreActions} /> : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

/** The "⋯" menu beside a primary action. Destructive items last, after a separator. */
export function MoreMenu({
  items,
  label = "More actions",
  size = "icon-lg",
}: {
  items: ActionItem[];
  label?: string;
  size?: "icon" | "icon-lg" | "icon-sm";
}) {
  const safe = items.filter((i) => !i.destructive);
  const destructive = items.filter((i) => i.destructive);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size={size} aria-label={label} title={label}>
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {safe.map((item) => {
          const ItemIcon = item.icon;
          return (
            <DropdownMenuItem key={item.label} onClick={item.onSelect}>
              {ItemIcon ? <ItemIcon /> : null}
              <span className="menu-label">{item.label}</span>
            </DropdownMenuItem>
          );
        })}
        {destructive.length > 0 ? (
          <>
            {safe.length > 0 ? <DropdownMenuSeparator /> : null}
            {destructive.map((item) => {
              const ItemIcon = item.icon;
              return (
                <DropdownMenuItem key={item.label} variant="destructive" onClick={item.onSelect}>
                  {ItemIcon ? <ItemIcon /> : null}
                  <span className="menu-label">{item.label}</span>
                </DropdownMenuItem>
              );
            })}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
