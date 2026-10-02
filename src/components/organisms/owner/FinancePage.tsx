"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Panel } from "@/components/atoms/Panel";
import { Stat } from "@/components/atoms/Stat";
import { Muted } from "@/components/atoms/Text";
import { TableFilter } from "@/components/molecules/TableFilter";
import { NoteRow } from "@/components/organisms/shared/NoteRow";
import { td, th } from "@/components/organisms/shared/tableCell";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht } from "@/lib/format";
import {
  advances,
  monthPl,
  salesChannels,
  supplierBalances,
  visibleNotes,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { FigureCard, FigureTable, monthName, Num, PlTable } from "./PlTable";

export const figureGrid =
  "grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4 max-md:grid-cols-2 max-md:gap-3";
export const cardGrid =
  "grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-4";

/** Money of one month, and what is still unpaid per supplier. The Owner also sees sales, GP,
 *  the operating profit and what each person paid out of pocket (V2-PAY-07); the Account
 *  Manager sees the payments by category, without payroll, and the supplier balances. */
export function FinancePage({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  const owner = !account.hidesSales;
  const thisMonth = today.slice(0, 7);
  const [typed, setTyped] = useState(thisMonth);
  // A browser with no month picker shows a text box: anything else typed is this month.
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(typed) ? typed : thisMonth;
  const pl = monthPl(db, month);
  const channels = salesChannels(db.config);
  const balances = supplierBalances(db);
  const advanced = advances(db);
  const pays = visibleNotes(db, account)
    .filter((e) => e.kind === "pay")
    .slice(0, 12);

  return (
    <div className="flex flex-col gap-4">
      <TableFilter label="เดือน" className="self-start">
        <Input
          type="month"
          variant="filter"
          value={typed}
          max={thisMonth}
          onChange={(event) => setTyped(event.target.value)}
        />
      </TableFilter>
      {owner && (
        <Panel className={figureGrid} aria-label="ตัวเลขของเดือน">
          <Stat
            label={`ยอดขาย ${monthName(month)}`}
            value={<span className="text-success">+{baht(pl.sales)}</span>}
          />
          <Stat
            label={channels.length === 1 ? `GP ${channels[0].gp}%` : "GP"}
            value={<span className="text-danger">{baht(-pl.gp)}</span>}
          />
          <Stat
            label="จ่ายเงิน (ดำเนินงาน)"
            value={<span className="text-danger">{baht(-pl.opex)}</span>}
          />
          <Stat
            label="กำไรจากการดำเนินงาน"
            value={
              <span className={pl.profit < 0 ? "text-danger" : "text-success"}>
                {baht(pl.profit)}
              </span>
            }
          />
        </Panel>
      )}
      <div className={cardGrid}>
        <PlTable db={db} month={month} full={owner} />
        <div className="flex min-w-0 flex-col gap-4">
          <FigureCard
            title="ยอดคงเหลือที่ยังไม่ได้จ่าย ต่อผู้ขาย"
            note="ยอดของใบทั้งหมด ลบ เงินที่จ่ายแล้ว"
          >
            {balances.length ? (
              <FigureTable>
                <thead>
                  <tr>
                    <th className={th}>ผู้ขาย</th>
                    {["ยอดของใบ", "จ่ายแล้ว", "คงเหลือ"].map((name) => (
                      <th key={name} className={cn(th, "text-right")}>
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {balances.map((x) => (
                    <tr key={x.supplier}>
                      <td className={td}>{x.supplier}</td>
                      <Num>{baht(x.billed)}</Num>
                      <Num>{baht(x.paid)}</Num>
                      {x.left > 0 ? (
                        <Num tone="warning">{baht(x.left)}</Num>
                      ) : (
                        <Num tone="ok">จ่ายครบแล้ว</Num>
                      )}
                    </tr>
                  ))}
                </tbody>
              </FigureTable>
            ) : (
              <Muted className="px-5 py-3 text-body-sm max-md:px-4">
                ยังไม่มีใบจากผู้ขาย
              </Muted>
            )}
          </FigureCard>
          {owner && (
            <FigureCard
              title="เงินที่พนักงานสำรองจ่าย"
              note="รวมตามช่องผู้จ่าย"
            >
              <FigureTable>
                <tbody>
                  {advanced.map((x) => (
                    <tr key={x.payer}>
                      <td className={td}>{x.payer}</td>
                      <Num>{baht(x.amount)}</Num>
                    </tr>
                  ))}
                  {!advanced.length && (
                    <tr>
                      <td className={cn(td, "text-text-secondary")}>ไม่มี</td>
                    </tr>
                  )}
                </tbody>
              </FigureTable>
            </FigureCard>
          )}
        </div>
      </div>
      <FigureCard title="จ่ายเงินล่าสุด" note={`${pays.length} รายการ`}>
        {pays.length ? (
          pays.map((e) => <NoteRow key={e.id} entry={e} ws={ws} dated />)
        ) : (
          <Muted className="px-5 py-3 text-body-sm max-md:px-4">
            ยังไม่มีบันทึกจ่ายเงิน
          </Muted>
        )}
      </FigureCard>
    </div>
  );
}
