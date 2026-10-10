"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { Caption } from "@/components/atoms/Text";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
import { baht } from "@/lib/format";
import { revenuePeriod, shiftKey } from "@/lib/period";
import { liveEntries, type Database } from "@/lib/store";
import { cn } from "@/lib/utils";
import { percent, share } from "./PlTable";

/* The small pieces the shop's Overview, the project's Overview and Finance draw with. No page
 * layout lives here: each page lays out its own sections, so a change to one page's sections
 * never reaches another page. */

/** How a figure moved against the like-for-like span before it: green up, red down, and
 *  never the colour alone (an arrow and a word). `versus` names that span. */
export function Delta({
  now,
  before,
  versus,
}: {
  now: number;
  before: number;
  versus?: string;
}) {
  const chip =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-body-sm font-medium whitespace-nowrap [&>svg]:size-3.5";
  if (!before)
    return now ? (
      <span className={cn(chip, "bg-surface-sunken text-text-secondary")}>
        ช่วงก่อนไม่มีรายได้
      </span>
    ) : null;
  const change = ((now - before) / before) * 100;
  const up = change >= 0;
  return (
    <span
      className={cn(
        chip,
        up ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger",
      )}
    >
      {up ? <ArrowUpRight /> : <ArrowDownRight />}
      {up ? "เพิ่ม" : "ลด"} {percent(Math.abs(change))} {versus}
    </span>
  );
}

/** Rows of a name, a figure and a bar as long as its share of the longest. */
export function Bars({
  total,
  rows,
}: {
  total: number;
  rows: { name: string; value: number; note?: string }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="grid gap-3.5 px-5 py-4 max-md:px-4">
      {rows.map((row) => (
        <div key={row.name}>
          <div className="flex items-baseline justify-between gap-3 text-body-sm">
            <span>{row.name}</span>
            <span className="font-semibold whitespace-nowrap">
              {baht(row.value)}{" "}
              <Caption as="span">{share(row.value, total)}</Caption>
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-text-secondary transition-[width] duration-(--motion-slow) ease-(--ease-enter)"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
          {row.note && <Caption className="mt-1 block">{row.note}</Caption>}
        </div>
      ))}
    </div>
  );
}

/** The period a page shows, a month or a year, and the control that picks it: month or year,
 *  then back and forward, never before the first live entry nor past today's. Opens on this
 *  month. */
export function usePeriod(db: Database, today: string) {
  const [view, setView] = useState<"month" | "year">("month");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(today.slice(0, 4));
  const key = view === "month" ? month : year;
  const step = (by: number) =>
    view === "month"
      ? setMonth(shiftKey(month, by))
      : setYear(shiftKey(year, by));
  const first = liveEntries(db).reduce(
    (a, e) => (e.date < a ? e.date : a),
    today,
  );
  const current = key === today.slice(0, key.length);
  const period = revenuePeriod(key, today);
  const span = view === "month" ? "เดือน" : "ปี";
  return {
    view,
    key,
    /** เดือน or ปี. */
    span,
    /** The period that holds today. */
    current,
    period,
    control: (
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedChoice
          label="ช่วงเวลา"
          value={view}
          onChange={setView}
          options={[
            { value: "month", label: "เดือน" },
            { value: "year", label: "ปี" },
          ]}
        />
        <div className="inline-flex items-center rounded-md border border-border bg-surface max-md:flex-1 max-md:justify-between">
          <IconButton
            label={`${span}ก่อนหน้า`}
            icon={<ChevronLeft />}
            disabled={shiftKey(key, -1) < first.slice(0, key.length)}
            onClick={() => step(-1)}
          />
          <output
            aria-live="polite"
            className="min-w-38 text-center text-body-sm font-medium"
          >
            {period.name}
          </output>
          <IconButton
            label={`${span}ถัดไป`}
            icon={<ChevronRight />}
            disabled={current}
            onClick={() => step(1)}
          />
        </div>
      </div>
    ),
  };
}
