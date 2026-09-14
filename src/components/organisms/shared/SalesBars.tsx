"use client";

import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

/** `colorClass` values callers pass today (the old `.bar-segment.sala|minburi`). */
const segmentColors: Record<string, string> = {
  sala: "bg-linear-to-b from-warning/75 to-warning",
  minburi: "bg-linear-to-b from-accent/65 to-accent",
};

const axisSteps = [1, 0.75, 0.5, 0.25];

export function SalesBars({
  data,
  branch,
  colorClass,
  max,
}: {
  data: { date: string; sala: number; minburi: number }[];
  branch: "sala" | "minburi";
  /** `"sala"` / `"minburi"`, or any Tailwind background classes. */
  colorClass: string;
  max: number;
}) {
  return (
    <div
      className="mt-4.5 grid min-w-0 grid-cols-[76px_minmax(0,1fr)] items-start"
      aria-label="กราฟยอดขายรายวัน"
    >
      <div
        className="box-border grid h-61.25 grid-rows-5 pt-4.5 pr-2 pb-7 text-right text-caption text-text-secondary tabular-nums"
        aria-hidden="true"
      >
        {axisSteps.map((step) => (
          <span key={step}>฿{fmt(max * step)}</span>
        ))}
        <span>฿0</span>
      </div>
      <div
        className="relative grid h-61.25 items-end gap-[clamp(6px,1vw,12px)] border-b border-border-strong bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_54px,var(--color-surface-sunken)_55px)] px-2 pt-6"
        style={{
          gridTemplateColumns: `repeat(${data.length}, minmax(46px, 1fr))`,
          minWidth: `${Math.max(400, data.length * 58)}px`,
        }}
      >
        {data.map((item) => {
          const value = item[branch];
          return (
            <div className="grid h-full grid-rows-[22px_175px_28px] items-end text-center" key={item.date}>
              <div className="text-caption font-bold text-text-secondary tabular-nums">
                ฿{fmt(value)}
              </div>
              <div className="flex h-42.5 flex-col-reverse items-stretch justify-start overflow-hidden rounded-t-md rounded-b-xs bg-surface-sunken">
                <div
                  className={cn("min-h-0.5", segmentColors[colorClass] ?? colorClass)}
                  style={{ height: `${(value / max) * 100}%` }}
                />
              </div>
              <span className="pt-2 text-caption text-text-secondary tabular-nums">
                {item.date.slice(8)}/{item.date.slice(5, 7)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
