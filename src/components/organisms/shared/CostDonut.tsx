"use client";

import { fmt } from "@/lib/format";

export function CostDonut({
  label,
  total,
  parts,
}: {
  label: string;
  total: number;
  parts: { label: string; value: number; color: string }[];
}) {
  let degree = 0;
  const gradient = parts.map((part) => {
    const start = degree;
    degree += total > 0 ? (part.value / total) * 360 : 0;
    return `${part.color} ${start}deg ${degree}deg`;
  }).join(", ");
  return (
    <div className="grid min-w-0 justify-items-center gap-4 rounded-lg border border-border bg-bg p-5">
      <h3 className="m-0">{label}</h3>
      <div
        className="grid size-44 place-items-center rounded-full inset-ring inset-ring-text-primary/5"
        style={{ background: total ? `conic-gradient(${gradient})` : "var(--color-border)" }}
      >
        <div className="grid size-28 place-items-center rounded-full bg-surface shadow-xs">
          <strong className="text-num-md tabular-nums">฿{fmt(total)}</strong>
          <span className="-mt-6 text-caption text-text-secondary">รวมต้นทุน</span>
        </div>
      </div>
      <div className="grid w-full gap-2.25">
        {parts.map((part) => (
          <div
            key={part.label}
            className="flex justify-between gap-3 text-caption text-text-secondary"
          >
            <span className="flex items-center gap-1.5">
              <i className="size-2.25 rounded-full" style={{ background: part.color }} />
              {part.label}
            </span>
            <strong className="text-text-primary tabular-nums">
              {total ? fmt((part.value / total) * 100) : "0.00"}%
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
