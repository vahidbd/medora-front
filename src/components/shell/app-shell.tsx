"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown, LogOut, Menu, Monitor, Moon, PanelLeft, Search, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useClerk, useUser } from "@clerk/nextjs";
import { navigation, navFor, isItemActive, type NavGroup, type NavItem } from "@/config/navigation";
import { useTenant } from "@/components/shell/tenant-context";
import { useCanSee } from "@/components/shell/use-can-see";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { formatDate, formatDateTime } from "@/lib/format";
import { roleName } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { CommandBar } from "@/components/shell/command-bar";
import { BreadcrumbProvider, useBreadcrumbLabel } from "@/components/shell/breadcrumb-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrandMark } from "./brand-mark";
import { BreakGlassControl } from "./break-glass";
import "@/styles/sections/navigation.css";

/**
 * The Grid UI kit's app shell (grid-kit.css: .app, .sidebar, .main, .topbar).
 *
 * Three columns on the warm canvas: the sidebar (256 wide, 68 minimised, or
 * 68 + a group's 232px second rail), then the main panel, one rounded card
 * with 10px of canvas around it. The page scrolls inside the panel and the
 * topbar stays put. Below 760px the sidebar becomes a drawer.
 */

const MODE_KEY = "medora:shell:mode";
const RAIL_KEY = "medora:shell:rail";

type Mode = "wide" | "narrow";

function readStored<T extends string>(key: string, fallback: T): T {
  try {
    return (window.localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the shell still works, it just forgets */
  }
}

/**
 * Whether a click came from the keyboard. Enter and Space report no presses
 * (detail 0); a mouse click or a tap reports one or more. The shell moves
 * focus for keyboard users only: moving it after a click parks it on a row
 * nobody chose, and the next key press (even Shift) rings that row.
 */
function fromKeyboard(e: { detail: number }): boolean {
  return e.detail === 0;
}

/** Below 760 the sidebar is a drawer (grid-kit.css "Narrow windows"). */
const PHONE_QUERY = "(max-width: 760px)";

function subscribePhone(onChange: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <BreadcrumbProvider>
      <Shell>{children}</Shell>
    </BreadcrumbProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const canSee = useCanSee();

  const groups = useMemo(
    () =>
      navigation
        .map((g) => ({ ...g, items: g.items.filter(canSee) }))
        .filter((g) => g.items.length > 0),
    [canSee],
  );

  const [mode, setModeState] = useState<Mode>(() =>
    typeof window === "undefined" ? "wide" : readStored<Mode>(MODE_KEY, "wide"),
  );
  // An open rail follows the route on load too, so a rail remembered from
  // another group (or from where an entry used to live) never hides where you are.
  const [rail, setRailState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = readStored<string>(RAIL_KEY, "") || null;
    const routeGroup = navFor(pathname)?.group;
    return stored && routeGroup && !routeGroup.topLevel ? routeGroup.label : stored;
  });
  // Whether opening the rail (or the phone drawer) should move focus into it:
  // only when it was opened from the keyboard, never on load or on a click.
  const [railFocus, setRailFocus] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneFocus, setPhoneFocus] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);

  const setMode = (m: Mode) => {
    setModeState(m);
    writeStored(MODE_KEY, m);
  };
  const setRail = (label: string | null) => {
    setRailState(label);
    writeStored(RAIL_KEY, label);
  };
  const openRail = (label: string, byKeyboard: boolean) => {
    setRail(label);
    setRailFocus(byKeyboard);
  };

  // A route in another group moves an open rail to that group, so the rail
  // always lists where you are.
  const current = navFor(pathname);
  const routeGroup = current?.group;
  const [railPath, setRailPath] = useState(pathname);
  if (railPath !== pathname) {
    setRailPath(pathname);
    setPhoneOpen(false);
    if (rail && routeGroup && !routeGroup.topLevel && routeGroup.label !== rail) {
      setRailState(routeGroup.label);
      setRailFocus(false);
    }
  }

  const railGroup = rail ? groups.find((g) => g.label === rail && !g.topLevel) : undefined;
  // On a phone the sidebar is a drawer: always the full list, never icons only.
  const isPhone = useIsPhone();
  const narrow = mode === "narrow" && !isPhone;
  const columns = railGroup ? "rail-open" : narrow ? "is-narrow" : "";

  // The phone drawer: Escape, the scrim and its close button shut it and put
  // focus back on the menu button; while it is open the page behind is inert,
  // and while it is shut its links are out of the tab order.
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const drawerOpen = isPhone && phoneOpen;
  const closePhone = useCallback(() => {
    setPhoneOpen(false);
    menuButtonRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!drawerOpen) return;
    // From the keyboard, straight to the screen you are on; after a tap, onto
    // the drawer itself, so Tab starts inside it without ringing a row.
    const first = phoneFocus
      ? sidebarRef.current?.querySelector<HTMLElement>(".sb-item.active, .sb-item.is-open, .sb-item")
      : sidebarRef.current;
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) closePhone();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, phoneFocus, closePhone]);
  // Closing a rail from the keyboard puts focus back on its group's row,
  // wherever that row is now (the icon column or the full-width sidebar).
  const closeRail = (label: string, byKeyboard: boolean) => {
    setRail(null);
    if (!byKeyboard) return;
    window.requestAnimationFrame(() => {
      sidebarRef.current?.querySelector<HTMLElement>(`[data-group="${CSS.escape(label)}"]`)?.focus({ preventScroll: true });
    });
  };
  const openSearch = () => {
    setPhoneOpen(false);
    setCmdkOpen(true);
  };

  return (
    <div className={cn("app", columns, drawerOpen && "phone-nav-open")}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside
        className="sidebar"
        aria-label="Main navigation"
        ref={sidebarRef}
        inert={isPhone && !phoneOpen}
        tabIndex={drawerOpen ? -1 : undefined}
      >
        {railGroup ? (
          <>
            <NarrowColumn
              groups={groups}
              pathname={pathname}
              activeGroup={routeGroup?.label}
              openGroup={railGroup.label}
              onGroup={(g, byKeyboard) => (g.label === railGroup.label ? closeRail(g.label, byKeyboard) : openRail(g.label, byKeyboard))}
              onSearch={openSearch}
              onExpand={() => {
                setRail(null);
                setMode("wide");
              }}
            />
            <SecondRail
              group={railGroup}
              pathname={pathname}
              takeFocus={railFocus}
              onClose={(byKeyboard) => closeRail(railGroup.label, byKeyboard)}
            />
          </>
        ) : narrow ? (
          <NarrowColumn
            groups={groups}
            pathname={pathname}
            activeGroup={routeGroup?.label}
            onGroup={(g, byKeyboard) => openRail(g.label, byKeyboard)}
            onSearch={openSearch}
            onExpand={(byKeyboard) => {
              setMode("wide");
              if (!byKeyboard) return;
              window.requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLElement>(".sb-collapse")?.focus({ preventScroll: true }));
            }}
          />
        ) : (
          <WideColumn
            groups={groups}
            pathname={pathname}
            activeGroup={routeGroup?.label}
            onGroup={(g, byKeyboard) => openRail(g.label, byKeyboard)}
            onSearch={openSearch}
            onCollapse={(byKeyboard) => {
              setMode("narrow");
              if (!byKeyboard) return;
              window.requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLElement>(".sb-logo-btn")?.focus({ preventScroll: true }));
            }}
            onPhoneClose={closePhone}
          />
        )}
      </aside>
      <div className="phone-scrim" onClick={closePhone} aria-hidden />

      <MainPanel
        onPhoneMenu={(byKeyboard) => {
          setPhoneFocus(byKeyboard);
          setPhoneOpen(true);
        }}
        menuButtonRef={menuButtonRef}
        inert={drawerOpen}
        current={current}
      >
        {children}
      </MainPanel>

      <CommandBar open={cmdkOpen} onOpenChange={setCmdkOpen} groups={groups} />
    </div>
  );
}

/* ---------------- Sidebar: full width ---------------- */

function WideColumn({
  groups,
  pathname,
  activeGroup,
  onGroup,
  onSearch,
  onCollapse,
  onPhoneClose,
}: {
  groups: NavGroup[];
  pathname: string;
  activeGroup?: string;
  onGroup: (g: NavGroup, byKeyboard: boolean) => void;
  onSearch: () => void;
  onCollapse: (byKeyboard: boolean) => void;
  onPhoneClose: () => void;
}) {
  return (
    <div className="sb-wide">
      <div className="sb-brand">
        <TenantSwitch />
        <IconTip label="Minimise sidebar">
          <button type="button" className="btn-icon bare is-sm sb-collapse" onClick={(e) => onCollapse(fromKeyboard(e))} aria-label="Minimise sidebar">
            <PanelLeft />
          </button>
        </IconTip>
        <button type="button" className="btn-icon bare is-sm sb-phone-close" onClick={onPhoneClose} aria-label="Close menu">
          <X />
        </button>
      </div>

      <button type="button" className="sb-search" onClick={onSearch}>
        <Search className="size-[15px]" />
        Search
        <span className="kbd">⌘K</span>
      </button>

      <nav className="sb-nav" aria-label="Sections">
        {groups.map((group, i) => {
          const gap = i > 0 && group.gapBefore ? <div className="sb-gap" aria-hidden /> : null;
          return group.topLevel ? (
            <Fragment key={group.label}>
              {gap}
              {group.items.map((item) => (
                <NavRow key={item.href} item={item} pathname={pathname} />
              ))}
            </Fragment>
          ) : (
            <Fragment key={group.label}>
              {gap}
              <button
                type="button"
                className={cn("sb-item", activeGroup === group.label && "active")}
                onClick={(e) => onGroup(group, fromKeyboard(e))}
                aria-haspopup="true"
                data-group={group.label}
              >
                <group.icon />
                {group.label}
                <ChevronRight className="chev" />
              </button>
            </Fragment>
          );
        })}
      </nav>

      <div className="sb-foot">
        <AccountMenu />
      </div>
    </div>
  );
}

function NavRow({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isItemActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link href={item.href} className={cn("sb-item", active && "active")} aria-current={active ? "page" : undefined}>
      <Icon />
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
    </Link>
  );
}

/* ---------------- Sidebar: icons only (68) ---------------- */

function NarrowColumn({
  groups,
  pathname,
  activeGroup,
  openGroup,
  onGroup,
  onSearch,
  onExpand,
}: {
  groups: NavGroup[];
  pathname: string;
  /** The group of the screen you are on. */
  activeGroup?: string;
  /** The group whose second rail is open beside the icons. */
  openGroup?: string;
  onGroup: (g: NavGroup, byKeyboard: boolean) => void;
  onSearch: () => void;
  onExpand: (byKeyboard: boolean) => void;
}) {
  return (
    <div className="sb-narrow">
      <IconTip label="Expand sidebar" side="right">
        <button type="button" className="sb-logo-btn" onClick={(e) => onExpand(fromKeyboard(e))} aria-label="Expand sidebar">
          <BrandMark />
        </button>
      </IconTip>
      <IconTip label="Search" hint="⌘K" side="right">
        <button type="button" className="sb-item" onClick={onSearch} aria-label="Search">
          <Search />
        </button>
      </IconTip>
      <nav className="sb-nav" aria-label="Sections">
        {groups.map((group, i) => {
          const gap = i > 0 && group.gapBefore ? <div className="sb-gap" aria-hidden /> : null;
          return group.topLevel ? (
            <Fragment key={group.label}>
              {gap}
              {group.items.map((item) => {
                  const active = isItemActive(item, pathname);
                  const Icon = item.icon;
                  return (
                    <IconTip key={item.href} label={item.title} side="right">
                      <Link
                        href={item.href}
                        className={cn("sb-item", active && "active")}
                        aria-label={item.title}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon />
                      </Link>
                    </IconTip>
                  );
                })}
            </Fragment>
          ) : (
            <Fragment key={group.label}>
              {gap}
              <IconTip label={group.label} side="right">
                <button
                  type="button"
                  className={cn(
                    "sb-item",
                    openGroup === group.label ? "is-open" : activeGroup === group.label && "active",
                  )}
                  onClick={(e) => onGroup(group, fromKeyboard(e))}
                  aria-label={group.label}
                  aria-expanded={openGroup === group.label}
                  data-group={group.label}
                >
                  <group.icon />
                </button>
              </IconTip>
            </Fragment>
          );
        })}
      </nav>
    </div>
  );
}

/* ---------------- A group's second rail (232) ---------------- */

function SecondRail({
  group,
  pathname,
  takeFocus,
  onClose,
}: {
  group: NavGroup;
  pathname: string;
  /** Opened from the keyboard: move focus into the rail. */
  takeFocus: boolean;
  onClose: (byKeyboard: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Opening a group from the keyboard moves focus into its rail (the button
  // that opened it may be gone), to the screen you are on or else the first
  // entry. A click, or a page that loads with a rail open, leaves focus be.
  // Escape closes the rail.
  useEffect(() => {
    const panel = ref.current;
    if (!panel || !takeFocus) return;
    if (panel.contains(document.activeElement)) return;
    const opener = document.activeElement;
    if (opener && opener !== document.body && !opener.closest(".sidebar")) return;
    panel.querySelector<HTMLElement>(".sb-nav .sb-item.active, .sb-nav .sb-item")?.focus({ preventScroll: true });
  }, [group.label, takeFocus]);
  return (
    <div
      className="sb-panel"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.preventDefault();
          onClose(true);
        }
      }}
    >
      <div className="sb-panel-head">
        <span className="sb-panel-title flex-1">{group.label}</span>
        <IconTip label="Close">
          <button type="button" className="btn-icon bare is-sm" onClick={(e) => onClose(fromKeyboard(e))} aria-label={`Close ${group.label}`}>
            <X />
          </button>
        </IconTip>
      </div>
      <nav className="sb-nav" aria-label={group.label}>
        {group.items.map((item) => (
          <NavRow key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </div>
  );
}

/* ---------------- Brand row: tenant switch ---------------- */

/**
 * The workspace menu at the top of the sidebar: which tenant the console
 * is working in. With one tenant it only names it.
 */
function TenantSwitch() {
  const { memberships, current, setTenant } = useTenant();
  const label = (
    <>
      <BrandMark />
      <span className="sb-brand-text">
        <span className="sb-name">Medora</span>
        <span className="sb-brand-sub">{current.tenantName}</span>
      </span>
    </>
  );
  if (memberships.length < 2) return <div className="sb-brand-btn">{label}</div>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className="sb-brand-btn" aria-label={`Working in ${current.tenantName}. Change tenant`}>
            {label}
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-[264px]">
        <DropdownMenuLabel>Work in</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current.tenantId} onValueChange={(value) => setTenant(String(value))} aria-label="Work in">
          {memberships.map((membership) => (
            <DropdownMenuRadioItem key={membership.tenantId} value={membership.tenantId} closeOnClick>
              <span className="menu-label">{membership.tenantName}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------- Account ---------------- */

function AccountMenu() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const { current } = useTenant();
  const { theme, setTheme } = useTheme();
  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Signed in";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className="sb-account">
            <InitialsAvatar name={name} size={32} />
            <span className="min-w-0 flex-1">
              <span className="sb-account-name block">{name}</span>
              <span className="sb-account-sub block">{roleName(current)}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="start" side="top" className="w-[232px]">
        <DropdownMenuLabel>
          <span className="block truncate text-foreground">{user?.fullName}</span>
          <span className="block truncate font-normal">{user?.primaryEmailAddress?.emailAddress}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(value) => setTheme(String(value))} aria-label="Theme">
          {(
            [
              ["system", "System", Monitor],
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
            ] as const
          ).map(([value, label, Icon]) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              <span className="menu-label">{label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut({ redirectUrl: "/sign-in" })}>
          <LogOut />
          <span className="menu-label">Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------- Main panel and topbar ---------------- */

function MainPanel({
  children,
  current,
  onPhoneMenu,
  menuButtonRef,
  inert,
}: {
  children: React.ReactNode;
  current: ReturnType<typeof navFor>;
  onPhoneMenu: (byKeyboard: boolean) => void;
  menuButtonRef: React.Ref<HTMLButtonElement>;
  /** True while the phone drawer covers the panel. */
  inert: boolean;
}) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const recordLabel = useBreadcrumbLabel();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 2);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // A new screen starts at the top, unless its address names a section
  // (#fees): then the page itself scrolls to it.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && document.getElementById(decodeURIComponent(id))) return;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  const item = current?.item;
  const base = item?.href ?? "";
  const deeper = item ? pathname !== base : false;
  const tail = deeper ? (recordLabel ?? tailFromPath(pathname, base)) : null;
  const Icon = item?.icon;
  const crumb = item ? (item.crumb ?? item.title) : null;

  // The browser tab names the screen: "<record> · Staff · Medora".
  const docTitle = [tail, crumb, "Medora"].filter(Boolean).join(" · ");
  useEffect(() => {
    document.title = docTitle;
  }, [docTitle]);

  return (
    <div className={cn("main", scrolled && "is-scrolled")} inert={inert}>
      <header className="topbar">
        <button
          type="button"
          ref={menuButtonRef}
          className="btn-icon bare phone-menu"
          onClick={(e) => onPhoneMenu(fromKeyboard(e))}
          aria-label="Open menu"
        >
          <Menu />
        </button>
        <nav className={cn("crumbs", item && deeper && "is-deep")} aria-label="Breadcrumb">
          {Icon ? <Icon className="crumb-icon" strokeWidth={1.7} aria-hidden /> : null}
          {item ? (
            deeper ? (
              <>
                {/* On phones only this link shows, as the way back: the page
                    header below already names the page. */}
                <Link href={base} className="crumb-parent">
                  <ChevronLeft className="crumb-back" strokeWidth={1.7} aria-hidden />
                  {crumb}
                </Link>
                <span className="sep" aria-hidden>
                  /
                </span>
                <span className="current" title={tail ?? undefined} aria-current="page">
                  {tail}
                </span>
              </>
            ) : (
              <span className="current" aria-current="page">
                {crumb}
              </span>
            )
          ) : (
            <span className="current" aria-current="page">
              Medora
            </span>
          )}
        </nav>
        <div className="topbar-actions">
          <BreakGlassControl />
          <Clock />
        </div>
      </header>
      <div className="main-scroll" ref={scrollRef}>
        <main className="page" key={pathname} id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

const SEGMENT_LABELS: Record<string, string> = {
  new: "New",
  edit: "Edit",
};

function tailFromPath(pathname: string, base: string): string {
  const rest = (pathname.startsWith(base) ? pathname.slice(base.length) : pathname).split("/").filter(Boolean);
  const last = rest[rest.length - 1] ?? "";
  if (SEGMENT_LABELS[last]) return SEGMENT_LABELS[last];
  return last.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** The topbar's date and 24-hour time in the viewer's time zone, as the kit shows it. */
function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = window.setInterval(tick, 15_000);
    return () => window.clearInterval(t);
  }, []);
  if (!now) return <span className="topbar-time" />;
  const date = formatDate(now);
  const time = formatDateTime(now).slice(-5);
  return (
    <time className="topbar-time" dateTime={now.toISOString()} suppressHydrationWarning>
      {date} · {time}
    </time>
  );
}

/* ---------------- Tooltips ---------------- */

function IconTip({
  label,
  hint,
  side = "bottom",
  children,
}: {
  label: string;
  hint?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>
        {label}
        {hint ? <span className="ml-1.5 text-[var(--inverse-muted)]">{hint}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
