"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * A field that picks one of a fixed list, on the kit's select. The list
 * gives each value its words, so the trigger never shows a raw API value.
 */
export function ChoiceSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  placeholder = "Choose",
}: {
  id: string;
  value: T | null;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  placeholder?: string;
}) {
  return (
    <Select items={options} value={value} onValueChange={(next) => (next ? onChange(next as T) : undefined)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Options from a record of labels, in its order. */
export function optionsOf<T extends string>(labels: Record<T, string>): { value: T; label: string }[] {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
}
