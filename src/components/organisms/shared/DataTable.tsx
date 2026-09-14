"use client";

import { type ReactNode, useState } from "react";

export function DataTable({
  title,
  columns,
  rows,
  action,
}: {
  title: string;
  columns: string[];
  rows: ReactNode[][];
  action?: ReactNode;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  return (
    <section className="table-section">
      <div className="table-title">
        <div>
          <h2>{title}</h2>
          <span>{rows.length} แถว</span>
        </div>
        {action}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              visibleRows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="no-data" colSpan={columns.length}>
                  ยังไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && (
        <div className="table-pagination">
          <span>
            หน้า {currentPage + 1} / {pageCount} · แสดงครั้งละ {pageSize} แถว
          </span>
          <div className="button-row">
            <button
              className="secondary"
              disabled={currentPage === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              ก่อนหน้า
            </button>
            <button
              className="secondary"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
