"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Measurement, MeasurementKind } from "@/lib/api/types";
import { formatShortDay } from "@/lib/format";
import { MEASUREMENT_KINDS, formatReading } from "@/lib/measurement-kinds";
import { dateIn, formatDateTimeIn } from "@/lib/patient-time";

/**
 * One kind of measurement over time: a single 2px line in the first chart
 * colour with 8px ringed markers on a hairline grid, one axis, and no
 * legend (the card's title names the series). A crosshair finds the nearest
 * reading under the pointer, and the arrow keys walk the readings for the
 * keyboard; every value is also in the table below the chart.
 */

const HEIGHT = 200;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };
/** Past this many readings only the latest keeps its marker. */
const MARKER_LIMIT = 60;

interface Point {
  x: number;
  y: number;
  reading: Measurement;
}

export function MeasurementChart({ kind, readings, timeZone }: { kind: MeasurementKind; readings: readonly Measurement[]; timeZone: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const readoutId = useId();
  const { label } = MEASUREMENT_KINDS[kind];

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry?.contentRect.width ?? 0)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const oldestFirst = useMemo(() => [...readings].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)), [readings]);
  const plot = useMemo(() => layout(oldestFirst, width, timeZone), [oldestFirst, width, timeZone]);
  const current = active == null || !plot ? null : (plot.points[active] ?? null);

  function nearest(clientX: number) {
    if (!plot || !box.current) return;
    const x = clientX - box.current.getBoundingClientRect().left;
    let best = 0;
    plot.points.forEach((point, index) => {
      if (Math.abs(point.x - x) < Math.abs((plot.points[best]?.x ?? Infinity) - x)) best = index;
    });
    setActive(best);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!plot) return;
    const last = plot.points.length - 1;
    const from = active ?? last;
    const to = { ArrowLeft: from - 1, ArrowRight: from + 1, Home: 0, End: last }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    setActive(Math.min(Math.max(to, 0), last));
  }

  const first = oldestFirst[0];
  const latest = oldestFirst.at(-1);
  const summary =
    first && latest
      ? `${label} over time: ${oldestFirst.length} ${oldestFirst.length === 1 ? "reading" : "readings"} from ${formatShortDay(dateIn(new Date(first.measuredAt), timeZone))} to ${formatShortDay(dateIn(new Date(latest.measuredAt), timeZone))}. Use the left and right arrow keys to read each one.`
      : label;

  return (
    <div
      ref={box}
      className="pt-chart"
      tabIndex={0}
      role="group"
      aria-roledescription="chart"
      aria-label={summary}
      aria-describedby={current ? readoutId : undefined}
      onPointerMove={(event) => nearest(event.clientX)}
      onPointerLeave={() => setActive(null)}
      onFocus={() => setActive((index) => index ?? (plot ? plot.points.length - 1 : null))}
      onBlur={() => setActive(null)}
      onKeyDown={onKeyDown}
    >
      {plot ? (
        <svg width={width} height={HEIGHT} aria-hidden focusable="false">
          {plot.yTicks.map((tick) => (
            <g key={tick.value}>
              <line className="pt-chart-grid" x1={PAD.left} x2={width - PAD.right} y1={tick.y} y2={tick.y} />
              <text className="pt-chart-tick" x={PAD.left - 8} y={tick.y} textAnchor="end" dominantBaseline="middle">
                {tick.label}
              </text>
            </g>
          ))}
          {plot.xTicks.map((tick) => (
            <text key={tick.label} className="pt-chart-tick" x={tick.x} y={HEIGHT - 8} textAnchor={tick.anchor}>
              {tick.label}
            </text>
          ))}
          {current ? <line className="pt-chart-crosshair" x1={current.x} x2={current.x} y1={PAD.top} y2={HEIGHT - PAD.bottom} /> : null}
          {plot.points.length > 1 ? <path className="pt-chart-line" d={plot.path} /> : null}
          {plot.points.map((point, index) =>
            plot.points.length <= MARKER_LIMIT || index === plot.points.length - 1 || index === active ? (
              <circle key={point.reading.measurementId} className="pt-chart-dot" cx={point.x} cy={point.y} r={index === active ? 6 : 4} />
            ) : null,
          )}
        </svg>
      ) : (
        <div className="pt-chart-space" />
      )}
      {current ? (
        <div id={readoutId} className={`pt-chart-tip ${tipSide(current.x, width)}`} style={{ left: current.x }} aria-live="polite">
          <strong>{formatReading(kind, current.reading.value)}</strong>
          <span>{formatDateTimeIn(current.reading.measuredAt, timeZone)}</span>
          {current.reading.recordedBy === "care_team" ? <span>Recorded by your care team</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** The tooltip sits over its reading, kept inside the chart at the edges. */
function tipSide(x: number, width: number): string {
  if (x < 90) return "is-start";
  if (x > width - 90) return "is-end";
  return "";
}

function layout(readings: readonly Measurement[], width: number, timeZone: string) {
  if (width < PAD.left + PAD.right + 40 || readings.length === 0) return null;
  const times = readings.map((r) => Date.parse(r.measuredAt));
  const values = readings.map((r) => r.value);
  let [tMin, tMax] = [Math.min(...times), Math.max(...times)];
  if (tMin === tMax) [tMin, tMax] = [tMin - 86_400_000, tMax + 86_400_000];
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const vMin = ticks[0] ?? 0;
  const vMax = ticks.at(-1) ?? vMin + 1;
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - tMin) / (tMax - tMin)) * plotWidth;
  const y = (v: number) => PAD.top + (1 - (v - vMin) / (vMax - vMin)) * plotHeight;

  const points: Point[] = readings.map((reading) => ({ x: x(Date.parse(reading.measuredAt)), y: y(reading.value), reading }));
  const decimals = ticks.some((t) => !Number.isInteger(t)) ? 1 : 0;
  const day = (t: number) => formatShortDay(dateIn(new Date(t), timeZone));
  const xTicks: { x: number; label: string; anchor: "start" | "middle" | "end" }[] = [{ x: PAD.left, label: day(tMin), anchor: "start" }];
  if (plotWidth > 360) xTicks.push({ x: PAD.left + plotWidth / 2, label: day((tMin + tMax) / 2), anchor: "middle" });
  xTicks.push({ x: width - PAD.right, label: day(tMax), anchor: "end" });

  return {
    points,
    path: points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(""),
    yTicks: ticks.map((value) => ({ value, y: y(value), label: value.toFixed(decimals) })),
    xTicks: xTicks.filter((tick, i, all) => all.findIndex((t) => t.label === tick.label) === i),
  };
}

/** Three to five clean values (steps of 1, 2 or 5 times a power of ten) spanning min to max. */
export function niceTicks(min: number, max: number): number[] {
  const [lo, hi] = min === max ? [min - 1, max + 1] : [min, max];
  const raw = (hi - lo) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((f) => f * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const places = Math.max(0, -Math.floor(Math.log10(step)));
  const ticks: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) ticks.push(Number(v.toFixed(places)));
  return ticks;
}
