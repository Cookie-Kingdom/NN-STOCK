"use client";

import { type ReactNode, useState } from "react";
import { Pagination } from "@/components/molecules/Pagination";
import { TableSection } from "@/components/organisms/shared/TableSection";

const PAGE_SIZE = 20;

export function DataTable({
  title,
  columns,
  rows,
  action,
  rowKeys,
  emptyText = "ยังไม่มีข้อมูล",
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
  /** Extra classes for the `<section>`, e.g. `m-0` inside a grid. */
  className?: string;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * PAGE_SIZE;
  const visibleRows = rows.slice(start, start + PAGE_SIZE);
  return (
    <TableSection
      title={title}
      count={`${rows.length} แถว`}
      actions={action}
      className={className}
    >
      <div className="max-w-full overflow-auto">
        <table className="w-full min-w-162.5 border-separate border-spacing-0 tabular-nums">
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={`${index}-${column}`}
                  className="sticky top-0 border-b border-border bg-bg px-4.5 py-3.5 text-left align-middle text-caption font-semibold tracking-[0.03em] whitespace-nowrap text-text-secondary not-first:text-right"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              visibleRows.map((row, i) => (
                <tr
                  key={rowKeys?.[start + i] ?? start + i}
                  className="hover:bg-bg [&:last-child>td]:border-b-0"
                >
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="border-b border-border px-4.5 py-4 text-left align-middle text-body whitespace-nowrap not-first:text-right"
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
