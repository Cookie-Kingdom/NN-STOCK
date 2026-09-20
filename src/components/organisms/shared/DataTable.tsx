"use client";

import {
  ArrowDownUp,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
} from "lucide-react";
import { isValidElement, type ReactNode, useState } from "react";
import { IconButton } from "@/components/atoms/IconButton";
import { Select } from "@/components/atoms/Select";
import { TableFilter } from "@/components/molecules/TableFilter";
import { Pagination } from "@/components/molecules/Pagination";
import { TableSection } from "@/components/organisms/shared/TableSection";

const PAGE_SIZE = 20;

/** Text of a cell, reading through plain markup such as `<strong>{poId}</strong>`.
 *  A cell built from a component (a badge, a button row) has no order and stays out. */
function cellText(cell: ReactNode): string {
  if (typeof cell === "string" || typeof cell === "number") return String(cell);
  if (Array.isArray(cell)) return cell.map(cellText).join("");
  if (isValidElement(cell) && typeof cell.type === "string")
    return cellText((cell.props as { children?: ReactNode }).children);
  return "";
}

const isoDate = /^\d{4}-\d{2}-\d{2}/;
/** A cell that is one number, optionally wrapped in symbols and a unit: "9.00 กก.", "฿1,200.00".
 *  Ids such as "PO-2026-01" start with a letter or hold a second number, so they stay text. */
const numeric = /^[^\p{L}\d]*(-?\d+(?:\.\d+)?)[^\d]*$/u;

/** A cell that carries a date: an ISO date ("2026-01-05") or a lot id ("F260105-001").
 *  Both already sort chronologically as text. */
const dated = /^(\d{4}-\d{2}-\d{2}|F\d{6}-\d{3})/;

/** First column holding dates, or -1. A table with no `defaultSort` uses it so that
 *  every table starts newest first without touching its call site. */
export function datedColumn(rows: ReactNode[][]) {
  return (rows[0] ?? []).findIndex((_, index) =>
    rows.some((row) => dated.test(cellText(row[index]))),
  );
}

/** A cell that says nothing about its column's type: empty, or a dash standing in
 *  for a missing value. It must not drag a column of numbers over to the left. */
const blank = /^[\s—–-]*$/;

/** Alignment per column: numbers sit right so their digits line up, text sits left.
 *  A column with no text at all is the action column at the end of the row and sits
 *  right too. Headers reuse the same class, so a header never floats away from the
 *  column it names. */
export function columnAlign(columns: string[], rows: ReactNode[][]) {
  return columns.map((_, index) => {
    const texts = rows
      .map((row) => cellText(row[index]))
      .filter((text) => !blank.test(text));
    if (!texts.length)
      return index === columns.length - 1 ? "text-right" : "text-left";
    return texts.every((text) => numeric.test(text.replace(/,/g, "")))
      ? "text-right"
      : "text-left";
  });
}

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
  const align = columnAlign(columns, rows);
  // ponytail: kept out of state so the fallback still finds its column once rows load.
  const [chosen, setChosen] = useState<{
    column: number;
    desc: boolean;
  } | null>(null);
  const dateColumn = datedColumn(rows);
  const auto = defaultSort
    ? {
        column: columns.indexOf(defaultSort.column),
        desc: defaultSort.desc ?? false,
      }
    : { column: dateColumn, desc: dateColumn >= 0 };
  const sort = chosen ?? auto;
  const setSort = (next: (current: typeof sort) => typeof sort) =>
    setChosen(next(sort));
  const sortable = columns
    .map((_, index) => index)
    .filter((index) => rows.some((row) => cellText(row[index])));
  const order = rows.map((_, index) => index);
  if (sortable.includes(sort.column))
    // Rows arrive oldest first, so equal keys (a date column with no time in it)
    // break by row order — descending then puts the latest entry on top.
    order.sort(
      (a, b) =>
        (compareCells(
          cellText(rows[a][sort.column]),
          cellText(rows[b][sort.column]),
        ) || a - b) * (sort.desc ? -1 : 1),
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
                  className={`sticky top-0 border-b border-border bg-bg px-4.5 py-3.5 align-middle text-caption font-semibold tracking-[0.03em] whitespace-nowrap text-text-secondary max-md:px-2.5 ${align[index]}`}
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
                      className={`border-b border-border px-4.5 py-4 align-middle text-body-sm whitespace-nowrap max-md:px-2.5 ${align[j]}`}
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
