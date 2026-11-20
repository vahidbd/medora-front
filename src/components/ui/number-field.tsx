"use client";

import * as React from "react";
import { formatAmount, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Number and money fields without the browser's number input: text inputs
 * with a numeric keyboard, right-aligned tabular figures, no spinners, and
 * nothing that changes on the wheel or the arrow keys. Values go in and out
 * as the native input's did (a plain decimal string, "" when empty), and
 * onChange receives an event whose target.value is that string, so
 * <Input type="number"> props pass straight through.
 */

type InputValue = React.ComponentProps<"input">["value"];
type Change = React.ChangeEvent<HTMLInputElement>;

type Shared = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step"
> & {
  /** Accepted so `<Input type="number">` props pass through; the field is always a text input. */
  type?: string;
  value?: InputValue | null;
  defaultValue?: InputValue | null;
  /** Called with an input-shaped event whose target.value is the clean decimal string ("" when empty). */
  onChange?: (event: Change) => void;
  /** Called with the clean decimal string. */
  onValueChange?: (value: string) => void;
  /** Checked on submit ("Enter 1 or more"); never clamps what is typed. */
  min?: number | string;
  max?: number | string;
  /** Only sets the decimals allowed when `decimals` is left out ("0.01" → 2, "any" → no limit). */
  step?: number | string;
  /** Allows a leading minus. Default: unless `min` is 0 or more. */
  allowNegative?: boolean;
};

export type NumberFieldProps = Shared & {
  /** Most places after the point; 0 for whole numbers. Default from `step`, else 0 as a native number input. */
  decimals?: number;
};

export type MoneyFieldProps = Shared;

function toText(value: InputValue | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return Array.isArray(value) ? value.join("") : String(value);
}

function decimalsFor(decimals: number | undefined, step: number | string | undefined): number | null {
  if (decimals != null) return decimals;
  if (step == null || step === "") return 0;
  if (String(step).toLowerCase() === "any") return null;
  const [, frac = ""] = String(step).split(".");
  return frac.length;
}

/**
 * What can be typed: digits, one point (when decimals are allowed) and a
 * leading minus. Pasted "$1,234.50" becomes "1234.50". Returns null when
 * the change should be turned away (a second point, or too many decimals).
 */
function clean(raw: string, decimals: number | null, negative: boolean): string | null {
  let out = "";
  let point = false;
  for (const ch of raw.replace(/[\s,$]/g, "")) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === ".") {
      if (point || decimals === 0) return null;
      point = true;
      out += ".";
    } else if ((ch === "-" || ch === "−") && negative && out === "") out += "-";
  }
  if (point && decimals != null && (out.split(".")[1] ?? "").length > decimals) return null;
  return out;
}

/** The value a half-typed text stands for: "-" → "", "1." → "1", ".5" → "0.5". */
function toValue(text: string): string {
  if (text === "" || text === "-" || text === "." || text === "-.") return "";
  let t = text.endsWith(".") ? text.slice(0, -1) : text;
  if (t.startsWith("-.")) t = `-0${t.slice(1)}`;
  else if (t.startsWith(".")) t = `0${t}`;
  return t;
}

const isNumber = (text: string) => text !== "" && Number.isFinite(Number(text));

const sameNumber = (a: string, b: string) => a === b || (isNumber(a) && isNumber(b) && Number(a) === Number(b));

/** An input-shaped event whose target reads as the real input, except value is the clean string. */
function eventWith(event: React.SyntheticEvent<HTMLInputElement>, value: string, type?: string): Change {
  const el = event.target as HTMLInputElement;
  const target = new Proxy(el, {
    get(t, prop) {
      if (prop === "value") return value;
      if (prop === "valueAsNumber") return value === "" ? Number.NaN : Number(value);
      if (prop === "type" && type) return type;
      const v = Reflect.get(t, prop, t);
      return typeof v === "function" ? v.bind(t) : v;
    },
  });
  return Object.create(event, {
    target: { value: target },
    currentTarget: { value: target },
    type: { value: "change" },
  }) as Change;
}

function placeCaret(el: HTMLInputElement, at: number) {
  requestAnimationFrame(() => {
    if (document.activeElement !== el) return;
    const pos = Math.max(0, Math.min(at, el.value.length));
    el.setSelectionRange(pos, pos);
  });
}

function assignRef(ref: React.Ref<HTMLInputElement> | undefined, node: HTMLInputElement | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}

type Mode = "number" | "money";

function useNumericInput(props: Shared & { decimals: number | null; mode: Mode }) {
  const {
    type,
    value: valueProp,
    defaultValue,
    onChange,
    onValueChange,
    min,
    max,
    allowNegative,
    decimals,
    mode,
    onFocus,
    onBlur,
    onMouseUp,
    ref,
    step,
    ...rest
  } = props;
  void step; // read by decimalsFor; never rendered, a text input has no step

  const controlled = valueProp !== undefined;
  const [inner, setInner] = React.useState(() => toText(defaultValue));
  const value = controlled ? toText(valueProp) : inner;
  /** The text while the field has focus; null when it doesn't. */
  const [draft, setDraft] = React.useState<{ text: string; typed: boolean } | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const justFocused = React.useRef(false);

  const negative = allowNegative ?? !(min != null && min !== "" && Number(min) >= 0);
  const idle = mode === "money" && isNumber(value) ? formatAmount(value) : value;
  // A value changed from outside while focused wins over the draft.
  const editing = draft && sameNumber(toValue(draft.text), value) ? draft.text : null;
  const display = draft ? (editing ?? value) : idle;

  const emit = (event: React.SyntheticEvent<HTMLInputElement>, next: string) => {
    if (!controlled) setInner(next);
    onValueChange?.(next);
    onChange?.(eventWith(event, next, type));
  };

  // min and max are checked on submit, through the form's own validity.
  const minN = min == null || min === "" ? null : Number(min);
  const maxN = max == null || max === "" ? null : Number(max);
  const text = draft ? display : value;
  React.useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const v = toValue(text);
    const show = (n: number) => (mode === "money" ? formatMoney(n) : String(n));
    let message = "";
    if (text !== "" && v === "") message = "Enter a number";
    else if (v !== "" && minN != null && Number(v) < minN) message = `Enter ${show(minN)} or more`;
    else if (v !== "" && maxN != null && Number(v) > maxN) message = `Enter ${show(maxN)} or less`;
    el.setCustomValidity(message);
  }, [text, minN, maxN, mode]);

  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    assignRef(ref, node);
  };

  const inputProps: React.ComponentProps<"input"> = {
    ...rest,
    ref: setRefs,
    type: "text",
    inputMode: rest.inputMode ?? (decimals === 0 ? "numeric" : "decimal"),
    autoComplete: rest.autoComplete ?? "off",
    value: display,
    onFocus: (e) => {
      setDraft({ text: value, typed: false });
      if (mode === "money" && !rest.readOnly) {
        justFocused.current = true;
        const el = e.currentTarget;
        const shown = value;
        // After the plain value replaces the formatted one. A key typed in
        // that same frame wins: the field is then left as typed.
        requestAnimationFrame(() => {
          if (document.activeElement === el && el.value === shown) el.select();
        });
      }
      onFocus?.(e);
    },
    onMouseUp: (e) => {
      // A click that focused the field keeps the whole value selected.
      if (justFocused.current) {
        justFocused.current = false;
        e.preventDefault();
      }
      onMouseUp?.(e);
    },
    onChange: (e) => {
      justFocused.current = false;
      const el = e.target;
      const raw = el.value;
      const caret = el.selectionStart ?? raw.length;
      const before = display;
      const next = clean(raw, decimals, negative);
      if (next === null) {
        // Turned away: React puts the old text back; keep the caret where it was.
        placeCaret(el, caret - (raw.length - before.length));
        return;
      }
      if (next !== raw) placeCaret(el, caret - (raw.length - next.length));
      setDraft({ text: next, typed: true });
      emit(e, toValue(next));
    },
    onBlur: (e) => {
      justFocused.current = false;
      const typed = draft?.typed ?? false;
      setDraft(null);
      // Money settles to two places ("1234.5" → "1234.50") once someone has typed.
      if (mode === "money" && typed && isNumber(value)) {
        const fixed = Number(value).toFixed(2);
        if (fixed !== value) emit(e, fixed);
      }
      onBlur?.(e);
    },
  };

  return inputProps;
}

/**
 * A number in a text input: inputMode numeric (or decimal when `decimals`
 * or `step` allows a point), right-aligned tabular figures, letters and
 * stray characters filtered out, nothing on the wheel or the arrow keys.
 * `min` and `max` are checked when the form is submitted.
 */
export function NumberField({ className, decimals, ...props }: NumberFieldProps) {
  const inputProps = useNumericInput({ ...props, decimals: decimalsFor(decimals, props.step), mode: "number" });
  return <input {...inputProps} data-slot="input" className={cn("input number-input", className)} />;
}

/**
 * Money: a fixed "$" in front, two decimal places at most, "1,234.50" while
 * it isn't focused and the plain value, selected, when it is. Pasting
 * "$1,234.50" works. The value is the plain decimal string ("1234.50").
 * `className` and `style` go on the field's frame.
 */
export function MoneyField({ className, style, ...props }: MoneyFieldProps) {
  const inputProps = useNumericInput({ ...props, decimals: 2, mode: "money" });
  return (
    <div
      className={cn("input-with-prefix money-field", className)}
      style={style}
      data-disabled={props.disabled || undefined}
    >
      <span className="prefix" aria-hidden>
        $
      </span>
      <input {...inputProps} data-slot="input" className="money-input" />
    </div>
  );
}
