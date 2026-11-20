import type { Measurement, MeasurementKind, MeasurementUnit, PatientProgram } from "@/lib/api/types";

/**
 * How the patient app names each kind of measurement, keyed by the API's own
 * list (docs/decisions/tracking.md TRK1 in medora-backend): a kind the API
 * adds fails the type check here until it has words. The API checks ranges;
 * the app only checks that a number was typed.
 */
export const MEASUREMENT_KINDS: Record<MeasurementKind, { label: string; unit: MeasurementUnit; decimals: number }> = {
  weight: { label: "Weight", unit: "kg", decimals: 1 },
  waist: { label: "Waist", unit: "cm", decimals: 1 },
  height: { label: "Height", unit: "cm", decimals: 1 },
  blood_pressure_systolic: { label: "Blood pressure, upper number", unit: "mmHg", decimals: 0 },
  blood_pressure_diastolic: { label: "Blood pressure, lower number", unit: "mmHg", decimals: 0 },
  heart_rate: { label: "Heart rate", unit: "bpm", decimals: 0 },
};

const ORDER = Object.keys(MEASUREMENT_KINDS) as MeasurementKind[];
const BLOOD_PRESSURE: readonly MeasurementKind[] = ["blood_pressure_systolic", "blood_pressure_diastolic"];

function isKind(value: string): value is MeasurementKind {
  return Object.hasOwn(MEASUREMENT_KINDS, value);
}

/**
 * The kinds the patient tracks: those their programs ask for (program data,
 * ADR 0023), and any already recorded for them. Blood pressure is always
 * both numbers, so asking for either, or for "blood_pressure", gives both.
 */
export function kindsToTrack(programs: readonly Pick<PatientProgram, "measurements">[], recorded: readonly Pick<Measurement, "kind">[]): MeasurementKind[] {
  const wanted = new Set<MeasurementKind>(recorded.map((m) => m.kind));
  for (const name of programs.flatMap((p) => p.measurements)) {
    if (name === "blood_pressure" || BLOOD_PRESSURE.includes(name as MeasurementKind)) BLOOD_PRESSURE.forEach((k) => wanted.add(k));
    else if (isKind(name)) wanted.add(name);
  }
  return ORDER.filter((kind) => wanted.has(kind));
}

/** "91.8 kg", "128 mmHg". */
export function formatReading(kind: MeasurementKind, value: number): string {
  const { unit, decimals } = MEASUREMENT_KINDS[kind];
  const number = new Intl.NumberFormat("en-AU", { minimumFractionDigits: decimals, maximumFractionDigits: 1 }).format(value);
  return `${number} ${unit}`;
}

/** Fields the patient fills, the two blood pressure numbers side by side as one. */
export type ReadingGroup = { kind: "single"; measurement: MeasurementKind } | { kind: "blood_pressure" };

export function readingGroups(kinds: readonly MeasurementKind[]): ReadingGroup[] {
  const groups: ReadingGroup[] = [];
  for (const kind of kinds) {
    if (kind === "blood_pressure_diastolic") continue;
    groups.push(kind === "blood_pressure_systolic" ? { kind: "blood_pressure" } : { kind: "single", measurement: kind });
  }
  return groups;
}
