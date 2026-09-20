import { Badge } from "@/components/atoms/Badge";
import { Input } from "@/components/atoms/Input";
import { today } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The working-date picker ("วันที่ทำรายการ"), shared by the page heading and every
 * form, all bound to the one workspace date. `asField` lays the wrapper out like a
 * FormField, which is how every dialog form opens; a caller's own `className` still
 * wins over it. */
export function WorkingDateField({
  date,
  onDate,
  minDate,
  variant = "form",
  asField = false,
  className,
  inputClassName,
}: {
  date: string;
  onDate: (date: string) => void;
  /** Configured system start date; enforced once it is not in the future (same rule as mutate). */
  minDate?: string;
  variant?: "form" | "filter";
  /** Field typography, field width and the gap before the next block of a dialog form. */
  asField?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  const max = today();
  const min = minDate && minDate <= max ? minDate : undefined;
  // min/max only limit the picker; a typed date still lands here, and mutate would reject it.
  const outOfRange = Boolean(date) && ((min && date < min) || date > max);
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        asField && "mb-4.5 max-w-xs text-body-sm font-medium",
        className,
      )}
    >
      <label className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          วันที่ทำรายการ
          {date && date < max && <Badge tone="warning">บันทึกย้อนหลัง</Badge>}
        </span>
        <Input
          variant={variant}
          className={inputClassName}
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
    </div>
  );
}
