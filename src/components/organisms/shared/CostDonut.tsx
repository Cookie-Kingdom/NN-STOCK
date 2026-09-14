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
    <div className="cost-unit">
      <h3>{label}</h3>
      <div className="donut" style={{ background: total ? `conic-gradient(${gradient})` : "#e5e7eb" }}>
        <div><strong>฿{fmt(total)}</strong><span>รวมต้นทุน</span></div>
      </div>
      <div className="cost-legend">
        {parts.map((part) => (
          <div key={part.label}><span><i style={{ background: part.color }} />{part.label}</span><strong>{total ? fmt((part.value / total) * 100) : "0.00"}%</strong></div>
        ))}
      </div>
    </div>
  );
}
