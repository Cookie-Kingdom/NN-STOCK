"use client";

import { useState, type ReactNode } from "react";
import { Select } from "@/components/atoms/Select";
import { TableFilter } from "@/components/molecules/TableFilter";

export type SortOption<T> = {
  label: string;
  /** Sort key. ponytail: compared as text — document ids and ISO dates both sort right. */
  by: (item: T) => string;
  desc?: boolean;
};

/** Sort dropdown for a `DataTable`: returns the sorted rows and the control to pass as `action`.
 *  The first option is the default, so list the newest-first one there. */
export function useTableSort<T>(
  items: readonly T[],
  options: SortOption<T>[],
): [T[], ReactNode] {
  const [index, setIndex] = useState(0);
  const option = options[index] ?? options[0];
  const sorted = [...items].sort((a, b) => {
    const order = option.by(a).localeCompare(option.by(b));
    return option.desc ? -order : order;
  });
  return [
    sorted,
    <TableFilter label="เรียงตาม" key="sort">
      <Select
        variant="filter"
        value={index}
        onChange={(event) => setIndex(Number(event.target.value))}
      >
        {options.map((item, i) => (
          <option key={item.label} value={i}>
            {item.label}
          </option>
        ))}
      </Select>
    </TableFilter>,
  ];
}
