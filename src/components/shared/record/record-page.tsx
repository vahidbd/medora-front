"use client";

import { createContext, Fragment, useContext, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { useBreadcrumb } from "@/components/shell/breadcrumb-context";
import { prefersReducedMotion } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

/**
 * A record page in the kit's editor shape (DESIGN.md, "Record pages"): the
 * header (lead, title, status badge, a meta line, actions), then a numbered
 * rail beside stacked section cards. The rail sticks under the topbar,
 * follows the section in view and scrolls to a section when clicked. It
 * folds away on a phone and when the page is narrow (grid-record.css).
 */

export type RecordMetaItem = { key: string; label?: ReactNode; value: ReactNode; mono?: boolean; icon?: LucideIcon };
export type RecordSectionDef = { id: string; label: string; count?: number | string; attention?: string };

const SEP = "\u0000";
const two = (n: number) => String(n).padStart(2, "0");
const RecordPageContext = createContext<string | null>(null);

/** The element the page scrolls in: the shell's main panel, else the window. */
function scrollRootOf(el: Element | null): HTMLElement | null {
  return el?.closest<HTMLElement>(".main-scroll") ?? null;
}

/** The first section inside a band across the top of the scroll root is the one in view. */
function useScrollSpy(hostRef: RefObject<HTMLElement | null>, idsKey: string) {
  const [active, setActive] = useState<string | undefined>(() => idsKey.split(SEP)[0] || undefined);
  useEffect(() => {
    const host = hostRef.current;
    const order = idsKey ? idsKey.split(SEP) : [];
    if (!host || order.length === 0) return;
    const inBand = new Set<string>();
    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        const first = order.find((id) => inBand.has(id));
        if (first) setActive(first);
      },
      { root: scrollRootOf(host), rootMargin: "-48px 0px -55% 0px", threshold: 0 },
    );
    for (const id of order) {
      const el = host.querySelector(`#${CSS.escape(id)}`);
      if (el) spy.observe(el);
    }
    return () => spy.disconnect();
  }, [hostRef, idsKey]);

  const jump = (id: string) => {
    const el = hostRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!el) return;
    setActive(id);
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  };
  return { active, jump };
}

export function RecordPage({
  title,
  badge,
  avatarName,
  meta = [],
  actions,
  sections,
  children,
}: {
  title: string;
  badge?: { label: string; tone: StatusTone } | null;
  /** The person the record is about, for the avatar left of the title. */
  avatarName?: string;
  meta?: RecordMetaItem[];
  /** At most one primary, then outline buttons. */
  actions?: ReactNode;
  sections: RecordSectionDef[];
  /** RecordSection cards, in the same order as `sections`. */
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const idsKey = sections.map((s) => s.id).join(SEP);
  const { active, jump } = useScrollSpy(hostRef, idsKey);
  useBreadcrumb(title);

  return (
    <RecordPageContext.Provider value={idsKey}>
      <div ref={hostRef} className="record-page">
        <div className="editor-head">
          <div className={cn("left", avatarName && "with-lead")}>
            {avatarName ? (
              <div className="editor-lead">
                <InitialsAvatar name={avatarName} size={36} />
              </div>
            ) : null}
            <h1>
              <span className="editor-title">{title}</span>
              {badge ? (
                <span className="editor-badge">
                  <StatusBadge label={badge.label} tone={badge.tone} />
                </span>
              ) : null}
            </h1>
            {meta.length > 0 ? (
              <div className="meta">
                {meta.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <Fragment key={item.key}>
                      {i > 0 ? <span className="dot" aria-hidden /> : null}
                      <span className="meta-item">
                        {Icon ? <Icon aria-hidden /> : null}
                        {item.label != null ? <span>{item.label}</span> : null}
                        <span className={cn(item.mono && "mono")}>{item.value}</span>
                      </span>
                    </Fragment>
                  );
                })}
              </div>
            ) : null}
          </div>
          {actions ? <div className="editor-actions">{actions}</div> : null}
        </div>

        <div className="editor-shell">
          <nav className="editor-nav" aria-label="On this page">
            {sections.map((def, i) => {
              const isActive = def.id === active;
              return (
                <a
                  key={def.id}
                  href={`#${def.id}`}
                  className={cn("editor-nav-item", isActive && "active")}
                  aria-current={isActive ? "location" : undefined}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    jump(def.id);
                    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${def.id}`);
                  }}
                >
                  <span className="num">{two(i + 1)}</span>
                  <span className="label" title={def.label}>
                    {def.label}
                  </span>
                  {def.attention ? (
                    <>
                      <span className="dot-mark" title={def.attention} aria-hidden />
                      <span className="sr-only">{def.attention}</span>
                    </>
                  ) : def.count != null ? (
                    <span className="count">{def.count}</span>
                  ) : null}
                </a>
              );
            })}
          </nav>
          <div className="editor-content">
            {children}
            <div data-record-end aria-hidden />
          </div>
        </div>
      </div>
    </RecordPageContext.Provider>
  );
}

/** One numbered section card: number and title, one line under it, head actions, then the body. */
export function RecordSection({
  id,
  title,
  subtitle,
  actions,
  flush,
  children,
}: {
  id: string;
  title: string;
  subtitle?: ReactNode;
  /** Small buttons at the right of the head (Edit, Add). */
  actions?: ReactNode;
  /** No body padding, for a table that runs edge to edge. */
  flush?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  const ids = useContext(RecordPageContext);
  const index = ids ? ids.split(SEP).indexOf(id) : -1;
  return (
    <section id={id} aria-labelledby={headingId} className="card editor-section">
      <div className="card-head">
        <div className="titles">
          <h2 id={headingId}>
            {index >= 0 ? <span className="num">{two(index + 1)}</span> : null}
            {title}
          </h2>
          {subtitle ? <div className="sub">{subtitle}</div> : null}
        </div>
        {actions ? <div className="head-actions">{actions}</div> : null}
      </div>
      <div className={cn("card-body", flush && "flush")}>{children}</div>
    </section>
  );
}

/** A loading record page laid out like the real one, so nothing jumps. */
export function RecordPageSkeleton({ sections = 4, label }: { sections?: number; label: string }) {
  return (
    <div className="record-page" aria-busy="true" aria-label={label}>
      <div className="editor-head">
        <div className="left">
          <span className="skeleton record-skel-title" />
          <span className="skeleton record-skel-meta" />
        </div>
      </div>
      <div className="editor-shell">
        <div className="editor-nav">
          {Array.from({ length: sections }, (_, i) => (
            <span key={i} className="skeleton record-skel-rail" />
          ))}
        </div>
        <div className="editor-content">
          <div className="card">
            <div className="card-body">
              <div className="record-skeleton" aria-hidden>
                {Array.from({ length: 4 }, (_, i) => (
                  <span key={i} className="skeleton" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
