"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import { MissingMark } from "@/components/atoms/MissingMark";
import { Panel } from "@/components/atoms/Panel";
import { Stat } from "@/components/atoms/Stat";
import { Caption, Muted } from "@/components/atoms/Text";
import { AttachmentButton } from "@/components/molecules/AttachmentButton";
import {
  fieldLabel,
  fieldText,
  fieldsOf,
  noteAmount,
  noteLine,
  noteSub,
} from "@/components/organisms/shared/noteText";
import { td, th } from "@/components/organisms/shared/tableCell";
import { useEntryActions } from "@/components/organisms/shared/useEntryActions";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, dateLabel } from "@/lib/format";
import {
  advances,
  cashBetween,
  editBlock,
  supplierBalances,
  titles,
  visibleNotes,
  voidBlock,
  type Entry,
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
const none = <Muted as="span">—</Muted>;

/** The project's money as it really moved, by month or by year: what was paid in each
 *  category, what is still unpaid per supplier and the latest payments, a table with
 *  「แก้ไข」 and 「ลบ」 at the end of each row. The Owner also sees
 *  whose pocket the money left (V2-PAY-08), what each person paid out of pocket and is still
 *  owed (V2-PAY-07), and pays them back from here. The Account Manager sees no payroll and
 *  none of that. The revenue is the project's Overview. */
export function FinancePage({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  const { remove } = useEntryActions(ws);
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
  const payFields = fieldsOf(db, "pay", account);
  const payField = (key: string) => payFields.find((f) => f.key === key);
  const payment = (e: Entry) => {
    const v = e.values;
    const pay = e.kind === "pay";
    // The summary without what has a column of its own.
    const line = noteLine(db, {
      ...e,
      values: pay ? { ...v, category: "", supplier: "" } : { ...v, payer: "" },
    });
    const sub = noteSub(db, e, account);
    const amount = noteAmount(db, e);
    return (
      <tr key={e.id} data-entry={e.id} data-kind={e.kind}>
        <td className={cn(td, "whitespace-nowrap")}>{dateLabel(e.date)}</td>
        <td className={cn(td, "whitespace-nowrap")}>
          {!pay ? (
            titles[e.kind]
          ) : v.category ? (
            fieldText(db, payField("category"), v.category)
          ) : (
            <MissingMark />
          )}
        </td>
        <td className={cn(td, "min-w-48")}>
          {line || (!sub && none)}
          {sub && (
            <Caption as="span" className="block">
              {sub}
            </Caption>
          )}
        </td>
        {/* A payment's seller; of money paid back, who got it. */}
        <td className={td}>
          {pay ? v.supplier || none : v.payer || <MissingMark />}
        </td>
        <td className={cn(td, "whitespace-nowrap")}>
          {/* A payment with no source reads as a transfer, as on Accounting. */}
          {pay
            ? fieldText(db, payField("source"), v.source || "transfer")
            : none}
        </td>
        <Num tone={amount?.tone}>{amount?.text ?? <MissingMark />}</Num>
        <td className={cn(td, "whitespace-nowrap")}>
          {v.attachment ? (
            <AttachmentButton
              action="view"
              name={v.attachment}
              data={v.attachmentData}
              storageKey={v.attachmentStorageKey}
            />
          ) : (
            none
          )}
        </td>
        <td className={cn(td, "px-2 whitespace-nowrap")}>
          <span className="flex gap-1">
            {!editBlock(db, e, account) && (
              <IconButton
                label="แก้ไข"
                icon={<Pencil size={16} />}
                onClick={() => ws.edit(e.id)}
              />
            )}
            {!voidBlock(db, e, account) && (
              <IconButton
                label="ลบ"
                icon={<Trash2 size={16} />}
                className="text-danger"
                onClick={() => remove(e)}
              />
            )}
          </span>
        </td>
      </tr>
    );
  };
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
            label="ยอดจ่ายทั้งหมด"
            value={out(cash.paid)}
            note={`ค่าใช้จ่ายทั้ง${span} รวมหมวดอุปกรณ์/ลงทุน`}
          />
          <Stat label="บริษัทจ่ายเอง" value={out(cash.company)} />
          <Stat
            label="พนักงานสำรองจ่าย"
            value={baht(cash.advanced)}
            note="เป็นค่าใช้จ่ายแล้ว แต่เงินยังไม่ออกจากร้าน"
          />
          <Stat
            label="เงินคืนพนักงาน"
            value={out(cash.repaid)}
            note="ไม่นับเป็นค่าใช้จ่ายซ้ำ"
          />
          <Stat
            label="เงินออกจากร้านจริง"
            value={out(cash.out)}
            note="บริษัทจ่ายเอง + คืนเงินพนักงาน"
          />
          <Stat
            label="ยอดค้างจ่ายถึงวันนี้"
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
            title="ยอดค้างจ่ายแยกผู้ขาย"
            note="ยอดตามใบทั้งหมดหักเงินที่จ่ายแล้ว นับถึงวันนี้"
          >
            {balances.length ? (
              <FigureTable>
                <thead>
                  <tr>
                    <th className={th}>ผู้ขาย</th>
                    {["ยอดตามใบ", "จ่ายแล้ว", "ค้างจ่าย"].map((name) => (
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
              note="ยอดสำรองจ่ายหักยอดที่คืนแล้ว นับถึงวันนี้"
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
                  ยังไม่มีเงินที่พนักงานสำรองจ่าย
                </Muted>
              )}
            </FigureCard>
          )}
        </div>
      </div>
      <FigureCard
        title="รายการจ่ายเงินล่าสุด"
        note={`${latest.length} รายการ จากทุกช่วงเวลา`}
      >
        {latest.length ? (
          <FigureTable>
            <thead>
              <tr>
                <th className={th}>วันที่</th>
                <th className={th}>{fieldLabel(payFields, "category")}</th>
                <th className={th}>รายการ</th>
                <th className={th}>ผู้ขาย / ผู้รับ</th>
                <th className={th}>{fieldLabel(payFields, "source")}</th>
                <th className={cn(th, "text-right")}>ยอดจ่าย</th>
                <th className={th}>เอกสารแนบ</th>
                <th className={th}>
                  <span className="sr-only">แก้ไข / ลบ</span>
                </th>
              </tr>
            </thead>
            <tbody>{latest.map(payment)}</tbody>
          </FigureTable>
        ) : (
          <Muted className="px-5 py-3 text-body-sm max-md:px-4">
            ยังไม่มีรายการจ่ายเงิน
          </Muted>
        )}
      </FigureCard>
    </div>
  );
}
