/**
 * Reading a protocol version's definition on a screen. The contract sends
 * the definition as an open object, because the API checks it in full
 * (docs/decisions/intake.md INT1, INT19) and refuses a bad one with each
 * problem's path. The console only shows it, so it reads the few fields
 * below and passes anything else through untouched.
 */

type Value = boolean | number | string | string[];
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { answer: string; is: string; value?: Value }
  | { derived: string; is: string; value?: number };

export type ShownQuestion = { key: string; label: string; kind: string; required?: boolean; unit?: string; min?: number; max?: number; options?: { value: string; label: string }[]; showIf?: Condition };
export type ShownStep = { key: string; title: string; intro?: string; showIf?: Condition; questions: ShownQuestion[] };
export type ShownDerived = { key: string; label: string; unit?: string };
export type ShownRule = { key: string; outcome: "hard_stop" | "red_flag"; when: Condition; prescriberLabel: string; patientMessage?: string; urgentHelp?: boolean };
export type ShownDefinition = { steps: ShownStep[]; derived: ShownDerived[]; rules: ShownRule[] };

const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export function readDefinition(definition: Record<string, unknown>): ShownDefinition {
  return { steps: list<ShownStep>(definition.steps), derived: list<ShownDerived>(definition.derived), rules: list<ShownRule>(definition.rules) };
}

export const QUESTION_KIND_LABELS: Record<string, string> = {
  yes_no: "Yes or no",
  single_choice: "One choice",
  multi_choice: "Any of a list",
  number: "Number",
  date: "Date",
  text: "Free text",
};

const COMPARISON_WORDS: Record<string, string> = {
  equals: "is",
  not_equals: "is not",
  less_than: "is under",
  at_most: "is at most",
  greater_than: "is over",
  at_least: "is at least",
  one_of: "is one of",
  includes: "includes",
  answered: "is answered",
};

/** A condition in words, with each question and derived number by its label: "BMI is at least 30". */
export function conditionInWords(condition: Condition, definition: ShownDefinition): string {
  const questions = new Map(definition.steps.flatMap((s) => s.questions).map((q) => [q.key, q]));
  const derived = new Map(definition.derived.map((d) => [d.key, d]));
  const words = (c: Condition): string => {
    if ("all" in c) return c.all.map(words).join(" and ");
    if ("any" in c) return `(${c.any.map(words).join(" or ")})`;
    if ("not" in c) return `not (${words(c.not)})`;
    const comparison = COMPARISON_WORDS[c.is] ?? c.is;
    if ("answer" in c) {
      const question = questions.get(c.answer);
      const optionLabel = (v: string) => question?.options?.find((o) => o.value === v)?.label ?? v;
      const value = c.value === undefined ? "" : typeof c.value === "boolean" ? (c.value ? "Yes" : "No") : Array.isArray(c.value) ? c.value.map(optionLabel).join(", ") : typeof c.value === "string" ? optionLabel(c.value) : `${c.value}${question?.unit ? ` ${question.unit}` : ""}`;
      return `"${question?.label ?? c.answer}" ${comparison}${value === "" ? "" : ` ${value}`}`;
    }
    const item = c.derived === "age" ? { label: "Age", unit: "years" } : derived.get(c.derived);
    return `${item?.label ?? c.derived} ${comparison}${c.value === undefined ? "" : ` ${c.value}${item?.unit ? ` ${item.unit}` : ""}`}`;
  };
  return words(condition);
}
