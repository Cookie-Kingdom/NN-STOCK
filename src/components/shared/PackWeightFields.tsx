"use client";

import { Plus } from "lucide-react";
import { fmt } from "@/lib/format";

export function PackWeightFields({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const weights = value === "" ? [""] : value.split(",");
  const update = (index: number, next: string) => {
    const rows = [...weights];
    rows[index] = next;
    onChange(rows.join(","));
  };
  const validWeights = weights.map(Number).filter((weight) => Number.isFinite(weight) && weight > 0);
  const total = validWeights.reduce((sum, weight) => sum + weight, 0);
  return (
    <div className="field wide pack-weight-editor">
      <span>น้ำหนักถุงใหญ่จาก Chef_house</span>
      <small>กรอกน้ำหนักจริงทีละถุง หากมีหลายถุงให้กด “เพิ่มถุง”</small>
      {weights.map((weight, index) => (
        <div className="pack-weight-row" key={index}>
          <span>ถุงที่ {index + 1}</span>
          <input
            aria-label={`น้ำหนักถุงที่ ${index + 1}`}
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            value={weight}
            onChange={(event) => update(index, event.target.value)}
          />
          <span>กก.</span>
          {weights.length > 1 && (
            <button
              type="button"
              className="text-button"
              onClick={() => onChange(weights.filter((_, row) => row !== index).join(","))}
            >
              ลบ
            </button>
          )}
        </div>
      ))}
      <button type="button" className="secondary add-pack-button" onClick={() => onChange([...weights, ""].join(","))}>
        <Plus size={16} /> เพิ่มถุง
      </button>
      <div className="notice success pack-summary">
        ส่งกลับกรุงเทพฯ {validWeights.length} ถุง · น้ำหนักรวม {fmt(total)} กก.
      </div>
    </div>
  );
}
