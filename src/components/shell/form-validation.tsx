"use client";

import { useEffect } from "react";
import { prefersReducedMotion } from "@/components/ui/motion";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Marks what this handler added, so it only ever removes its own. */
const OWN = "data-auto-error";
/** Wrappers an error goes after rather than inside. */
const WRAPPERS = ".date-field, .time-field, .datetime-field, .input-group, [data-slot='input-group'], .input-with-prefix, .money-field";
/** Visible controls a hidden proxy input (base-ui Select, Checkbox, Switch, Radio) stands for. */
const PROXIED = "[role='combobox'], [role='checkbox'], [role='switch'], [role='radio'], [role='radiogroup'], [role='listbox'], button, [data-slot='select-trigger']";
const ACRONYM = /^[A-Z0-9]{2,}\b/;

let seq = 0;

function isControl(el: EventTarget | null): el is Control {
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
}

/** base-ui renders a hidden input for the form beside its visible control. */
function isProxy(el: Control): boolean {
  return el.getAttribute("aria-hidden") === "true" || (el.tabIndex === -1 && el.offsetWidth <= 1);
}

/** The element a person sees and focuses for this control. */
function visibleFor(el: Control): HTMLElement {
  if (!isProxy(el)) return el;
  for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
    if (sib instanceof HTMLElement && sib.matches(PROXIED)) return sib;
    const inner = sib.querySelector<HTMLElement>(PROXIED);
    if (inner) return inner;
  }
  const scope = el.closest(".field") ?? el.parentElement;
  return scope?.querySelector<HTMLElement>(PROXIED) ?? el;
}

function textOf(node: Element): string {
  const copy = node.cloneNode(true) as Element;
  copy.querySelectorAll(".req, .opt, [aria-hidden='true'], .sr-only").forEach((n) => n.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").replace(/[*:]\s*$/, "").trim();
}

/** The field's name as its label says it ("Date of birth"). */
function labelOf(control: Control, shown: HTMLElement): string {
  for (const el of [shown, control]) {
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter((n): n is HTMLElement => n != null)
        .map(textOf)
        .join(" ")
        .trim();
      if (text) return text;
    }
    const labels = "labels" in el ? (el as HTMLInputElement).labels : null;
    if (labels && labels.length > 0) {
      const text = textOf(labels[0]!);
      if (text) return text;
    }
    const aria = el.getAttribute("aria-label");
    if (aria?.trim()) return aria.trim();
  }
  const fieldLabel = shown.closest(".field")?.querySelector("label, .field-label");
  if (fieldLabel) {
    const text = textOf(fieldLabel);
    if (text) return text;
  }
  const placeholder = control.getAttribute("placeholder") ?? shown.getAttribute("placeholder");
  return placeholder?.replace(/…$/, "").trim() ?? "";
}

/** "Date of birth" → "a date of birth"; "Email" → "an email"; "ABN" → "an ABN"; "Notes" → "notes". */
function withArticle(label: string): string {
  if (!label) return "";
  const acronym = ACRONYM.test(label);
  const words = acronym ? label : label.charAt(0).toLowerCase() + label.slice(1);
  const last = words.split(/\s+/).pop() ?? "";
  if (!acronym && /[a-z]s$/.test(last) && !/(ss|us|is)$/.test(last)) return words;
  const an = acronym
    ? /^[AEFHILMNORSX8]/.test(label)
    : /^[aeiou]/.test(words) && !/^(uni|use|usu|eu|one|once)/.test(words);
  return `${an ? "an" : "a"} ${words}`;
}

function isChoice(control: Control, shown: HTMLElement): boolean {
  if (control instanceof HTMLSelectElement) return true;
  if (control instanceof HTMLInputElement && (control.type === "radio" || control.type === "file")) return true;
  const role = shown.getAttribute("role");
  return role === "combobox" || role === "listbox" || role === "radiogroup" || role === "radio" || shown.matches("[data-slot='select-trigger']");
}

/** The kit's wording for what is wrong ("Enter a date of birth"). */
export function messageFor(control: Control, shown: HTMLElement = control): string {
  const v = control.validity;
  if (v.customError && control.validationMessage) return control.validationMessage;
  const label = labelOf(control, shown);
  const named = withArticle(label);
  const type = control instanceof HTMLInputElement ? control.type : "";
  const format = control.getAttribute("data-format");
  if (v.valueMissing) {
    const own = control.getAttribute("data-required-message") ?? shown.getAttribute("data-required-message");
    if (own) return own;
    if (type === "checkbox" || shown.getAttribute("role") === "checkbox" || shown.getAttribute("role") === "switch") {
      return label ? `Tick ${label.charAt(0).toLowerCase()}${label.slice(1)} to continue` : "Tick this to continue";
    }
    if (type === "file") return named ? `Choose ${named}` : "Choose a file";
    if (isChoice(control, shown)) return named ? `Choose ${named}` : "Choose an option";
    return named ? `Enter ${named}` : "Fill in this field";
  }
  if (v.typeMismatch) {
    if (type === "email") return "Enter an email address like name@example.com";
    if (type === "url") return "Enter a web address like https://example.com";
    return "Check the format";
  }
  if (v.badInput && type === "number") return "Enter a number";
  if (v.patternMismatch || v.badInput) {
    if (format) return named ? `Enter ${named} as ${format}` : `Use the format ${format}`;
    return "Check the format";
  }
  const input = control as HTMLInputElement;
  if (v.tooShort) return `Use at least ${input.minLength} characters`;
  if (v.tooLong) return `Use ${input.maxLength} characters or fewer`;
  if (v.rangeUnderflow) return `Enter ${input.min} or more`;
  if (v.rangeOverflow) return `Enter ${input.max} or less`;
  if (v.stepMismatch) {
    const step = Number(input.step);
    return step === 1 ? "Enter a whole number" : `Enter a multiple of ${input.step}`;
  }
  return control.validationMessage || "Check this field";
}

/** Where the message goes: after a wrapper, at the end of the `.field`, or right after the control. */
function anchorFor(shown: HTMLElement): { parent: Element; after: Element | null } {
  const wrapper = shown.closest(WRAPPERS);
  const field = shown.closest(".field");
  if (field && (!wrapper || field.contains(wrapper))) {
    // Inside a kit field the field's own gap spaces it; it goes last.
    return { parent: field, after: field.lastElementChild };
  }
  const base = wrapper ?? shown;
  return { parent: base.parentElement ?? document.body, after: base };
}

function errorFor(shown: HTMLElement): HTMLElement | null {
  const id = shown.getAttribute("data-auto-error-id");
  return id ? document.getElementById(id) : null;
}

function addDescribedBy(el: HTMLElement, id: string, on: boolean) {
  const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((x) => x && x !== id);
  if (on) ids.push(id);
  if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
  else el.removeAttribute("aria-describedby");
}

function showError(shown: HTMLElement, message: string) {
  let error = errorFor(shown);
  if (!error || !error.isConnected) {
    error = document.createElement("p");
    error.id = `auto-error-${++seq}`;
    error.className = "err field-error";
    error.setAttribute("role", "alert");
    error.setAttribute(OWN, "");
    shown.setAttribute("data-auto-error-id", error.id);
  }
  error.textContent = message;
  const { parent, after } = anchorFor(shown);
  if (after !== error) {
    if (after) after.after(error);
    else parent.appendChild(error);
  }
  if (shown.getAttribute("aria-invalid") !== "true") {
    shown.setAttribute("aria-invalid", "true");
    shown.setAttribute("data-auto-invalid", "");
  }
  addDescribedBy(shown, error.id, true);
}

function clearError(shown: HTMLElement) {
  const error = errorFor(shown);
  if (error) {
    addDescribedBy(shown, error.id, false);
    error.remove();
  }
  shown.removeAttribute("data-auto-error-id");
  if (shown.hasAttribute("data-auto-invalid")) {
    shown.removeAttribute("data-auto-invalid");
    if (shown.getAttribute("aria-invalid") === "true") shown.removeAttribute("aria-invalid");
  }
}

/**
 * The kit's inline errors for every form, so the browser's validation
 * bubble never shows. Mounted once, in Providers.
 *
 * Forms keep their `required`, `type="email"`, `pattern`, `min`/`max` and
 * custom validity. When a submit finds a control invalid, the browser's
 * `invalid` event is cancelled (no bubble) and the control gets the danger
 * border (aria-invalid) and a `.field-error` line under it, in the kit's
 * words: "Enter a date of birth", "Choose a status", "Enter an email address
 * like name@example.com". `data-format="DD/MM/YYYY"` on a control turns a
 * format error into "Enter a date as DD/MM/YYYY"; `data-required-message`
 * replaces the empty-field wording where the label doesn't read as a noun
 * ("Send to" → "Enter who to send it to"); setCustomValidity() messages
 * show as they are. The first invalid control of a submit is
 * focused and scrolled to the middle; a control's error clears as soon as it
 * is edited.
 */
export function FormValidation() {
  useEffect(() => {
    let first: HTMLElement | null = null;
    /** Each control showing an error, by the element that shows it. */
    const live = new Map<HTMLElement, Control>();

    const drop = (shown: HTMLElement) => {
      clearError(shown);
      live.delete(shown);
      if (live.size === 0) sweep.disconnect();
    };

    // Controls that went away take their message with them.
    const sweep = new MutationObserver(() => {
      for (const shown of live.keys()) {
        if (!shown.isConnected) {
          errorFor(shown)?.remove();
          live.delete(shown);
        }
      }
      if (live.size === 0) sweep.disconnect();
    });

    const onInvalid = (event: Event) => {
      const control = event.target;
      if (!isControl(control)) return;
      event.preventDefault();
      const shown = visibleFor(control);
      showError(shown, messageFor(control, shown));
      if (live.size === 0) sweep.observe(document.body, { childList: true, subtree: true });
      live.set(shown, control);
      // The browser fires `invalid` at every bad control in one task; the first gets focus after it.
      if (!first) {
        first = shown;
        window.setTimeout(() => {
          const target = first;
          first = null;
          if (!target || !target.isConnected) return;
          target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
          target.focus({ preventScroll: true });
        }, 0);
      }
    };

    const onEdit = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      for (const [shown, control] of live) {
        if (target === shown || target === control || shown.contains(target)) drop(shown);
      }
    };

    // base-ui's Select, Checkbox and Radio set their hidden input without an
    // input event; once a pick or a key makes it valid, the error goes.
    let checking: number | undefined;
    const onPick = () => {
      if (live.size === 0) return;
      window.clearTimeout(checking);
      checking = window.setTimeout(() => {
        for (const [shown, control] of live) {
          if (control !== shown && control.validity.valid) drop(shown);
        }
      }, 0);
    };

    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    document.addEventListener("click", onPick, true);
    document.addEventListener("keyup", onPick, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
      document.removeEventListener("click", onPick, true);
      document.removeEventListener("keyup", onPick, true);
      window.clearTimeout(checking);
      sweep.disconnect();
      for (const shown of live.keys()) clearError(shown);
      live.clear();
    };
  }, []);

  return null;
}
