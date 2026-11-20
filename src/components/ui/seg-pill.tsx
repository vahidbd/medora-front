"use client";

import { useLayoutEffect, useRef } from "react";
import { motionEase, motionMs, prefersReducedMotion } from "./motion";

const ACTIVE = '.tab-u.active, .tab-u[aria-selected="true"], .tab-u[data-active]';

type Box = { x: number; y: number; w: number; h: number };

/**
 * The raised pill of segmented tabs (`.tabs-seg`), drawn once and slid
 * between options at --dur-fast. Render it as the last child of the
 * `.tabs-seg` element: it finds the active tab itself (`.active`,
 * `aria-selected` or base-ui's `data-active`), so any segmented control can
 * use it without passing anything in.
 *
 * Until it has measured (server render, first paint, a hidden list) the
 * active tab keeps its own raised background, so nothing ever shows without
 * a pill. The slide is transform only (a FLIP from the old tab's box) and is
 * skipped with reduced motion.
 */
export function SegPill() {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const pill = ref.current;
    const list = pill?.parentElement;
    if (!pill || !list) return;

    let last: Box | null = null;
    let lastTab: HTMLElement | null = null;
    let running: Animation | null = null;

    const findActive = () => {
      for (const el of list.querySelectorAll<HTMLElement>(ACTIVE)) {
        if (el.closest(".tabs-seg") === list) return el;
      }
      return null;
    };

    const off = () => {
      if (list.hasAttribute("data-pill")) list.removeAttribute("data-pill");
      last = null;
      lastTab = null;
    };

    const place = (animate: boolean) => {
      const tab = findActive();
      if (!tab || list.offsetWidth === 0 || tab.offsetWidth === 0) {
        off();
        return;
      }
      const listRect = list.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      // Undo any scale on an ancestor (a popover opening), as base-ui's own indicator does.
      const scaleX = list.offsetWidth ? listRect.width / list.offsetWidth : 1;
      const scaleY = list.offsetHeight ? listRect.height / list.offsetHeight : 1;
      const box: Box = {
        // The track can scroll sideways on a phone; the pill lives in its content.
        x: (tabRect.left - listRect.left) / scaleX - list.clientLeft + list.scrollLeft,
        y: (tabRect.top - listRect.top) / scaleY - list.clientTop + list.scrollTop,
        w: tabRect.width / scaleX,
        h: tabRect.height / scaleY,
      };
      const same =
        last &&
        tab === lastTab &&
        Math.abs(box.x - last.x) < 0.5 &&
        Math.abs(box.y - last.y) < 0.5 &&
        Math.abs(box.w - last.w) < 0.5 &&
        Math.abs(box.h - last.h) < 0.5;
      if (!same && tab !== lastTab && list.scrollWidth > list.clientWidth) {
        // Bring the chosen option into view inside a track that scrolls.
        const left = box.x - list.scrollLeft;
        if (left < 0) list.scrollLeft += left - 8;
        else if (left + box.w > list.clientWidth) list.scrollLeft += left + box.w - list.clientWidth + 8;
      }
      if (!same) {
        pill.style.width = `${box.w}px`;
        pill.style.height = `${box.h}px`;
        pill.style.transform = `translate(${box.x}px, ${box.y}px)`;
        const from = last;
        if (animate && from && tab !== lastTab && !prefersReducedMotion() && typeof pill.animate === "function") {
          running?.cancel();
          running = pill.animate(
            [
              {
                transform: `translate(${from.x}px, ${from.y}px) scale(${from.w / box.w}, ${from.h / box.h})`,
              },
              { transform: `translate(${box.x}px, ${box.y}px)` },
            ],
            { duration: motionMs("--dur-fast"), easing: motionEase() },
          );
        }
        last = box;
        lastTab = tab;
      }
      if (!list.hasAttribute("data-pill")) list.setAttribute("data-pill", "");
    };

    place(false);

    // A new active tab slides; anything else (fonts, counts, wrapping) just follows.
    const mutations = new MutationObserver(() => {
      observeTabs();
      place(true);
    });
    mutations.observe(list, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "aria-selected", "data-active"],
    });
    const sizes = new ResizeObserver(() => place(false));
    const watched = new Set<Element>();
    const observeTabs = () => {
      for (const tab of list.querySelectorAll(".tab-u")) {
        if (!watched.has(tab)) {
          watched.add(tab);
          sizes.observe(tab);
        }
      }
    };
    sizes.observe(list);
    observeTabs();

    return () => {
      mutations.disconnect();
      sizes.disconnect();
      running?.cancel();
      list.removeAttribute("data-pill");
    };
  }, []);

  return <span ref={ref} className="seg-pill" aria-hidden />;
}
