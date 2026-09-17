import type { ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Overline } from "@/components/atoms/Overline";
import { Muted } from "@/components/atoms/Text";
import { today } from "@/lib/format";

/** Tab title block with the working-date picker on the right. */
export function PageHeading({
  overline,
  title,
  description,
  date,
  onDate,
  minDate,
}: {
  overline: ReactNode;
  title: ReactNode;
  description: ReactNode;
  date: string;
  onDate: (date: string) => void;
  /** Configured system start date; enforced once it is not in the future (same rule as mutate). */
  minDate?: string;
}) {
  const max = today();
  const min = minDate && minDate <= max ? minDate : undefined;
  // min/max only limit the picker; a typed date still lands here, and mutate would reject it.
  const outOfRange = Boolean(date) && ((min && date < min) || date > max);
  return (
    <div className="mb-6 flex items-center justify-between gap-5 max-md:items-start max-md:gap-2.5">
      <div>
        <Overline>{overline}</Overline>
        <h1 className="my-1.5 text-h1">{title}</h1>
        <Muted className="max-md:max-w-55 max-md:text-caption">
          {description}
        </Muted>
      </div>
      <div className="flex flex-col gap-1 text-caption text-text-secondary">
        <label className="flex flex-col gap-1">
          วันที่ทำรายการ
          <Input
            variant="filter"
            className="min-w-0 rounded-md p-2 max-md:max-w-34"
            aria-label="วันที่ทำรายการ"
            type="date"
            value={date}
            min={min}
            max={max}
            onChange={(e) => onDate(e.target.value)}
          />
        </label>
        {outOfRange && (
          <p role="alert" className="max-w-55 text-caption text-danger">
            วันที่อยู่นอกช่วงที่บันทึกได้ ({min ?? "…"} – {max})
          </p>
        )}
        <Button
          variant="text"
          className="justify-end"
          onClick={() => onDate(today())}
        >
          ใช้วันนี้
        </Button>
      </div>
    </div>
  );
}
