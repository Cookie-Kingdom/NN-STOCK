"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { FieldGroup } from "@/components/molecules/FieldGroup";
import { Notice } from "@/components/molecules/Notice";
import { fmt } from "@/lib/format";
import { validPackWeights } from "@/lib/store";

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
  const validWeights = validPackWeights(value);
  const total = validWeights.reduce((sum, weight) => sum + weight, 0);
  return (
    <FieldGroup
      wide
      className="grid gap-2.5"
      label="น้ำหนักกล่องรมควัน (กก./กล่องรมควัน)"
      hint={
        <span className="-mt-3 block">
          กรอกว่ากล่องรมควันนี้กี่กิโล ทีละกล่องรมควัน หากมีหลายกล่องรมควันให้กด
          “เพิ่มกล่องรมควัน”
        </span>
      }
    >
      {weights.map((weight, index) => (
        <div
          className="grid grid-cols-[90px_minmax(0,1fr)_38px_44px] items-center gap-2.5 rounded-md border border-border bg-bg px-3 py-2.5"
          key={index}
        >
          <span>กล่องรมควันที่ {index + 1}</span>
          <Input
            aria-label={`กล่องรมควันที่ ${index + 1} กี่กิโล`}
            className="mt-0 text-right"
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
            <Button
              variant="text"
              className="p-1"
              onClick={() =>
                onChange(weights.filter((_, row) => row !== index).join(","))
              }
            >
              ลบ
            </Button>
          )}
        </div>
      ))}
      <Button
        variant="secondary"
        className="justify-self-start"
        icon={<Plus />}
        onClick={() => onChange([...weights, ""].join(","))}
      >
        เพิ่มกล่องรมควัน
      </Button>
      <Notice tone="success" role="none" className="my-0">
        ส่งกลับกรุงเทพฯ {validWeights.length} กล่องรมควัน · น้ำหนักรวม{" "}
        {fmt(total)} กก.
      </Notice>
    </FieldGroup>
  );
}
