"use client";

import { fmt } from "@/lib/format";

export function SalesBars({
  data,
  branch,
  colorClass,
  max,
}: {
  data: { date: string; sala: number; minburi: number }[];
  branch: "sala" | "minburi";
  colorClass: string;
  max: number;
}) {
  return (
    <div className="bar-chart-wrap" aria-label="กราฟยอดขายรายวัน">
      <div className="chart-y-axis" aria-hidden="true">
        <span>฿{fmt(max)}</span>
        <span>฿{fmt(max * 0.75)}</span>
        <span>฿{fmt(max * 0.5)}</span>
        <span>฿{fmt(max * 0.25)}</span>
        <span>฿0</span>
      </div>
      <div
        className="bar-chart single-series detailed-chart"
        style={{
          gridTemplateColumns: `repeat(${data.length}, minmax(46px, 1fr))`,
          minWidth: `${Math.max(400, data.length * 58)}px`,
        }}
      >
        {data.map((item) => {
          const value = item[branch];
          return (
            <div className="bar-day" key={item.date}>
              <div className="bar-value">฿{fmt(value)}</div>
              <div className="bar-stack">
                <div className={`bar-segment ${colorClass}`} style={{ height: `${(value / max) * 100}%` }} />
              </div>
              <span>{item.date.slice(8)}/{item.date.slice(5, 7)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
