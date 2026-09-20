"use client";

import {
  ArrowDownUp,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { IconButton } from "@/components/atoms/IconButton";
import { Select } from "@/components/atoms/Select";
import { TableFilter } from "@/components/molecules/TableFilter";
import { Pagination } from "@/components/molecules/Pagination";
import { TableSection } from "@/components/organisms/shared/TableSection";

const PAGE_SIZE = 20;

/** Only plain text cells can be sorted; a cell holding buttons or badges has no order. */
const cellText = (cell: ReactNode) =>
  typeof cell === "string" || typeof cell === "number" ? String(cell) : "";

const isoDate = /^\d{4}-\d{2}-\d{2}/;
/** A cell that is one number, optionally wrapped in symbols and a unit: "9.00 กก.", "฿1,200.00".
 *  Ids such as "PO-2026-01" start with a letter or hold a second number, so they stay text. */
const numeric = /^[^\p{L}\d]*(-?\d+(?:\.\d+)?)[^\d]*$/u;

/** Numbers compare by value ("9 กก." < "10 กก."), everything else as Thai text.
 *  ISO dates already sort right as text, so they skip the numeric branch. */
export function compareCells(a: string, b: string) {
  if (!isoDate.test(a) && !isoDate.test(b)) {
    const [na, nb] = [a, b].map((value) => {
      const match = value.replace(/,/g, "").match(numeric);
      return match ? Number(match[1]) : Number.NaN;
    });
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  }
  return a.localeCompare(b, "th");
}

export function DataTable({
  title,
  columns,
  rows,
  action,
  rowKeys,
  emptyText = "ยังไม่มีข้อมูล",
  defaultSort,
  className,
}: {
  title: string;
  columns: string[];
  rows: ReactNode[][];
  action?: ReactNode;
  /** Stable React keys, one per row (e.g. lot ids). Falls back to the row index. */
  rowKeys?: readonly string[];
  /** Text of the single row shown when `rows` is empty. */
  emptyText?: ReactNode;
  /** Column the table sorts by on first render, e.g. the date column newest first. */
  defaultSort?: { column: string; desc?: boolean };
  /** Extra classes for the `<section>`, e.g. `m-0` inside a grid. */
  className?: string;
}) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState(() => ({
    column: defaultSort ? columns.indexOf(defaultSort.column) : -1,
    desc: defaultSort?.desc ?? false,
  }));
  const sortable = columns
    .map((_, index) => index)
    .filter((index) => rows.some((row) => cellText(row[index])));
  const order = rows.map((_, index) => index);
  if (sortable.includes(sort.column))
    order.sort(
      (a, b) =>
        compareCells(
          cellText(rows[a][sort.column]),
          cellText(rows[b][sort.column]),
        ) * (sort.desc ? -1 : 1),
    );
  const showSort = rows.length > 1 && sortable.length > 0;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * PAGE_SIZE;
  const visibleOrder = order.slice(start, start + PAGE_SIZE);
  return (
    <TableSection
      title={title}
      count={`${rows.length} แถว`}
      actions={
        (action || showSort) && (
          <div className="flex flex-wrap items-center gap-3 max-md:justify-between">
            {action}
            {showSort && (
              <TableFilter label="เรียงตาม">
                <Select
                  variant="filter"
                  value={sort.column}
                  onChange={(event) =>
                    setSort((current) => ({
                      ...current,
                      column: Number(event.target.value),
                    }))
                  }
                >
                  <option value={-1}>ตามลำดับเดิม</option>
                  {sortable.map((index) => (
                    <option key={index} value={index}>
                      {columns[index]}
                    </option>
                  ))}
                </Select>
                <IconButton
                  size="sm"
                  label={sort.desc ? "เรียงมากไปน้อย" : "เรียงน้อยไปมาก"}
                  disabled={!sortable.includes(sort.column)}
                  icon={
                    !sortable.includes(sort.column) ? (
                      <ArrowDownUp className="size-4" />
                    ) : sort.desc ? (
                      <ArrowDownWideNarrow className="size-4" />
                    ) : (
                      <ArrowUpNarrowWide className="size-4" />
                    )
                  }
                  onClick={() =>
                    setSort((current) => ({ ...current, desc: !current.desc }))
                  }
                />
              </TableFilter>
            )}
          </div>
        )
      }
      className={className}
    >
      <div className="max-w-full overflow-auto overscroll-x-contain">
        {/* No 650px floor on phones: headers are `whitespace-nowrap`, so the table
            still cannot crush, and a narrow one (3–4 columns) then fits the screen
            instead of panning sideways inside the vertical scroll. */}
        <table className="w-full min-w-162.5 border-separate border-spacing-0 tabular-nums max-md:min-w-0">
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={`${index}-${column}`}
                  className="sticky top-0 border-b border-border bg-bg px-4.5 py-3.5 text-left align-middle text-caption font-semibold tracking-[0.03em] whitespace-nowrap text-text-secondary not-first:text-right max-md:px-2.5"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              visibleOrder.map((rowIndex) => (
                <tr
                  key={rowKeys?.[rowIndex] ?? rowIndex}
                  className="hover:bg-bg [&:last-child>td]:border-b-0"
                >
                  {rows[rowIndex].map((cell, j) => (
                    <td
                      key={j}
                      className="border-b border-border px-4.5 py-4 text-left align-middle text-body-sm whitespace-nowrap not-first:text-right max-md:px-2.5"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="p-7 text-center text-body text-text-secondary"
                  colSpan={columns.length}
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={currentPage}
        pageCount={pageCount}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />
    </TableSection>
  );
}
