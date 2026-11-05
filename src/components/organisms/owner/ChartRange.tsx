"use client";

import { useState } from "react";
import { DatePicker } from "@/components/atoms/DatePicker";
import { TableFilter } from "@/components/molecules/TableFilter";

/** A chart's span, `from`..`to` (`YYYY-MM-DD`): the caller's default until one is picked, and
 *  the default again once the caller's changes (the page's period moved on). */
export function useChartRange(from: string, to: string) {
  const base = `${from}~${to}`;
  const [picked, setPicked] = useState({ base, from, to });
  const range = picked.base === base ? picked : { base, from, to };
  return {
    from: range.from,
    to: range.to,
    setFrom: (from: string) => setPicked({ ...range, from }),
    setTo: (to: string) => setPicked({ ...range, to }),
  };
}

/** The two calendars that pick a chart's span (ตั้งแต่ / ถึง), never one past the other, nor
 *  past `max`. */
export function ChartRange({
  range,
  max,
}: {
  range: ReturnType<typeof useChartRange>;
  max?: string;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
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
    </div>
  );
}
