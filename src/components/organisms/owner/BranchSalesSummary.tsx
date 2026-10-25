"use client";

import { useState } from "react";
import { Select } from "@/components/atoms/Select";
import { Muted } from "@/components/atoms/Text";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
import { ShowMore, useShowMore } from "@/components/molecules/ShowMore";
import { TableFilter } from "@/components/molecules/TableFilter";
import { td, tf, th } from "@/components/organisms/shared/tableCell";
import { qty, thaiDay } from "@/lib/format";
import { periodName } from "@/lib/period";
import {
  branchSalesSummary,
  noBranch,
  products,
  type Database,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { FigureCard, FigureTable, Num } from "./PlTable";

const all = { value: "", label: "ทั้งหมด" };

/** สรุปยอดขายสาขา: how many of each product each branch sold, per day or per month of the
 *  page's period (`period`, a `YYYY-MM` or a `YYYY`): one row per day, branch and product,
 *  filtered by any of the three, with the pieces of the rows shown added up under them.
 *  Shared by the project's Overview and Finance. */
export function BranchSalesSummary({
  db,
  period,
}: {
  db: Database;
  period: string;
}) {
  const [by, setBy] = useState<"day" | "month">("day");
  const [date, setDate] = useState("");
  const [branch, setBranch] = useState("");
  const [product, setProduct] = useState("");
  const list = products(db.config);
  // One row per product a day's branch sold, in the products' order.
  const sales = branchSalesSummary(db, period, by).rows.flatMap((row) =>
    list
      .filter((p) => row.counts[p.id])
      .map((p) => ({
        key: row.key,
        branch: row.branch || noBranch,
        product: p,
        count: row.counts[p.id],
      })),
  );
  const label = (key: string) =>
    by === "day" ? thaiDay(key) : periodName(key);
  const distinct = (values: string[]) => [...new Set(values)];
  const dates = distinct(sales.map((r) => r.key));
  const names = distinct(sales.map((r) => r.branch));
  const sold = list.filter((p) => sales.some((r) => r.product === p));
  // A choice the period or the รายวัน/รายเดือน switch took away reads as ทั้งหมด.
  const pick = (value: string, values: string[]) =>
    values.includes(value) ? value : "";
  const at = pick(date, dates);
  const of = pick(branch, names);
  const what = pick(
    product,
    sold.map((p) => p.id),
  );
  const rows = sales.filter(
    (r) =>
      (!at || r.key === at) &&
      (!of || r.branch === of) &&
      (!what || r.product.id === what),
  );
  const { limit, more } = useShowMore(`${period} ${by} ${at} ${of} ${what}`);
  return (
    <FigureCard title="สรุปยอดขายสาขา" note="ตามที่สาขาจด">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border px-5 py-3 max-md:px-4">
        <SegmentedChoice
          label="แสดงยอดขาย"
          value={by}
          onChange={setBy}
          options={[
            { value: "day", label: "รายวัน" },
            { value: "month", label: "รายเดือน" },
          ]}
        />
        {sales.length > 0 && (
          <>
            <TableFilter label={by === "day" ? "วันที่" : "เดือน"}>
              <Select
                variant="filter"
                value={at}
                onChange={setDate}
                options={[
                  all,
                  ...dates.map((value) => ({ value, label: label(value) })),
                ]}
              />
            </TableFilter>
            <TableFilter label="สาขา">
              <Select
                variant="filter"
                value={of}
                onChange={setBranch}
                options={[all, ...names.map((value) => ({ value }))]}
              />
            </TableFilter>
            <TableFilter label="สินค้า">
              <Select
                variant="filter"
                value={what}
                onChange={setProduct}
                options={[
                  all,
                  ...sold.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </TableFilter>
          </>
        )}
      </div>
      {rows.length ? (
        <>
          <FigureTable>
            <thead>
              <tr>
                <th className={th}>{by === "day" ? "วันที่" : "เดือน"}</th>
                <th className={th}>สาขา</th>
                <th className={th}>สินค้า</th>
                <th className={cn(th, "text-right")}>จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((row) => (
                <tr key={`${row.key} ${row.branch} ${row.product.id}`}>
                  <td className={cn(td, "whitespace-nowrap")}>
                    {label(row.key)}
                  </td>
                  <td className={cn(td, "whitespace-nowrap")}>{row.branch}</td>
                  <td className={td}>{row.product.name}</td>
                  <Num>
                    {qty(row.count)} {row.product.unit}
                  </Num>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className={cn(td, tf)} colSpan={3}>
                  รวม
                </td>
                <Num className={tf}>
                  {qty(rows.reduce((a, r) => a + r.count, 0))}
                  {/* A unit only when every row counts the same product. */}
                  {rows.every((r) => r.product === rows[0].product)
                    ? ` ${rows[0].product.unit}`
                    : ""}
                </Num>
              </tr>
            </tfoot>
          </FigureTable>
          <ShowMore
            shown={Math.min(limit, rows.length)}
            total={rows.length}
            onMore={more}
          />
        </>
      ) : sales.length ? (
        <Muted className="px-5 py-3 text-body-sm max-md:px-4">
          ไม่มียอดขายที่ตรงกับตัวกรอง
        </Muted>
      ) : (
        <Muted className="px-5 py-3 text-body-sm max-md:px-4">
          ยังไม่มียอดขายของสาขาใน{periodName(period)}
        </Muted>
      )}
    </FigureCard>
  );
}
