"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { CornerDownLeft, Search } from "lucide-react";
import type { NavGroup } from "@/config/navigation";

/**
 * How well a row answers what was typed: a screen whose name, or a word in
 * it, starts with the text first; the text anywhere in the name next; a
 * keyword (another word people use for it) last.
 */
function filterItems(value: string, search: string, keywords?: string[]): number {
  const needle = search.trim().toLowerCase();
  if (!needle) return 1;
  const hay = value.toLowerCase();
  if (hay.startsWith(needle) || hay.includes(` ${needle}`)) return 1;
  if (hay.includes(needle)) return 0.6;
  return keywords?.some((k) => k.toLowerCase().startsWith(needle)) ? 0.3 : 0;
}

/**
 * The Grid UI kit's ⌘K command bar: 640 wide, 12% down the window, a 56px
 * input, 42px rows with a 28px icon tile, and a foot of key hints. It goes
 * to any screen the staff member can see. Record search joins it with the
 * first records.
 */
export function CommandBar({ open, onOpenChange, groups }: { open: boolean; onOpenChange: (open: boolean) => void; groups: NavGroup[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // The input takes focus as the bar opens, and focus goes back where it was when it closes.
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => {
      setQuery("");
      const el = returnFocus.current;
      if (el?.isConnected) el.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <div
      className="cmdk-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Command bar"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      onKeyDown={(e) => {
        // The input is the bar's only stop; Tab never leaves for the page behind.
        if (e.key === "Tab") e.preventDefault();
      }}
    >
      <Command className="cmdk" label="Go to a screen" loop filter={filterItems}>
        <div className="cmdk-input">
          <Search className="size-[18px] shrink-0" />
          <Command.Input ref={inputRef} value={query} onValueChange={setQuery} placeholder="Go to a screen…" />
          <span className="kbd">esc</span>
        </div>
        <Command.List className="cmdk-list">
          <Command.Empty className="px-3 py-6 text-center text-ui text-muted-foreground">No screen matches that.</Command.Empty>
          {groups.map((group) => (
            <Command.Group key={group.label} heading={group.topLevel ? "Go to" : group.label} className="cmdk-group">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.href}
                    value={item.title}
                    keywords={[group.label, ...(item.keywords ?? [])]}
                    onSelect={() => go(item.href)}
                    className="cmdk-item"
                  >
                    <span className="cmdk-ico">
                      <Icon className="size-[15px]" strokeWidth={1.7} />
                    </span>
                    <span className="cmdk-label">{item.title}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
        <div className="cmdk-foot">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> to move
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="kbd">
              <CornerDownLeft className="size-3" />
            </span>{" "}
            to open
          </span>
          <span>
            <span className="kbd">esc</span> to close
          </span>
        </div>
      </Command>
    </div>
  );
}
