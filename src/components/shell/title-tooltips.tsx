"use client";

import { useEffect } from "react";

/** Holds an element's title while it is hovered or focused, so the browser never draws its own bubble. */
export const TITLE_ATTR = "data-title-tip";

const TIP_ID = "title-tip";
const SHOW_DELAY = 400;
/** A tooltip hidden this recently makes the next one instant (moving along a toolbar). */
const WARM_MS = 300;
const GAP = 6;
const EDGE = 8;
/** Elements that never get this tooltip: base-ui tooltips draw their own, iframes are named by it. */
const SKIP = "[data-base-ui-tooltip-trigger], iframe, .tip-surface, .tip";

const norm = (text: string) => text.replace(/\s+/g, " ").trim();

type Taken = { title: string; labelled: boolean };

/** True when the element (or the text inside it) is cut off. */
function isClipped(el: HTMLElement): boolean {
  const candidates: HTMLElement[] = [el];
  const inner = el.querySelectorAll<HTMLElement>("*");
  for (let i = 0; i < inner.length && i < 24; i++) candidates.push(inner[i]!);
  if (el.parentElement && getComputedStyle(el).display === "inline") candidates.push(el.parentElement);
  return candidates.some((node) => {
    if (node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1) return true;
    if (node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1) {
      const style = getComputedStyle(node);
      return style.overflowY !== "visible" || (style.webkitLineClamp !== "" && style.webkitLineClamp !== "none");
    }
    return false;
  });
}

/**
 * What the tooltip should say for this element, or "" for none: nothing
 * while its own menu or popup is open, and nothing when the title only
 * repeats text that is already fully visible.
 */
function tipText(el: HTMLElement, title: string): string {
  if (!title.trim()) return "";
  if (el.closest(SKIP)) return "";
  if (el.matches('[aria-expanded="true"], [data-popup-open]')) return "";
  if (norm(title) === norm(el.textContent ?? "") && !isClipped(el)) return "";
  return title;
}

function findTitled(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  const hit = node.closest(`[title], [${TITLE_ATTR}]`);
  // SVG <title> and title attributes on SVG parts are left to the browser.
  return hit instanceof HTMLElement ? hit : null;
}

/**
 * One kit tooltip for every `title` in the app, so the browser's own bubble
 * never shows. Mounted once, in Providers.
 *
 * While an element with a title is hovered or keyboard-focused, its title
 * sits in data-title-tip instead (an element named only by its title gets it
 * as aria-label meanwhile), and a `.tip-surface` shows above it after about
 * 400ms: below when there's no room, kept inside the window, and instantly
 * when another one was showing a moment ago. Pointer out, blur, Escape,
 * scrolling and pointer down hide it; the title goes back when the element is
 * neither hovered nor focused, so React keeps owning the attribute.
 *
 * A title that repeats the element's visible text shows only when that text
 * is cut off. base-ui Tooltip triggers keep their own tooltip.
 */
export function TitleTooltips() {
  useEffect(() => {
    const tip = document.createElement("div");
    tip.id = TIP_ID;
    tip.className = "tip-surface title-tip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);

    const taken = new Map<HTMLElement, Taken>();
    /** The titled element under the pointer, and the focused one. */
    let hovered: HTMLElement | null = null;
    let focused: HTMLElement | null = null;
    /** The element the visible (or pending) tooltip belongs to. */
    let shown: HTMLElement | null = null;
    /** Clicked: stays quiet until the pointer leaves it. */
    let quiet: HTMLElement | null = null;
    let timer: number | undefined;
    let lastHidden = 0;

    /** Moves the title off the element and returns it. */
    const take = (el: HTMLElement): string => {
      const title = el.getAttribute("title");
      if (title != null) {
        el.removeAttribute("title");
        const before = taken.get(el);
        let labelled = before?.labelled ?? false;
        if (labelled && el.getAttribute("aria-label") !== before?.title) labelled = false;
        if (labelled) el.setAttribute("aria-label", title);
        else if (
          title.trim() &&
          !el.hasAttribute("aria-label") &&
          !el.hasAttribute("aria-labelledby") &&
          norm(el.textContent ?? "") === "" &&
          !el.closest('[aria-hidden="true"]')
        ) {
          el.setAttribute("aria-label", title);
          labelled = true;
        }
        taken.set(el, { title, labelled });
        el.setAttribute(TITLE_ATTR, title);
      }
      return taken.get(el)?.title ?? el.getAttribute(TITLE_ATTR) ?? "";
    };

    /**
     * Puts titles back on elements that are neither focused nor around the
     * hovered one (an outer title must stay off while an inner one shows).
     */
    const giveBack = () => {
      for (const [el, rec] of taken) {
        if (el === focused || (hovered && el.contains(hovered))) continue;
        taken.delete(el);
        el.removeAttribute(TITLE_ATTR);
        if (!el.hasAttribute("title")) el.setAttribute("title", rec.title);
        if (rec.labelled && el.getAttribute("aria-label") === rec.title) el.removeAttribute("aria-label");
      }
    };

    const describe = (el: HTMLElement, on: boolean) => {
      const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((id) => id && id !== TIP_ID);
      if (on && !el.closest('[aria-hidden="true"]')) ids.push(TIP_ID);
      if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
      else el.removeAttribute("aria-describedby");
    };

    const place = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      let top = r.top - GAP - h;
      if (top < EDGE) top = r.bottom + GAP;
      top = Math.max(EDGE, Math.min(top, vh - EDGE - h));
      const left = Math.max(EDGE, Math.min(r.left + r.width / 2 - w / 2, vw - EDGE - w));
      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
    };

    const hide = () => {
      window.clearTimeout(timer);
      if (!shown) return;
      const was = shown;
      shown = null;
      titleWatch.disconnect();
      describe(was, false);
      if (tip.hasAttribute("data-open")) lastHidden = performance.now();
      tip.removeAttribute("data-instant");
      tip.removeAttribute("data-open");
    };

    const show = (el: HTMLElement, text: string, instant: boolean) => {
      if (!el.isConnected) return;
      tip.textContent = text;
      tip.toggleAttribute("data-instant", instant);
      place(el); // measures first, so the fade starts from the hidden state
      tip.setAttribute("data-open", "");
      describe(el, true);
    };

    // The title changed while it was taken ("Copy" → "Copied"): follow it.
    const titleWatch = new MutationObserver(() => {
      if (!shown || !shown.hasAttribute("title")) return;
      const text = tipText(shown, take(shown));
      if (!text) hide();
      else if (tip.hasAttribute("data-open")) {
        tip.textContent = text;
        place(shown);
      }
    });

    const schedule = (el: HTMLElement) => {
      hide();
      const text = tipText(el, take(el));
      if (!text) return;
      shown = el;
      titleWatch.observe(el, { attributes: true, attributeFilter: ["title"] });
      if (performance.now() - lastHidden < WARM_MS) show(el, text, true);
      else timer = window.setTimeout(() => show(el, text, false), SHOW_DELAY);
    };

    const onPointerOver = (event: PointerEvent) => {
      const el = findTitled(event.target);
      if (!el || el === hovered) return;
      hovered = el;
      giveBack();
      if (event.pointerType === "touch" || el === quiet) {
        take(el);
        return;
      }
      quiet = null;
      schedule(el);
    };

    const onPointerOut = (event: PointerEvent) => {
      if (!hovered) return;
      const next = event.relatedTarget;
      if (next instanceof Node && hovered.contains(next)) return;
      const left = hovered;
      hovered = null;
      if (quiet === left) quiet = null;
      if (shown === left) hide();
      giveBack();
    };

    const onFocusIn = (event: FocusEvent) => {
      const el = event.target;
      if (!(el instanceof HTMLElement) || !(el.hasAttribute("title") || el.hasAttribute(TITLE_ATTR))) return;
      focused = el;
      let keyboard = true;
      try {
        keyboard = el.matches(":focus-visible");
      } catch {
        /* an engine without :focus-visible: treat focus as keyboard focus */
      }
      if (keyboard && el !== shown) schedule(el);
      else take(el);
    };

    const onFocusOut = (event: FocusEvent) => {
      const el = event.target;
      if (!(el instanceof HTMLElement) || el !== focused) return;
      focused = null;
      if (shown === el && hovered !== el) hide();
      giveBack();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
      // A key that took the element away (Backspace over a merge field's chip) takes its tip too.
      else if (shown)
        window.setTimeout(() => {
          if (shown && !shown.isConnected) hide();
        }, 0);
    };

    const onPointerDown = () => {
      if (hovered) quiet = hovered;
      hide();
    };

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    window.addEventListener("resize", hide);

    return () => {
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
      window.removeEventListener("resize", hide);
      hide();
      hovered = null;
      focused = null;
      giveBack();
      tip.remove();
    };
  }, []);

  return null;
}
