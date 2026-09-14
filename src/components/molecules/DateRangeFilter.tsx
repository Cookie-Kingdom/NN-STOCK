import type { ReactNode } from "react";
import { Input } from "@/components/atoms/Input";
import { TableFilter } from "@/components/molecules/TableFilter";

/**
 * Two date TableFilters whose min/max bound each other. Renders a fragment so it
 * sits inside a FilterBar next to other filters.
 */
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = "ตั้งแต่",
  toLabel = "ถึง",
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel?: ReactNode;
  toLabel?: ReactNode;
}) {
  return (
    <>
      <TableFilter label={fromLabel}>
        <Input
          variant="filter"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => onFromChange(event.target.value)}
        />
      </TableFilter>
      <TableFilter label={toLabel}>
        <Input
          variant="filter"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => onToChange(event.target.value)}
        />
      </TableFilter>
    </>
  );
}
