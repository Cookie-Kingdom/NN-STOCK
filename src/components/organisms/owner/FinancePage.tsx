"use client";

import { Button } from "@/components/atoms/Button";
import { Panel } from "@/components/atoms/Panel";
import { Stat } from "@/components/atoms/Stat";
import { Muted } from "@/components/atoms/Text";
import { NoteRow } from "@/components/organisms/shared/NoteRow";
import { td, th } from "@/components/organisms/shared/tableCell";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht } from "@/lib/format";
import {
  advances,
  cashBetween,
  supplierBalances,
  visibleNotes,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { usePeriod } from "./OverviewPage";
import {
  FigureCard,
  FigureTable,
  Num,
  PlTable,
  cardGrid,
  figureGrid,
} from "./PlTable";

const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** The project's money as it really moved, by month or by year: what was paid in each
 *  category, what is still unpaid per supplier and the latest payments. The Owner also sees
 *  whose pocket the money left (V2-PAY-08), what each person paid out of pocket and is still
 *  owed (V2-PAY-07), and pays them back from here. The Account Manager sees no payroll and
 *  none of that. The revenue is the project's Overview. */
export function FinancePage({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  const owner = !account.hidesSales;
  const { key, span, control } = usePeriod(db, today);
  const cash = cashBetween(db, key, `${key}~`);
  const balances = supplierBalances(db);
  const advanced = advances(db);
  const unpaid = sumOf(balances.map((x) => Math.max(x.left, 0)));
  const owed = sumOf(advanced.map((x) => Math.max(x.left, 0)));
  const latest = visibleNotes(db, account)
    .filter((e) => e.kind === "pay" || e.kind === "reimburse")
    .slice(0, 12);
  // Money out, red and with its minus; nothing out is a plain zero.
  const out = (x: number) =>
    x ? <span className="text-danger">{baht(-x)}</span> : baht(0);

  return (
    <div className="flex flex-col gap-4">
      {control}
      {owner && (
        <Panel
          className={cn(figureGrid, "lg:grid-cols-3")}
          aria-label={`เงินของ${span}`}
        >
          <Stat
            label="จ่ายเงินทั้งหมด"
            value={out(cash.paid)}
            note="ค่าใช้จ่ายของช่วง รวมอุปกรณ์/ลงทุน"
          />
          <Stat label="บริษัทจ่ายเอง" value={out(cash.company)} />
          <Stat
            label="พนักงานสำรองจ่าย"
            value={baht(cash.advanced)}
            note="นับเป็นค่าใช้จ่ายแล้ว เงินยังไม่ออกจากร้าน"
          />
          <Stat
            label="คืนเงินพนักงาน"
            value={out(cash.repaid)}
            note="ไม่นับเป็นค่าใช้จ่ายซ้ำ"
          />
          <Stat
            label="เงินออกจากร้านจริง"
            value={out(cash.out)}
            note="บริษัทจ่ายเอง + คืนเงินพนักงาน"
          />
          <Stat
            label="ค้างจ่าย ณ วันนี้"
            value={
              <span className={cn(unpaid + owed > 0 && "text-warning")}>
                {baht(unpaid + owed)}
              </span>
            }
            note={`ผู้ขาย ${baht(unpaid)} · พนักงาน ${baht(owed)}`}
          />
        </Panel>
      )}
      <div className={cardGrid}>
        <PlTable db={db} month={key} payroll={owner} />
        <div className="flex min-w-0 flex-col gap-4">
          <FigureCard
            title="ยอดคงเหลือที่ยังไม่ได้จ่าย ต่อผู้ขาย"
            note="ยอดของใบทั้งหมด ลบ เงินที่จ่ายแล้ว · ถึงวันนี้"
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
              note="สำรองจ่าย ลบ คืนแล้ว · ถึงวันนี้"
            >
              {advanced.length ? (
                <FigureTable>
                  <thead>
                    <tr>
                      <th className={th}>ผู้จ่าย</th>
                      {["สำรองจ่าย", "คืนแล้ว", "ค้างคืน"].map((name) => (
                        <th key={name} className={cn(th, "text-right")}>
                          {name}
                        </th>
                      ))}
                      <th className={th}>
                        <span className="sr-only">คืนเงิน</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {advanced.map((x) => (
                      <tr key={x.payer}>
                        <td className={cn(td, "whitespace-nowrap")}>
                          {x.payer}
                        </td>
                        <Num>{baht(x.advanced)}</Num>
                        <Num>{baht(x.repaid)}</Num>
                        {x.left > 0 ? (
                          <Num tone="warning">{baht(x.left)}</Num>
                        ) : x.left < 0 ? (
                          <Num tone="warning">คืนเกิน {baht(-x.left)}</Num>
                        ) : (
                          <Num tone="ok">คืนครบแล้ว</Num>
                        )}
                        <td className={cn(td, "text-right")}>
                          {x.left > 0 && (
                            <Button
                              variant="text"
                              aria-label={`คืนเงิน ${x.payer}`}
                              onClick={() =>
                                ws.jot({
                                  kind: "reimburse",
                                  values: {
                                    payer: x.payer,
                                    amount: String(x.left),
                                  },
                                })
                              }
                            >
                              คืนเงิน
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </FigureTable>
              ) : (
                <Muted className="px-5 py-3 text-body-sm max-md:px-4">
                  ไม่มี
                </Muted>
              )}
            </FigureCard>
          )}
        </div>
      </div>
      <FigureCard
        title="จ่ายเงินล่าสุด"
        note={`${latest.length} รายการ · ทุกช่วง`}
      >
        {latest.length ? (
          latest.map((e) => <NoteRow key={e.id} entry={e} ws={ws} dated />)
        ) : (
          <Muted className="px-5 py-3 text-body-sm max-md:px-4">
            ยังไม่มีบันทึกจ่ายเงิน
          </Muted>
        )}
      </FigureCard>
    </div>
  );
}
