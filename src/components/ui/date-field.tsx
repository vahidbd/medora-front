"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Date, time and date-time fields in the kit's look, so no browser picker
 * ever shows. Each is a typed field (DD/MM/YYYY, 24h HH:mm) with a button
 * that opens a kit popover: a Monday-first calendar with a month and year
 * jump, Today and Clear; and a list of 15-minute slots. Values go in and
 * out in the same strings the native inputs used ("2026-11-15",
 * "14:05", "2026-11-15T14:05"), and onChange receives an event-shaped
 * object whose target.value is that string, so <Input type="date"> keeps
 * working unchanged wherever it is used.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_KEYS = MONTHS.map((m) => m.slice(0, 3).toLowerCase());
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Ymd = { y: number; m: number; d: number };

const pad = (n: number) => String(n).padStart(2, "0");

function isValidYmd(y: number, m: number, d: number) {
  if (y < 1000 || y > 9999 || m < 0 || m > 11 || d < 1) return false;
  const date = new Date(y, m, d);
  return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d;
}

function toIso({ y, m, d }: Ymd) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function fromIso(iso: string | null | undefined): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  return isValidYmd(y, m, d) ? { y, m, d } : null;
}

function todayYmd(): Ymd {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
}

function compareYmd(a: Ymd, b: Ymd) {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

function addDays({ y, m, d }: Ymd, days: number): Ymd {
  const date = new Date(y, m, d + days);
  return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() };
}

function addMonths({ y, m, d }: Ymd, months: number): Ymd {
  const first = new Date(y, m + months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return { y: first.getFullYear(), m: first.getMonth(), d: Math.min(d, last) };
}

/** "2026-11-05" → "05/11/2026". */
export function isoToDisplayDate(iso: string | null | undefined): string {
  const ymd = fromIso(iso);
  return ymd ? `${pad(ymd.d)}/${pad(ymd.m + 1)}/${ymd.y}` : "";
}

function expandYear(text: string): number {
  const n = Number(text);
  if (text.length > 2) return n;
  const pivot = (new Date().getFullYear() % 100) + 10;
  return n <= pivot ? 2000 + n : 1900 + n;
}

/**
 * Reads what someone typed: "5/11/2026", "05-11-26", "05112026", "5 Nov 2026",
 * "5 november 26". Returns the ISO date, "" for an empty field, or null when
 * it isn't a date.
 */
export function parseTypedDate(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/,/g, " ");
  if (!t) return "";
  let match = /^(\d{1,2})[\s/.\-]+(\d{1,2})[\s/.\-]+(\d{2}|\d{4})$/.exec(t);
  if (match) {
    const ymd = { y: expandYear(match[3]!), m: Number(match[2]) - 1, d: Number(match[1]) };
    return isValidYmd(ymd.y, ymd.m, ymd.d) ? toIso(ymd) : null;
  }
  match = /^(\d{2})(\d{2})(\d{4}|\d{2})$/.exec(t);
  if (match) {
    const ymd = { y: expandYear(match[3]!), m: Number(match[2]) - 1, d: Number(match[1]) };
    return isValidYmd(ymd.y, ymd.m, ymd.d) ? toIso(ymd) : null;
  }
  match = /^(\d{1,2})\s*([a-z]{3,})\.?\s*(\d{2}|\d{4})$/.exec(t);
  if (match) {
    const m = MONTH_KEYS.indexOf(match[2]!.slice(0, 3));
    const ymd = { y: expandYear(match[3]!), m, d: Number(match[1]) };
    return m >= 0 && isValidYmd(ymd.y, ymd.m, ymd.d) ? toIso(ymd) : null;
  }
  match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (match) {
    const ymd = { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
    return isValidYmd(ymd.y, ymd.m, ymd.d) ? toIso(ymd) : null;
  }
  return null;
}

/**
 * Reads a typed time: "9" → "09:00", "930" → "09:30", "9:30", "21.30",
 * "9:30pm" → "21:30". Returns "HH:mm", "" when empty, or null.
 */
export function parseTypedTime(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return "";
  const match = /^(\d{1,2})(?:[:.h]?(\d{2}))?(am|pm|a|p)?$/.exec(t);
  if (!match) return null;
  let h = Number(match[1]);
  const min = match[2] ? Number(match[2]) : 0;
  const half = match[3];
  if (half) {
    if (h < 1 || h > 12) return null;
    if (half.startsWith("p") && h < 12) h += 12;
    if (half.startsWith("a") && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

type FieldChange = React.ChangeEvent<HTMLInputElement>;

/** An event-shaped object for handlers written against the native input. */
function changeEvent(value: string, name: string | undefined, id: string | undefined, type: string): FieldChange {
  const target = { value, name: name ?? "", id: id ?? "", type };
  return {
    target,
    currentTarget: target,
    type: "change",
    bubbles: false,
    defaultPrevented: false,
    isDefaultPrevented: () => false,
    isPropagationStopped: () => false,
    preventDefault: () => {},
    stopPropagation: () => {},
    persist: () => {},
  } as unknown as FieldChange;
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

type CalendarView = "days" | "months" | "years";

export function Calendar({
  value,
  onSelect,
  min,
  max,
  autoFocus,
  allowClear = true,
}: {
  value: string;
  onSelect: (iso: string) => void;
  min?: string;
  max?: string;
  autoFocus?: boolean;
  allowClear?: boolean;
}) {
  const selected = fromIso(value);
  const minYmd = fromIso(min);
  const maxYmd = fromIso(max);
  const today = todayYmd();
  const [focus, setFocus] = React.useState<Ymd>(() => selected ?? today);
  const [view, setView] = React.useState<CalendarView>("days");
  const [yearPage, setYearPage] = React.useState(() => Math.floor((selected ?? today).y / 20) * 20);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const moved = React.useRef(false);

  const outOfRange = (ymd: Ymd) =>
    (minYmd != null && compareYmd(ymd, minYmd) < 0) || (maxYmd != null && compareYmd(ymd, maxYmd) > 0);

  React.useEffect(() => {
    if (view !== "days") return;
    if (!autoFocus && !moved.current) return;
    const btn = gridRef.current?.querySelector<HTMLButtonElement>('[data-focus="true"]');
    btn?.focus({ preventScroll: true });
  }, [focus, view, autoFocus]);

  const first = new Date(focus.y, focus.m, 1);
  const offset = (first.getDay() + 6) % 7;
  const cells: Ymd[] = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(focus.y, focus.m, 1 - offset + i);
    return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() };
  });
  const rows = cells.slice(35).every((c) => c.m !== focus.m) ? cells.slice(0, 35) : cells;

  const move = (next: Ymd) => {
    moved.current = true;
    setFocus(next);
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    const map: Record<string, () => Ymd> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
      Home: () => addDays(focus, -((new Date(focus.y, focus.m, focus.d).getDay() + 6) % 7)),
      End: () => addDays(focus, 6 - ((new Date(focus.y, focus.m, focus.d).getDay() + 6) % 7)),
    };
    const next = map[e.key];
    if (next) {
      e.preventDefault();
      move(next());
    }
  };

  const title =
    view === "days" ? `${MONTHS[focus.m]} ${focus.y}` : view === "months" ? String(focus.y) : `${yearPage} to ${yearPage + 19}`;

  const step = (dir: -1 | 1) => {
    if (view === "days") move(addMonths(focus, dir));
    else if (view === "months") setFocus((f) => ({ ...f, y: f.y + dir }));
    else setYearPage((p) => p + dir * 20);
  };

  const stepLabel = (dir: -1 | 1) =>
    view === "days"
      ? dir < 0 ? "Previous month" : "Next month"
      : view === "months"
        ? dir < 0 ? "Previous year" : "Next year"
        : dir < 0 ? "Earlier years" : "Later years";

  return (
    <div className="cal" data-view={view}>
      <div className="cal-head">
        <button
          type="button"
          className="cal-title"
          aria-label={view === "days" ? `${title}, choose a month and year` : view === "months" ? `${title}, choose a year` : title}
          onClick={() => {
            if (view === "days") setView("months");
            else if (view === "months") {
              setYearPage(Math.floor(focus.y / 20) * 20);
              setView("years");
            }
          }}
          disabled={view === "years"}
        >
          {title}
          {view !== "years" ? <ChevronDown aria-hidden /> : null}
        </button>
        <button type="button" className="cal-step" aria-label={stepLabel(-1)} onClick={() => step(-1)}>
          <ChevronLeft aria-hidden />
        </button>
        <button type="button" className="cal-step" aria-label={stepLabel(1)} onClick={() => step(1)}>
          <ChevronRight aria-hidden />
        </button>
      </div>

      {view === "days" ? (
        <div ref={gridRef} role="grid" aria-label={title} className="cal-grid" onKeyDown={onGridKey}>
          <div role="row" className="cal-row">
            {WEEKDAYS.map((day) => (
              <span key={day} role="columnheader" aria-label={day} className="cal-dow">
                {day.slice(0, 1)}
              </span>
            ))}
          </div>
          {Array.from({ length: rows.length / 7 }, (_, r) => (
            <div role="row" key={r} className="cal-row">
              {rows.slice(r * 7, r * 7 + 7).map((cell) => {
                const iso = toIso(cell);
                const isSelected = selected != null && compareYmd(cell, selected) === 0;
                const isFocus = compareYmd(cell, focus) === 0;
                const disabled = outOfRange(cell);
                return (
                  <button
                    key={iso}
                    type="button"
                    role="gridcell"
                    tabIndex={isFocus ? 0 : -1}
                    data-focus={isFocus || undefined}
                    aria-selected={isSelected}
                    aria-label={`${cell.d} ${MONTHS[cell.m]} ${cell.y}`}
                    disabled={disabled}
                    className={cn(
                      "cal-day",
                      cell.m !== focus.m && "is-outside",
                      compareYmd(cell, today) === 0 && "is-today",
                    )}
                    onClick={() => onSelect(iso)}
                    onFocus={() => {
                      if (!isFocus) setFocus(cell);
                    }}
                  >
                    {cell.d}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : view === "months" ? (
        <div className="cal-cells is-months">
          {MONTHS.map((name, m) => (
            <button
              key={name}
              type="button"
              className={cn("cal-cell", focus.m === m && "is-current", selected?.y === focus.y && selected.m === m && "is-selected")}
              onClick={() => {
                moved.current = true;
                setFocus((f) => ({ ...f, m, d: Math.min(f.d, new Date(f.y, m + 1, 0).getDate()) }));
                setView("days");
              }}
            >
              {name.slice(0, 3)}
            </button>
          ))}
        </div>
      ) : (
        <div className="cal-cells is-years">
          {Array.from({ length: 20 }, (_, i) => yearPage + i).map((y) => (
            <button
              key={y}
              type="button"
              className={cn("cal-cell", focus.y === y && "is-current", selected?.y === y && "is-selected", y === today.y && "is-today")}
              onClick={() => {
                setFocus((f) => ({ ...f, y, d: Math.min(f.d, new Date(y, f.m + 1, 0).getDate()) }));
                setView("months");
              }}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      <div className="cal-foot">
        {allowClear ? (
          <button type="button" className="cal-link" onClick={() => onSelect("")}>
            Clear
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="cal-link"
          disabled={outOfRange(today)}
          onClick={() => onSelect(toIso(today))}
        >
          Today
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared popover shell                                                */
/* ------------------------------------------------------------------ */

function PickerPopover({
  open,
  onOpenChange,
  anchor,
  className,
  children,
  label,
  icon,
  disabled,
  finalFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: React.RefObject<HTMLElement | null>;
  className: string;
  children: React.ReactNode;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  finalFocus?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <PopoverPrimitive.Trigger
        render={<button type="button" className="field-btn" aria-label={label} disabled={disabled} />}
      >
        {icon}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchor}
          side="bottom"
          align="start"
          sideOffset={6}
          className="isolate z-[var(--z-popover)]"
        >
          <PopoverPrimitive.Popup
            className={cn("pop-surface picker-pop origin-(--transform-origin)", className)}
            initialFocus={false}
            finalFocus={finalFocus ?? true}
          >
            {children}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

type BaseProps = Omit<React.ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> & {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (event: FieldChange) => void;
  /** Called with the new value ("" when cleared). */
  onValueChange?: (value: string) => void;
};

function useFieldValue(props: Pick<BaseProps, "value" | "defaultValue">) {
  const controlled = props.value !== undefined;
  const [inner, setInner] = React.useState(props.defaultValue ?? "");
  const value = controlled ? (props.value ?? "") : inner;
  return [value, setInner, controlled] as const;
}

/* ------------------------------------------------------------------ */
/* DateField                                                           */
/* ------------------------------------------------------------------ */

/** Day, month and a four-digit year, in any of the separators people type. */
const COMPLETE_DATE = /^\s*\d{1,2}[/.\-\s]\d{1,2}[/.\-\s]\d{4}\s*$/;
/** Hours and two-digit minutes. */
const COMPLETE_TIME = /^\s*\d{1,2}[:.]\d{2}\s*$/;
/** A date with a time after it, typed into the date half of a date-time field: "20/11/2026 14:30". */
const DATE_THEN_TIME = /^\s*(.+?)[\s,T]+(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\s*$/i;

type DateFieldProps = BaseProps & {
  /**
   * Set by DateTimeField: a date typed with a time after it ("20/11/2026
   * 14:30") is read as both and handed over here instead of failing.
   */
  onDateTime?: (date: string, time: string) => void;
};

export function DateField({
  value: valueProp,
  defaultValue,
  onChange,
  onValueChange,
  onDateTime,
  onBlur,
  onKeyDown,
  className,
  id,
  name,
  min,
  max,
  disabled,
  readOnly,
  placeholder = "DD/MM/YYYY",
  ref,
  style,
  "aria-invalid": ariaInvalid,
  ...rest
}: DateFieldProps) {
  const [value, setInner, controlled] = useFieldValue({ value: valueProp, defaultValue });
  const [text, setText] = React.useState(() => isoToDisplayDate(value));
  const [bad, setBad] = React.useState<string | null>(null);
  const typingBad = bad !== null;
  const errId = React.useId();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const focused = React.useRef(false);

  // Follow the value from outside unless someone is typing in the field.
  React.useEffect(() => {
    if (!focused.current) {
      setText(isoToDisplayDate(value));
      setBad(null);
    }
  }, [value]);

  const minIso = typeof min === "string" ? min : undefined;
  const maxIso = typeof max === "string" ? max : undefined;

  const emit = (iso: string) => {
    if (!controlled) setInner(iso);
    setText(isoToDisplayDate(iso));
    setBad(null);
    if (iso !== value) {
      onValueChange?.(iso);
      onChange?.(changeEvent(iso, name, id, "date"));
    }
  };

  const commit = () => {
    // Leaving the field without changing it never flags the date it already
    // had: an overdue date opened for editing is not the person's mistake.
    if (value && text === isoToDisplayDate(value)) {
      setBad(null);
      return;
    }
    let parsed = parseTypedDate(text);
    let time: string | null = null;
    if (parsed === null && onDateTime) {
      const typed = DATE_THEN_TIME.exec(text);
      const date = typed ? parseTypedDate(typed[1]!) : null;
      const at = typed ? parseTypedTime(typed[2]!) : null;
      if (date && at) {
        parsed = date;
        time = at;
      }
    }
    if (parsed === null) {
      setBad("Enter a date as DD/MM/YYYY");
      return;
    }
    const ymd = fromIso(parsed);
    if (ymd && minIso && parsed < minIso) {
      setBad(`Enter a date from ${isoToDisplayDate(minIso)}`);
      return;
    }
    if (ymd && maxIso && parsed > maxIso) {
      setBad(`Enter a date up to ${isoToDisplayDate(maxIso)}`);
      return;
    }
    if (time !== null && onDateTime) {
      setText(isoToDisplayDate(parsed));
      setBad(null);
      onDateTime(parsed, time);
      return;
    }
    emit(parsed);
  };

  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.RefObject<HTMLInputElement | null>).current = node;
  };

  return (
    <div ref={wrapRef} className={cn("date-field", className)} style={style} data-disabled={disabled || undefined}>
      <input
        {...rest}
        ref={setRefs}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="input"
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={typingBad || ariaInvalid || undefined}
        aria-describedby={cn(rest["aria-describedby"], bad && errId) || undefined}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (typingBad) setBad(null);
          // A whole date (or an emptied field) counts as soon as it is typed,
          // so the form sees it, and its error clears, before anything is
          // clicked. The text is tidied when the field is left.
          const parsed = next.trim() === "" ? "" : COMPLETE_DATE.test(next) ? parseTypedDate(next) : null;
          if (parsed === null || parsed === value) return;
          if (parsed && ((minIso && parsed < minIso) || (maxIso && parsed > maxIso))) return;
          if (!controlled) setInner(parsed);
          onValueChange?.(parsed);
          onChange?.(changeEvent(parsed, name, id, "date"));
        }}
        onFocus={(e) => {
          focused.current = true;
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          focused.current = false;
          commit();
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "ArrowDown" && (e.altKey || e.metaKey)) {
            e.preventDefault();
            setOpen(true);
          }
          onKeyDown?.(e);
        }}
      />
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <PickerPopover
        open={open}
        onOpenChange={setOpen}
        anchor={wrapRef}
        className="cal-pop"
        label="Choose a date"
        icon={<CalendarDays aria-hidden />}
        disabled={disabled || readOnly}
        finalFocus={inputRef}
      >
        <Calendar
          value={value}
          min={minIso}
          max={maxIso}
          autoFocus
          allowClear={!rest.required}
          onSelect={(iso) => {
            emit(iso);
            setOpen(false);
          }}
        />
      </PickerPopover>
      {bad ? (
        <span className="field-err" id={errId} role="status">
          {bad}
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TimeField                                                           */
/* ------------------------------------------------------------------ */

const SLOTS = Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`);

function TimeSlots({ value, onSelect }: { value: string; onSelect: (time: string) => void }) {
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const now = new Date();
    const target = value || `${pad(now.getHours())}:${pad(Math.floor(now.getMinutes() / 15) * 15)}`;
    const nearest = SLOTS.reduce((best, slot) => (slot <= target ? slot : best), SLOTS[0]!);
    const el = listRef.current?.querySelector<HTMLElement>(`[data-slot-time="${nearest}"]`);
    if (el && listRef.current) {
      listRef.current.scrollTop = el.offsetTop - listRef.current.clientHeight / 2 + el.clientHeight / 2;
    }
  }, [value]);
  return (
    <div ref={listRef} className="time-list" role="listbox" aria-label="Times">
      {SLOTS.map((slot) => (
        <button
          key={slot}
          type="button"
          role="option"
          aria-selected={slot === value}
          data-slot-time={slot}
          className={cn("menu-item time-option", slot === value && "is-active")}
          onClick={() => onSelect(slot)}
        >
          {slot}
        </button>
      ))}
    </div>
  );
}

export function TimeField({
  value: valueProp,
  defaultValue,
  onChange,
  onValueChange,
  onBlur,
  onKeyDown,
  className,
  id,
  name,
  disabled,
  readOnly,
  placeholder = "HH:MM",
  ref,
  style,
  "aria-invalid": ariaInvalid,
  ...rest
}: BaseProps) {
  const [value, setInner, controlled] = useFieldValue({ value: valueProp, defaultValue });
  const [text, setText] = React.useState(value ?? "");
  const [bad, setBad] = React.useState<string | null>(null);
  const typingBad = bad !== null;
  const errId = React.useId();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const focused = React.useRef(false);

  React.useEffect(() => {
    if (!focused.current) {
      setText((value ?? "").slice(0, 5));
      setBad(null);
    }
  }, [value]);

  const emit = (time: string) => {
    if (!controlled) setInner(time);
    setText(time);
    setBad(null);
    if (time !== value) {
      onValueChange?.(time);
      onChange?.(changeEvent(time, name, id, "time"));
    }
  };

  const commit = () => {
    const parsed = parseTypedTime(text);
    if (parsed === null) {
      setBad("Enter a time as HH:MM");
      return;
    }
    emit(parsed);
  };

  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.RefObject<HTMLInputElement | null>).current = node;
  };

  return (
    <div ref={wrapRef} className={cn("time-field", className)} style={style} data-disabled={disabled || undefined}>
      <input
        {...rest}
        ref={setRefs}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="input"
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={typingBad || ariaInvalid || undefined}
        aria-describedby={cn(rest["aria-describedby"], bad && errId) || undefined}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (typingBad) setBad(null);
          // A whole time ("9:30", "14:05") or an emptied field counts as soon
          // as it is typed; the text is tidied when the field is left.
          const parsed = next.trim() === "" ? "" : COMPLETE_TIME.test(next) ? parseTypedTime(next) : null;
          if (parsed === null || parsed === value) return;
          if (!controlled) setInner(parsed);
          onValueChange?.(parsed);
          onChange?.(changeEvent(parsed, name, id, "time"));
        }}
        onFocus={(e) => {
          focused.current = true;
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          focused.current = false;
          commit();
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "ArrowDown" && (e.altKey || e.metaKey)) {
            e.preventDefault();
            setOpen(true);
          }
          onKeyDown?.(e);
        }}
      />
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <PickerPopover
        open={open}
        onOpenChange={setOpen}
        anchor={wrapRef}
        className="time-pop"
        label="Choose a time"
        icon={<Clock aria-hidden />}
        disabled={disabled || readOnly}
        finalFocus={inputRef}
      >
        <TimeSlots
          value={value}
          onSelect={(time) => {
            emit(time);
            setOpen(false);
          }}
        />
      </PickerPopover>
      {bad ? (
        <span className="field-err" id={errId} role="status">
          {bad}
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DateTimeField                                                       */
/* ------------------------------------------------------------------ */

/** "2026-11-15T14:05" in and out; the date and the time are typed or picked side by side. */
export function DateTimeField({
  value: valueProp,
  defaultValue,
  onChange,
  onValueChange,
  className,
  id,
  name,
  min,
  max,
  disabled,
  readOnly,
  required,
  style,
  ref,
  "aria-invalid": ariaInvalid,
  ...rest
}: BaseProps) {
  const [value, setInner, controlled] = useFieldValue({ value: valueProp, defaultValue });
  const [datePart, setDatePart] = React.useState(() => (value ? value.slice(0, 10) : ""));
  const [timePart, setTimePart] = React.useState(() => (value ? value.slice(11, 16) : ""));

  // Follow the value from outside (the React way to reset state on a prop change).
  const [seen, setSeen] = React.useState(value);
  if (seen !== value) {
    setSeen(value);
    setDatePart(value ? value.slice(0, 10) : "");
    setTimePart(value ? value.slice(11, 16) : "");
  }

  const emit = (date: string, time: string) => {
    const next = date ? `${date}T${time || "09:00"}` : "";
    setDatePart(date);
    setTimePart(date ? time || "09:00" : time);
    if (!controlled) setInner(next);
    if (next !== value) {
      onValueChange?.(next);
      onChange?.(changeEvent(next, name, id, "datetime-local"));
    }
  };

  const minDate = typeof min === "string" ? min.slice(0, 10) : undefined;
  const maxDate = typeof max === "string" ? max.slice(0, 10) : undefined;

  return (
    <div className={cn("datetime-field", className)} style={style}>
      <DateField
        {...rest}
        ref={ref}
        id={id}
        value={datePart}
        min={minDate}
        max={maxDate}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-invalid={ariaInvalid}
        onValueChange={(date) => emit(date, timePart)}
        onDateTime={(date, time) => emit(date, time)}
      />
      <TimeField
        aria-label={rest["aria-label"] ? `${rest["aria-label"]}, time` : "Time"}
        value={timePart}
        disabled={disabled}
        readOnly={readOnly}
        onValueChange={(time) => (datePart ? emit(datePart, time) : setTimePart(time))}
      />
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
