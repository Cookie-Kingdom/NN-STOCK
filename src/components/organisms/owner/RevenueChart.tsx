"use client";

import { useState } from "react";
import { td, th } from "@/components/organisms/shared/tableCell";
import { baht, qty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FigureTable, Num } from "./PlTable";

export type ChartBar = {
  label: string;
  title: string;
  /** Null: not reached yet (a day or a month after today). */
  value: number | null;
  /** The figure the bar is read against, when there is one. */
  mark: number | null;
  /** The share of `value` that is drawn as a second tone at the top of the bar (other income
   *  over the sales), when the chart is given a `partName`. */
  part?: number | null;
};

/** The second tone of a bar: the accent thinned over the surface, opaque so the grid lines do
 *  not show through it. */
const partTone =
  "bg-[color-mix(in_oklab,var(--color-accent)_45%,var(--color-surface))]";

/** The step of an axis of about four lines over `range`: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(range: number) {
  const raw = range / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
}

/** Bars of baht over a period, each read against a mark on the same axis: a tick across the
 *  bar (`markAs="tick"`: the same day of the month before) or a line over the bars
 *  (`markAs="line"`: the profit, which may go below zero). With `partName`, the `part` of a
 *  bar is its top, in a lighter tone, and the legend, the read-out and the table name both
 *  halves (never the tone alone); a chart with no part anywhere is drawn as without it.
 *  Pointing at a bar, or the arrow
 *  keys while the chart has focus, shows its figures; the table under it holds them all. */
export function RevenueChart({
  label,
  unit,
  bars,
  name,
  markName,
  markAs,
  baseName,
  partName,
}: {
  /** What the chart shows, for a screen reader. */
  label: string;
  /** The head of the table's first column: วันที่, เดือน. */
  unit: string;
  bars: ChartBar[];
  name: string;
  markName: string;
  markAs: "tick" | "line";
  /** What a bar is without its `part` (ยอดขาย) and what the part is (รายได้อื่น). */
  baseName?: string;
  partName?: string;
}) {
  const [at, setAt] = useState(-1);
  const all = bars.flatMap((bar) => [bar.value ?? 0, bar.mark ?? 0]);
  const high = Math.max(100, ...all);
  const low = Math.min(0, ...all);
  const step = niceStep(high - low);
  const top = Math.ceil(high / step) * step;
  const bottom = Math.floor(low / step) * step;
  const y = (value: number) => ((value - bottom) / (top - bottom)) * 100;
  const x = (index: number) => ((index + 0.5) / bars.length) * 100;
  const lines = Array.from(
    { length: Math.round((top - bottom) / step) + 1 },
    (_, i) => bottom + i * step,
  );
  const marked = bars
    .map((bar, i) => ({ mark: bar.mark, i }))
    .filter(
      (point): point is { mark: number; i: number } => point.mark !== null,
    );
  const part = (bar: ChartBar) =>
    partName && bar.value && bar.part && bar.part > 0
      ? Math.min(bar.part, bar.value)
      : 0;
  const split = bars.some(part);
  const active = bars[at];
  const last = bars.findLastIndex((bar) => bar.value !== null);
  const plot = "h-60 md:h-72";
  return (
    <div className="@container">
      <div className="mb-3 flex flex-wrap gap-x-4.5 gap-y-1 text-caption text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <i className="size-2.5 rounded-[3px] bg-accent" />
          {(split && baseName) || name}
        </span>
        {split && (
          <span className="inline-flex items-center gap-1.5">
            <i className={cn("size-2.5 rounded-[3px]", partTone)} />
            {partName}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <i
            className={cn(
              "h-0.5 rounded-full bg-text-primary",
              markAs === "tick" ? "w-3.5" : "w-4.5",
            )}
          />
          {markName}
        </span>
      </div>
      <div
        role="group"
        aria-label={label}
        tabIndex={0}
        className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 rounded-md pt-2.5 outline-offset-4 outline-focus-ring focus-visible:outline-2"
        onBlur={() => setAt(-1)}
        onKeyDown={(event) => {
          const by =
            event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
          if (!by) return;
          event.preventDefault();
          setAt(
            at < 0 ? last : Math.max(0, Math.min(bars.length - 1, at + by)),
          );
        }}
      >
        <div
          aria-hidden
          className={cn(plot, "flex flex-col-reverse justify-between")}
        >
          {lines.map((value) => (
            <span
              key={value}
              className="flex h-0 items-center justify-end text-caption text-text-secondary"
            >
              {qty(value)}
            </span>
          ))}
        </div>
        <div
          className={cn(plot, "relative touch-pan-y")}
          onPointerLeave={() => setAt(-1)}
        >
          {lines.map((value) => (
            <i
              key={value}
              className={cn(
                "absolute inset-x-0 border-t",
                value === 0 ? "border-border-strong" : "border-border",
              )}
              style={{ bottom: `${y(value)}%` }}
            />
          ))}
          {active && (
            <i
              className="absolute inset-y-0 rounded-sm bg-surface-sunken"
              style={{
                left: `${(at / bars.length) * 100}%`,
                width: `${100 / bars.length}%`,
              }}
            />
          )}
          <div className="absolute inset-0 flex">
            {bars.map((bar, i) => (
              <div
                key={i}
                className="relative flex-1"
                onPointerEnter={() => setAt(i)}
              >
                {!!bar.value && (
                  <i
                    className="absolute left-1/2 w-[64%] max-w-8.5 min-w-[3px] -translate-x-1/2 rounded-t-sm bg-accent transition-[height] duration-(--motion-slow) ease-(--ease-enter)"
                    style={{
                      bottom: `${y(0)}%`,
                      height: `${y(bar.value) - y(0)}%`,
                    }}
                  />
                )}
                {!!part(bar) && (
                  <i
                    className={cn(
                      "absolute left-1/2 w-[64%] max-w-8.5 min-w-[3px] -translate-x-1/2 rounded-t-sm border-b border-surface transition-[height,bottom] duration-(--motion-slow) ease-(--ease-enter)",
                      partTone,
                    )}
                    style={{
                      bottom: `${y(bar.value! - part(bar))}%`,
                      height: `${y(bar.value!) - y(bar.value! - part(bar))}%`,
                    }}
                  />
                )}
                {markAs === "tick" && !!bar.mark && (
                  <i
                    className="absolute left-1/2 h-0.5 w-[82%] max-w-10.5 min-w-1.5 -translate-x-1/2 rounded-full bg-text-primary"
                    style={{ bottom: `calc(${y(bar.mark)}% - 1px)` }}
                  />
                )}
              </div>
            ))}
          </div>
          {markAs === "line" && (
            <>
              <svg
                aria-hidden
                className="pointer-events-none absolute inset-0 size-full overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <polyline
                  className="fill-none stroke-text-primary"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  points={marked
                    .map(({ mark, i }) => `${x(i)},${100 - y(mark)}`)
                    .join(" ")}
                />
              </svg>
              {marked.map(({ mark, i }) => (
                <i
                  key={i}
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-text-primary ring-2 ring-surface"
                  style={{ left: `${x(i)}%`, bottom: `${y(mark)}%` }}
                />
              ))}
            </>
          )}
          {!bars.some((bar) => bar.value) && (
            <p className="absolute inset-0 m-0 grid place-items-center text-body-sm text-text-secondary">
              ยังไม่มีรายได้ในช่วงนี้
            </p>
          )}
          {active && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 grid w-52 gap-0.5 rounded-md border border-border bg-surface px-3 py-2.5 text-caption shadow-md"
              style={{
                // Beside the bar, on the side with more room, and never past the plot.
                left: `clamp(0px, calc(${x(at)}% ${
                  at < bars.length / 2
                    ? `+ ${50 / bars.length}% + 8px`
                    : `- ${50 / bars.length}% - 8px - 13rem`
                }), calc(100% - 13rem))`,
              }}
            >
              <b className="mb-1 text-body-sm font-semibold">{active.title}</b>
              {active.value === null ? (
                <span className="text-text-secondary">ยังไม่ถึง</span>
              ) : (
                <>
                  <span className="flex justify-between gap-4">
                    <span className="text-text-secondary">{name}</span>
                    <b className="font-medium">{baht(active.value)}</b>
                  </span>
                  {!!part(active) && (
                    <>
                      <span className="flex justify-between gap-4">
                        <span className="text-text-secondary">
                          {baseName ?? name}
                        </span>
                        <span>{baht(active.value - part(active))}</span>
                      </span>
                      <span className="flex justify-between gap-4">
                        <span className="text-text-secondary">{partName}</span>
                        <span>{baht(part(active))}</span>
                      </span>
                    </>
                  )}
                  {active.mark !== null && (
                    <span className="flex justify-between gap-4">
                      <span className="text-text-secondary">{markName}</span>
                      <b
                        className={cn(
                          "font-medium",
                          active.mark < 0 && "text-danger",
                        )}
                      >
                        {baht(active.mark)}
                      </b>
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <div aria-hidden className="col-start-2 mt-1.5 flex">
          {bars.map((bar, i) => (
            <span
              key={i}
              className={cn(
                "flex min-w-0 flex-1 justify-center text-caption whitespace-nowrap text-text-secondary",
                // A month of days: every fifth one where a bar is narrower than its number.
                bars.length > 12 &&
                  i > 0 &&
                  (i + 1) % 5 > 0 &&
                  "invisible @3xl:visible",
              )}
            >
              {bar.label}
            </span>
          ))}
        </div>
      </div>
      <details className="group mt-2">
        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center rounded-sm text-body-sm font-medium text-accent outline-focus-ring focus-visible:outline-2 pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">ดูเป็นตาราง</span>
          <span className="hidden group-open:inline">ซ่อนตาราง</span>
        </summary>
        <div className="-mx-5 max-md:-mx-2.5">
          <FigureTable>
            <thead>
              <tr>
                <th className={th}>{unit}</th>
                <th className={cn(th, "text-right")}>{name}</th>
                {split && <th className={cn(th, "text-right")}>{partName}</th>}
                <th className={cn(th, "text-right")}>{markName}</th>
              </tr>
            </thead>
            <tbody>
              {bars.map(
                (bar, i) =>
                  bar.value !== null && (
                    <tr key={i}>
                      <td className={td}>{bar.title}</td>
                      <Num>{baht(bar.value)}</Num>
                      {split && <Num>{part(bar) ? baht(part(bar)) : "—"}</Num>}
                      <Num>{bar.mark === null ? "—" : baht(bar.mark)}</Num>
                    </tr>
                  ),
              )}
            </tbody>
          </FigureTable>
        </div>
      </details>
    </div>
  );
}
