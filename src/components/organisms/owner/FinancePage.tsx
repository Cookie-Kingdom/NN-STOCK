"use client";

import { useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import { MissingMark } from "@/components/atoms/MissingMark";
import { Panel } from "@/components/atoms/Panel";
import { Stat } from "@/components/atoms/Stat";
import { Caption, Muted } from "@/components/atoms/Text";
import { AttachmentButton } from "@/components/molecules/AttachmentButton";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
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
import { baht, dateLabel, thaiDay } from "@/lib/format";
import { periodName, shiftKey } from "@/lib/period";
import {
  advances,
  cashBetween,
  editBlock,
  incomeStatuses,
  incomeTypes,
  receivables,
  salesChannels,
  shopProject,
  supplierBalances,
  titles,
  visibleNotes,
  voidBlock,
  type Entry,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { CashFlowChart } from "./CashFlowChart";
import { FigureCard, FigureTable, Num, PlTable, cardGrid } from "./PlTable";
import { usePeriod } from "./overviewParts";

const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const none = <Muted as="span">—</Muted>;

/** Money in of the shop project: an `income` note jotted for it, as `cashBetween` reads one. */
const isIncome = (e: Entry) =>
  e.kind === "income" &&
  e.values.purpose === "project" &&
  e.values.project === shopProject;

/** The project's money as it really moved, both ways, by month or by year. From the top: the
 *  cash position (what came in, what left the shop, what is left of the two, and what is
 *  still to receive and to pay as of today), then whose pocket the money out left
 *  (V2-PAY-08); the months around the period as a chart; what was paid in each category;
 *  what each sales channel still owes (V2-CAL-25) with the button that jots its receipt, what
 *  is still unpaid per supplier, what each person paid out of pocket and is still owed
 *  (V2-PAY-07) with the button that pays them back; and the latest money in and out, a table
 *  with 「แก้ไข」 and 「ลบ」 at the end of each row. Money in is the `income` notes jotted for
 *  the project (V2-PAY-09), never the sales as jotted: the revenue is the project's Overview. */
export function FinancePage({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  const { remove } = useEntryActions(ws);
  const { view, key, span, control } = usePeriod(db, today);
  const [show, setShow] = useState<"all" | "in" | "out">("all");
  const cash = cashBetween(db, key, `${key}~`, shopProject);
  const balances = supplierBalances(db);
  const advanced = advances(db);
  const due = receivables(db);
  const unpaid = sumOf(balances.map((x) => Math.max(x.left, 0)));
  const owed = sumOf(advanced.map((x) => Math.max(x.left, 0)));
  // Only the channels with a receipt jotted: what another one was paid is not known.
  const known = due.channels.filter((c) => (c.key || c.sold) && c.jotted);
  const unreceived = sumOf(known.map((c) => Math.max(c.left, 0)));
  /* The month against the five before it, a year as its twelve months.
   * ponytail: a bar reads the whole log once: one pass that buckets by month if a long log
   * makes the page slow. */
  const months =
    view === "year"
      ? Array.from(
          { length: 12 },
          (_, i) => `${key}-${String(i + 1).padStart(2, "0")}`,
        )
      : Array.from({ length: 6 }, (_, i) => shiftKey(key, i - 5));
  const bars = months.map((m) => {
    const of = cashBetween(db, m, `${m}~`, shopProject);
    return {
      label: thaiDay(`${m}-01`, { month: "short" }),
      title: periodName(m),
      in: of.received,
      out: of.out,
    };
  });
  const latest = visibleNotes(db, account)
    .filter(
      (e) =>
        (e.kind === "pay" || e.kind === "reimburse" || isIncome(e)) &&
        (show === "all" || show === (isIncome(e) ? "in" : "out")),
    )
    .slice(0, 12);
  const payFields = fieldsOf(db, "pay", account);
  const payField = (key: string) => payFields.find((f) => f.key === key);
  const payment = (e: Entry) => {
    const v = e.values;
    const pay = e.kind === "pay";
    const income = e.kind === "income";
    // The summary without what has a column of its own.
    const line = income
      ? [
          salesChannels(db.config).find((c) => c.key === v.channel)?.name,
          v.item,
          v.status !== "paid" &&
            incomeStatuses[v.status as keyof typeof incomeStatuses],
        ]
          .filter(Boolean)
          .join(" · ")
      : noteLine(db, {
          ...e,
          values: pay
            ? { ...v, category: "", supplier: "" }
            : { ...v, payer: "" },
        });
    const sub = noteSub(db, e, account);
    const amount = noteAmount(db, e);
    return (
      <tr key={e.id} data-entry={e.id} data-kind={e.kind}>
        <td className={cn(td, "whitespace-nowrap")}>{dateLabel(e.date)}</td>
        <td className={cn(td, "whitespace-nowrap")}>
          <Badge tone={income ? "success" : "danger"}>
            {income ? "รายรับ" : "รายจ่าย"}
          </Badge>
        </td>
        <td className={cn(td, "whitespace-nowrap")}>
          {income ? (
            incomeTypes[v.incomeType === "sales" ? "sales" : "other"]
          ) : !pay ? (
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
        {/* A payment's seller; of money paid back, who got it; of money in, who paid it. */}
        <td className={td}>
          {income
            ? v.customer || none
            : pay
              ? v.supplier || none
              : v.payer || <MissingMark />}
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
  // A quiet figure under the lead ones: the label, figure and note of a `Stat`, unboxed.
  const line = (label: string, value: ReactNode, note?: string) => (
    <div>
      <small className="block text-caption text-text-secondary">{label}</small>
      <strong className="mt-1 block text-body font-semibold tabular-nums">
        {value}
      </strong>
      {note && (
        <small className="mt-0.5 block text-caption text-text-secondary">
          {note}
        </small>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {control}
      {/* The groups are sections, not divs: a figure is found as the div holding its label. */}
      <Panel aria-label={`เงินของ${span}`}>
        <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-6">
          <Stat
            className="lg:col-span-2"
            label="เงินเข้าจริง"
            value={
              cash.received ? (
                <span className="text-success">+{baht(cash.received)}</span>
              ) : (
                baht(0)
              )
            }
            note={`รับเงินค่าขาย ${baht(cash.salesReceived)} · รายได้อื่น ${baht(cash.otherReceived)}`}
          />
          <Stat
            className="lg:col-span-2"
            label="เงินออกจากร้านจริง"
            value={out(cash.out)}
            note="บริษัทจ่ายเอง + คืนเงินพนักงาน"
          />
          <Stat
            className="max-lg:col-span-2 lg:col-span-2"
            label="กระแสเงินสดสุทธิ"
            value={
              cash.net > 0 ? (
                <span className="text-success">+{baht(cash.net)}</span>
              ) : cash.net < 0 ? (
                <span className="text-danger">{baht(cash.net)}</span>
              ) : (
                baht(0)
              )
            }
            note="เงินเข้าจริง − เงินออกจากร้านจริง"
          />
          <Stat
            className="lg:col-span-3"
            label="ยอดค้างรับถึงวันนี้"
            value={
              // No receipt jotted for any channel that sold: there is no figure to give.
              !known.length && due.channels.some((c) => c.sold) ? (
                <MissingMark />
              ) : (
                <span className={cn(unreceived > 0 && "text-warning")}>
                  {baht(unreceived)}
                </span>
              )
            }
            note={
              due.pending.count
                ? `รอรับอีก ${due.pending.count} รายการ ${baht(due.pending.amount)}`
                : "ไม่มีรายรับที่รอรับ"
            }
          />
          <Stat
            className="lg:col-span-3"
            label="ยอดค้างจ่ายถึงวันนี้"
            value={
              <span className={cn(unpaid + owed > 0 && "text-warning")}>
                {baht(unpaid + owed)}
              </span>
            }
            note={`ผู้ขาย ${baht(unpaid)} · พนักงาน ${baht(owed)}`}
          />
        </section>
        <section className="mt-5 border-t border-border pt-4">
          <h3 className="m-0 mb-3 text-label text-text-secondary">
            เงินออกของ{span}นี้ ใครเป็นคนจ่าย
          </h3>
          <section className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-6 gap-y-3 max-md:grid-cols-2">
            {line(
              "ยอดจ่ายทั้งหมด",
              out(cash.paid),
              `ค่าใช้จ่ายทั้ง${span} รวมหมวดอุปกรณ์/ลงทุน`,
            )}
            {line("บริษัทจ่ายเอง", out(cash.company))}
            {line(
              "พนักงานสำรองจ่าย",
              baht(cash.advanced),
              "เป็นค่าใช้จ่ายแล้ว แต่เงินยังไม่ออกจากร้าน",
            )}
            {line(
              "เงินคืนพนักงาน",
              out(cash.repaid),
              "ไม่นับเป็นค่าใช้จ่ายซ้ำ",
            )}
          </section>
        </section>
      </Panel>
      <Panel aria-label="เงินเข้า–ออก">
        <h2 className="m-0 mb-4 text-label text-text-secondary">
          {view === "year"
            ? `เงินเข้า–ออกรายเดือน ${periodName(key)}`
            : `เงินเข้า–ออก หกเดือนถึง${periodName(key)}`}
        </h2>
        <CashFlowChart
          label={`กราฟแท่งเงินเข้าและเงินออกจากร้านต่อเดือน ${periodName(months[0])} ถึง ${periodName(months.at(-1)!)} · กดลูกศรซ้ายขวาเพื่ออ่านทีละเดือน`}
          unit="เดือน"
          bars={bars}
        />
      </Panel>
      <div className={cardGrid}>
        <PlTable db={db} month={key} />
        <div className="flex min-w-0 flex-col gap-4">
          <FigureCard
            title="ยอดค้างรับแยกช่องทางขาย"
            note="ยอดขายทั้งหมดหลังหัก GP หักเงินที่รับแล้ว นับถึงวันนี้"
          >
            {due.channels.length ? (
              <FigureTable>
                <thead>
                  <tr>
                    <th className={th}>ช่องทาง</th>
                    {["ขายหลังหัก GP", "รับแล้ว", "ค้างรับ"].map((name) => (
                      <th key={name} className={cn(th, "text-right")}>
                        {name}
                      </th>
                    ))}
                    <th className={th}>
                      <span className="sr-only">รับเงิน</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {due.channels.map((x) => (
                    <tr key={x.key}>
                      <td className={cn(td, "whitespace-nowrap")}>{x.name}</td>
                      {/* Receipts that name no channel: only the old books' sales to set them against. */}
                      <Num>{x.key || x.sold ? baht(x.sold) : "—"}</Num>
                      {/* No receipt jotted: what it paid before is not known, so no figure. */}
                      <Num>{x.jotted ? baht(x.received) : <MissingMark />}</Num>
                      {!x.key && !x.sold ? (
                        <Num>—</Num>
                      ) : !x.jotted ? (
                        <Num>
                          <MissingMark />
                        </Num>
                      ) : x.left > 0 ? (
                        <Num tone="warning">{baht(x.left)}</Num>
                      ) : x.left < 0 ? (
                        <Num tone="warning">รับเกิน {baht(-x.left)}</Num>
                      ) : (
                        <Num tone="ok">รับครบแล้ว</Num>
                      )}
                      <td className={cn(td, "text-right")}>
                        {x.key && (!x.jotted || x.left > 0) && (
                          <Button
                            variant="text"
                            aria-label={`รับเงิน ${x.name}`}
                            onClick={() =>
                              ws.jot({
                                kind: "income",
                                values: {
                                  incomeType: "sales",
                                  channel: x.key,
                                  purpose: "project",
                                  project: shopProject,
                                  amount: x.left > 0 ? String(x.left) : "",
                                },
                              })
                            }
                          >
                            รับเงิน
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </FigureTable>
            ) : (
              <Muted className="px-5 py-3 text-body-sm max-md:px-4">
                ยังไม่มีช่องทางขาย
              </Muted>
            )}
          </FigureCard>
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
                      <td className={cn(td, "whitespace-nowrap")}>{x.payer}</td>
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
        </div>
      </div>
      <FigureCard
        title="รายการเงินเข้า–ออกล่าสุด"
        note={`${latest.length} รายการ จากทุกช่วงเวลา`}
      >
        <div className="border-b border-border px-5 py-3 max-md:px-4">
          <SegmentedChoice
            label="แสดงรายการ"
            value={show}
            onChange={setShow}
            options={[
              { value: "all", label: "ทั้งหมด" },
              { value: "in", label: "รายรับ" },
              { value: "out", label: "รายจ่าย" },
            ]}
          />
        </div>
        {latest.length ? (
          <FigureTable>
            <thead>
              <tr>
                <th className={th}>วันที่</th>
                <th className={th}>รายรับ / รายจ่าย</th>
                <th className={th}>{fieldLabel(payFields, "category")}</th>
                <th className={th}>รายการ</th>
                <th className={th}>คู่รายการ</th>
                <th className={th}>{fieldLabel(payFields, "source")}</th>
                <th className={cn(th, "text-right")}>จำนวนเงิน</th>
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
            {show === "in"
              ? "ยังไม่มีรายรับของ Project"
              : show === "out"
                ? "ยังไม่มีรายการจ่ายเงิน"
                : "ยังไม่มีรายการเงินเข้า–ออก"}
          </Muted>
        )}
      </FigureCard>
    </div>
  );
}
