import type { ReactNode } from "react";
import { Select } from "@/components/atoms/Select";
import { TableFilter } from "@/components/molecules/TableFilter";

/**
 * Branch picker for a table's filter bar: a `TableFilter` around a `variant="filter"`
 * `Select`, with `allLabel` ("ทั้งหมด") as the first option. The options carry no
 * `value` attribute, so the option text doubles as the value — `value`/`onChange`
 * deal in branch names, and "all" reads back as the `allLabel` string, not `""`.
 */
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
      <Select
        variant="filter"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option>{allLabel}</option>
        {branches.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </Select>
    </TableFilter>
  );
}
