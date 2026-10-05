"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Muted } from "@/components/atoms/Text";
import { TableFilter } from "@/components/molecules/TableFilter";
import { NoteRow } from "@/components/organisms/shared/NoteRow";
import { td, th } from "@/components/organisms/shared/tableCell";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht } from "@/lib/format";
import { advances, supplierBalances, visibleNotes } from "@/lib/store";
import { shopProject } from "@/lib/store/ledger";
import { cn } from "@/lib/utils";
import { Revenue } from "./OverviewPage";
import { FigureCard, FigureTable, Num, PlTable, cardGrid } from "./PlTable";

/** Money of the project. The Owner sees its revenue as the Overview shows the shop's (by
 *  month or by year, down to the P&L), then what is still unpaid per supplier, what each
 *  person paid out of pocket (V2-PAY-07) and the latest payments. The Account Manager sees
 *  the payments of one month by category, without payroll, and the supplier balances. */
export function FinancePage({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  const thisMonth = today.slice(0, 7);
  const [typed, setTyped] = useState(thisMonth);
  // A browser with no month picker shows a text box: anything else typed is this month.
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(typed) ? typed : thisMonth;
  const balances = supplierBalances(db);
  const advanced = advances(db);
  const pays = visibleNotes(db, account)
    .filter((e) => e.kind === "pay")
    .slice(0, 12);

  const unpaid = (
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
  );
  const latest = (
    <FigureCard title="จ่ายเงินล่าสุด" note={`${pays.length} รายการ`}>
      {pays.length ? (
        pays.map((e) => <NoteRow key={e.id} entry={e} ws={ws} dated />)
      ) : (
        <Muted className="px-5 py-3 text-body-sm max-md:px-4">
          ยังไม่มีบันทึกจ่ายเงิน
        </Muted>
      )}
    </FigureCard>
  );

  if (!account.hidesSales)
    return (
      <Revenue ws={ws} project={shopProject}>
        <div className={cardGrid}>
          <div className="flex min-w-0 flex-col gap-4">
            {unpaid}
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
          </div>
          {latest}
        </div>
      </Revenue>
    );

  return (
    // A wide screen: the latest payments are a third column beside the tables.
    <div className="flex flex-col gap-4 min-[1700px]:grid min-[1700px]:grid-cols-3 min-[1700px]:items-start">
      <TableFilter
        label="เดือน"
        className="self-start min-[1700px]:col-span-full min-[1700px]:justify-self-start"
      >
        <Input
          type="month"
          variant="filter"
          value={typed}
          max={thisMonth}
          onChange={(event) => setTyped(event.target.value)}
        />
      </TableFilter>
      <div className={cn(cardGrid, "min-[1700px]:col-span-2")}>
        <PlTable db={db} month={month} />
        {unpaid}
      </div>
      {latest}
    </div>
  );
}
