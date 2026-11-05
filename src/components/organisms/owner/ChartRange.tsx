"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { DatePicker } from "@/components/atoms/DatePicker";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
import { TableFilter } from "@/components/molecules/TableFilter";
import { autoStep, type ChartStep } from "@/lib/period";

/** A chart's span, `from`..`to` (`YYYY-MM-DD`), and its step `by` (a bar a day, month or
 *  year; `autoStep` of the span until one is picked): the caller's default until one is
 *  picked, and the default again on `reset` or once the caller's changes (the page's period
 *  moved on). */
export function useChartRange(from: string, to: string) {
  const base = `${from}~${to}`;
  const start = { base, from, to, step: null as ChartStep | null };
  const [picked, setPicked] = useState(start);
  const range = picked.base === base ? picked : start;
  return {
    from: range.from,
    to: range.to,
    by: range.step ?? autoStep(range.from, range.to),
    /** Something differs from the caller's default. */
    changed: range.from !== from || range.to !== to || range.step !== null,
    setFrom: (from: string) => setPicked({ ...range, from }),
    setTo: (to: string) => setPicked({ ...range, to }),
    setBy: (step: ChartStep) => setPicked({ ...range, step }),
    reset: () => setPicked(start),
  };
}

/** What sets a chart: its step (วัน / เดือน / ปี), the two calendars of its span (ตั้งแต่ /
 *  ถึง, never one past the other, nor past `max`) and 「ค่าเริ่มต้น」, back to the page's own. */
export function ChartRange({
  range,
  max,
}: {
  range: ReturnType<typeof useChartRange>;
  max?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
      <SegmentedChoice
        label="แสดงกราฟเป็น"
        value={range.by}
        onChange={range.setBy}
        options={[
          { value: "day", label: "รายวัน" },
          { value: "month", label: "รายเดือน" },
          { value: "year", label: "รายปี" },
        ]}
      />
      <TableFilter label="ตั้งแต่">
        <DatePicker
          variant="filter"
          title="ตั้งแต่วันที่"
          value={range.from}
          max={range.to}
          onChange={range.setFrom}
        />
      </TableFilter>
      <TableFilter label="ถึง">
        <DatePicker
          variant="filter"
          title="ถึงวันที่"
          value={range.to}
          min={range.from}
          max={max}
          onChange={range.setTo}
        />
      </TableFilter>
      {range.changed && (
        <Button
          size="sm"
          icon={<RotateCcw aria-hidden />}
          onClick={range.reset}
        >
          ค่าเริ่มต้น
        </Button>
      )}
    </div>
  );
}
