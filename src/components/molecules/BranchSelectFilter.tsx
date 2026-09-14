import type { ReactNode } from "react";
import { Select } from "@/components/atoms/Select";
import { TableFilter } from "@/components/molecules/TableFilter";

/** Branch `<select>` with a leading "ทั้งหมด" option (option text doubles as value). */
export function BranchSelectFilter({
  value,
  onChange,
  branches,
  label = "สาขา",
  allLabel = "ทั้งหมด",
}: {
  value: string;
  onChange: (value: string) => void;
  branches: readonly string[];
  label?: ReactNode;
  allLabel?: string;
}) {
  return (
    <TableFilter label={label}>
      <Select variant="filter" value={value} onChange={(event) => onChange(event.target.value)}>
        <option>{allLabel}</option>
        {branches.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </Select>
    </TableFilter>
  );
}
