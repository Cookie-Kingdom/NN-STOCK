"use client";

import { useState } from "react";
import { td, th } from "@/components/organisms/shared/tableCell";
import { baht, qty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FigureTable, Num } from "./PlTable";

export type FlowBar = { label: string; title: string; in: number; out: number };

/** The step of an axis of about four lines over `range`, as `RevenueChart` steps its own. */
function niceStep(range: number) {
  const raw = range / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
}

/** Money in less money out, with its sign: "+฿1,200", "−฿300", "฿0". */
const signed = (x: number) => `${x > 0 ? "+" : ""}${baht(x)}`;
const netTone = (x: number) => (x > 0 ? "in" : x < 0 ? "out" : undefined);

/** Money in and money out of each bucket as a pair of bars on one baht axis (in on the left
 *  and green, out on the right and red), and what is left of the two as a line over them,
 *  which goes below zero when more left than came. Built as `RevenueChart` is: pointing at a
 *  bucket, or the arrow keys while the chart has focus, shows its figures; the table under it
 *  holds them all. */
export function CashFlowChart({
  label,
  unit,
  bars,
}: {
  /** What the chart shows, for a screen reader. */
  label: string;
  /** The head of the table's first column: เดือน. */
  unit: string;
  bars: FlowBar[];
}) {
  const [at, setAt] = useState(-1);
  const nets = bars.map((bar) => bar.in - bar.out);
  const empty = !bars.some((bar) => bar.in || bar.out);
  const all = bars.flatMap((bar, i) => [bar.in, bar.out, nets[i]]);
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
  const active = bars[at];
  // Where the arrow keys start: the newest bucket with money in it.
  const last = Math.max(
    0,
    bars.findLastIndex((bar) => bar.in || bar.out),
  );
  const plot = "h-60 md:h-72";
  const bar =
    "absolute w-[30%] max-w-5 min-w-[3px] rounded-t-sm transition-[height] duration-(--motion-slow) ease-(--ease-enter)";
  const figure = (name: string, text: string, tone?: "in" | "out") => (
    <span className="flex justify-between gap-4">
      <span className="text-text-secondary">{name}</span>
      <b
        className={cn(
          "font-medium",
          tone === "in" && "text-success",
          tone === "out" && "text-danger",
        )}
      >
        {text}
      </b>
    </span>
  );
  return (
    <div className="@container">
      {/* The side of each bar is named too: green and red alone do not tell them apart. */}
      <div className="mb-3 flex flex-wrap gap-x-4.5 gap-y-1 text-caption text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <i className="size-2.5 rounded-[3px] bg-success" />
          เงินเข้า (แท่งซ้าย)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-2.5 rounded-[3px] bg-danger" />
          เงินออก (แท่งขวา)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-0.5 w-4.5 rounded-full bg-text-primary" />
          สุทธิ (เส้น)
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
            {bars.map((flow, i) => (
              <div
                key={i}
                className="relative flex-1"
                onPointerEnter={() => setAt(i)}
              >
                {flow.in > 0 && (
                  <i
                    className={cn(bar, "right-1/2 mr-px bg-success")}
                    style={{
                      bottom: `${y(0)}%`,
                      height: `${y(flow.in) - y(0)}%`,
                    }}
                  />
                )}
                {flow.out > 0 && (
                  <i
                    className={cn(bar, "left-1/2 ml-px bg-danger")}
                    style={{
                      bottom: `${y(0)}%`,
                      height: `${y(flow.out) - y(0)}%`,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          {empty ? (
            <p className="absolute inset-0 m-0 grid place-items-center text-body-sm text-text-secondary">
              ยังไม่มีเงินเข้า–ออกในช่วงนี้
            </p>
          ) : (
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
                  points={nets
                    .map((net, i) => `${x(i)},${100 - y(net)}`)
                    .join(" ")}
                />
              </svg>
              {nets.map((net, i) => (
                <i
                  key={i}
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-text-primary ring-2 ring-surface"
                  style={{ left: `${x(i)}%`, bottom: `${y(net)}%` }}
                />
              ))}
            </>
          )}
          {active && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 grid w-52 gap-0.5 rounded-md border border-border bg-surface px-3 py-2.5 text-caption shadow-md"
              style={{
                // Beside the bucket, on the side with more room, and never past the plot.
                left: `clamp(0px, calc(${x(at)}% ${
                  at < bars.length / 2
                    ? `+ ${50 / bars.length}% + 8px`
                    : `- ${50 / bars.length}% - 8px - 13rem`
                }), calc(100% - 13rem))`,
              }}
            >
              <b className="mb-1 text-body-sm font-semibold">{active.title}</b>
              {figure("เงินเข้า", signed(active.in), netTone(active.in))}
              {figure("เงินออก", baht(-active.out), netTone(-active.out))}
              {figure("สุทธิ", signed(nets[at]), netTone(nets[at]))}
            </div>
          )}
        </div>
        <div aria-hidden className="col-start-2 mt-1.5 flex">
          {bars.map((flow, i) => (
            <span
              key={i}
              className="flex min-w-0 flex-1 justify-center text-caption whitespace-nowrap text-text-secondary"
            >
              {flow.label}
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
                {["เงินเข้า", "เงินออก", "สุทธิ"].map((name) => (
                  <th key={name} className={cn(th, "text-right")}>
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bars.map((flow, i) => (
                <tr key={i}>
                  <td className={td}>{flow.title}</td>
                  <Num tone={netTone(flow.in)}>{signed(flow.in)}</Num>
                  <Num tone={netTone(-flow.out)}>{baht(-flow.out)}</Num>
                  <Num tone={netTone(nets[i])}>{signed(nets[i])}</Num>
                </tr>
              ))}
            </tbody>
          </FigureTable>
        </div>
      </details>
    </div>
  );
}
