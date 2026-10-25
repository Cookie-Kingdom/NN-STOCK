"use client";

import { useState } from "react";
import { Muted } from "@/components/atoms/Text";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
import { ShowMore, useShowMore } from "@/components/molecules/ShowMore";
import { td, tf, th } from "@/components/organisms/shared/tableCell";
import { baht, qty, thaiDay } from "@/lib/format";
import { periodName } from "@/lib/period";
import {
  branchSalesSummary,
  noBranch,
  products,
  type Database,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { FigureCard, FigureTable, Num } from "./PlTable";

/** สรุปยอดขายสาขา: what each branch sold, product by product, and its money, per day or per
 *  month of the page's period (`period`, a `YYYY-MM` or a `YYYY`), with the totals under them.
 *  The money is the sales as jotted, as 「ยอดขายแยกสาขา」 reads them. Shared by the project's
 *  Overview and Finance. */
export function BranchSalesSummary({
  db,
  period,
}: {
  db: Database;
  period: string;
}) {
  const [by, setBy] = useState<"day" | "month">("day");
  const { rows, total } = branchSalesSummary(db, period, by);
  const { limit, more } = useShowMore(`${period} ${by}`);
  const list = products(db.config);
  const sold = (counts: Record<string, number>) =>
    list
      .filter((p) => counts[p.id])
      .map((p) => `${p.name} ${qty(counts[p.id])}`)
      .join(" · ") || "—";
  return (
    <FigureCard title="สรุปยอดขายสาขา" note="ตามที่สาขาจด">
      <div className="border-b border-border px-5 py-3 max-md:px-4">
        <SegmentedChoice
          label="แสดงยอดขาย"
          value={by}
          onChange={setBy}
          options={[
            { value: "day", label: "รายวัน" },
            { value: "month", label: "รายเดือน" },
          ]}
        />
      </div>
      {rows.length ? (
        <>
          <FigureTable>
            <thead>
              <tr>
                <th className={th}>{by === "day" ? "วันที่" : "เดือน"}</th>
                <th className={th}>สาขา</th>
                <th className={th}>สินค้า</th>
                <th className={cn(th, "text-right")}>รายได้</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((row) => (
                <tr key={`${row.key} ${row.branch}`}>
                  <td className={cn(td, "whitespace-nowrap")}>
                    {by === "day" ? thaiDay(row.key) : periodName(row.key)}
                  </td>
                  <td className={cn(td, "whitespace-nowrap")}>
                    {row.branch || noBranch}
                  </td>
                  <td className={td}>{sold(row.counts)}</td>
                  <Num>{baht(row.money)}</Num>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className={cn(td, tf)} colSpan={2}>
                  รวม
                </td>
                <td className={cn(td, tf)}>{sold(total.counts)}</td>
                <Num className={tf}>{baht(total.money)}</Num>
              </tr>
            </tfoot>
          </FigureTable>
          <ShowMore
            shown={Math.min(limit, rows.length)}
            total={rows.length}
            onMore={more}
          />
        </>
      ) : (
        <Muted className="px-5 py-3 text-body-sm max-md:px-4">
          ยังไม่มียอดขายของสาขาใน{periodName(period)}
        </Muted>
      )}
    </FigureCard>
  );
}
