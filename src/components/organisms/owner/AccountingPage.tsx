"use client";

import { useState } from "react";
import { Building2, FolderKanban, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import { Input } from "@/components/atoms/Input";
import { MissingMark } from "@/components/atoms/MissingMark";
import { Panel } from "@/components/atoms/Panel";
import { Select } from "@/components/atoms/Select";
import { Stat } from "@/components/atoms/Stat";
import { Caption, Muted } from "@/components/atoms/Text";
import { AttachmentButton } from "@/components/molecules/AttachmentButton";
import { EmptyState } from "@/components/molecules/EmptyState";
import { Notice } from "@/components/molecules/Notice";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
import { ShowMore, useShowMore } from "@/components/molecules/ShowMore";
import { td, tf, th } from "@/components/organisms/shared/tableCell";
import { useEntryActions } from "@/components/organisms/shared/useEntryActions";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, dateLabel, qty, thaiDay } from "@/lib/format";
import { periodName, shiftKey } from "@/lib/period";
import {
  editBlock,
  ledgerPurposes,
  ledgerRows,
  ledgerSources,
  ledgerStatuses,
  ledgerSummary,
  voidBlock,
  type LedgerRow,
  type LedgerStatus,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { CashFlowChart } from "./CashFlowChart";
import { Num } from "./PlTable";

const statusTone: Record<LedgerStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  paid: "success",
  cancelled: "danger",
};
const none = <Muted as="span">—</Muted>;
const isWebLink = (value = "") => /^https?:\/\/\S+$/i.test(value);
const central = "ส่วนกลาง";
/** A row's Project as the table and the Project filter name it. */
const projectOf = (row: LedgerRow) =>
  row.purpose === "project" ? row.project : central;
const hasFile = (row: LedgerRow) =>
  !!(row.entry ?? row.payNote)?.values.attachment ||
  isWebLink(row.entry?.values.link);
/** A column of the table, but the last (แก้ไข / ลบ): its head, and how its filter reads a
 *  row. `pick` offers what the ledger holds (a row may answer to more than one choice),
 *  `text` finds the typed words in it, `min` keeps a figure of the typed number or more. */
type Column = { name: string; label?: (value: string) => string } & (
  | { filter: "pick"; values: (row: LedgerRow) => string[] }
  | { filter: "text"; text: (row: LedgerRow) => string }
  | { filter: "min"; figure: (row: LedgerRow) => number | null }
);
/** The two ways money goes, as the table and its filters name them. */
const directions = { in: "รายรับ", out: "รายจ่าย" } as const;
const directionColumn = "รายรับ / รายจ่าย";
/** Money in with its sign ("+฿1,850"); `baht` already signs a negative. */
const signed = (x: number) => (Math.round(x) > 0 ? `+${baht(x)}` : baht(x));
/** The colour of a signed figure: green above zero, red below (the sign says it too). */
const signTone = (x: number) =>
  Math.round(x) > 0 ? "text-success" : Math.round(x) < 0 ? "text-danger" : "";
/** How `now` moved against the month before: `none` when that month had nothing. */
const versus = (now: number, before: number, none: string) => {
  const change = before ? ((now - before) / before) * 100 : null;
  return change === null
    ? none
    : change
      ? `${change > 0 ? "มากกว่า" : "น้อยกว่า"}เดือนก่อน ${qty(Math.round(Math.abs(change) * 10) / 10)}%`
      : "เท่ากับเดือนก่อน";
};
const sourceColumn = "ที่มา / ประเภทบิล";
const statusColumn = "สถานะ";
const columns: Column[] = [
  {
    name: "วันที่",
    filter: "pick",
    values: (row) => [row.date.slice(0, 7)],
    label: periodName,
  },
  {
    name: directionColumn,
    filter: "pick",
    values: (row) => [directions[row.direction]],
  },
  {
    name: sourceColumn,
    filter: "pick",
    // A PO row is also found under the two kinds of PO together (the PO รอจ่าย button).
    values: (row) =>
      row.origin === "po"
        ? [ledgerSources.po, row.sourceLabel]
        : [row.sourceLabel],
  },
  {
    name: "เลขที่อ้างอิง (PO / ใบเสร็จ)",
    filter: "text",
    text: (row) => row.reference,
  },
  { name: "ประเภทสินค้า", filter: "pick", values: (row) => [row.itemType] },
  { name: "รายการ", filter: "text", text: (row) => `${row.item} ${row.sku}` },
  { name: "รายละเอียด / สเปก", filter: "text", text: (row) => row.detail },
  // Who was paid, or on a รายรับ row who paid (the income form's รับจาก).
  { name: "ผู้ขาย / รับจาก", filter: "pick", values: (row) => [row.vendor] },
  {
    name: "รายการของ",
    filter: "pick",
    values: (row) => [ledgerPurposes[row.purpose]],
  },
  { name: "Project", filter: "pick", values: (row) => [projectOf(row)] },
  { name: "จำนวนซื้อ", filter: "min", figure: (row) => row.qty },
  {
    name: "ยอดตาม PO (งบที่กันไว้)",
    filter: "min",
    figure: (row) => row.poAmount,
  },
  {
    // One money column for both ways: the row's sign and colour say which.
    name: "ยอดรับ / จ่ายจริง",
    filter: "min",
    figure: (row) => (row.paid === null ? null : Math.abs(row.paid)),
  },
  {
    name: statusColumn,
    filter: "pick",
    // รอจ่าย / จ่ายแล้ว of money out, รอรับ / รับแล้ว of money in.
    values: (row) => [row.statusLabel],
  },
  {
    name: "เอกสารแนบ",
    filter: "pick",
    values: (row) => [hasFile(row) ? "มีไฟล์" : "ยังไม่มี"],
  },
];
/** The columns left of ยอดตาม PO: what the total row's label spans. */
const beforeTotals = columns.findIndex((c) => c.name.startsWith("ยอดตาม PO"));
/** Whether `row` passes what was picked or typed in `column`'s filter; all pass an empty one,
 *  and a minimum that is not a number. */
function passes(column: Column, row: LedgerRow, typed: string) {
  if (!typed) return true;
  if (column.filter === "pick") return column.values(row).includes(typed);
  if (column.filter === "text")
    return column.text(row).toLowerCase().includes(typed.toLowerCase());
  const min = Number(typed.replace(/,/g, ""));
  const figure = column.figure(row);
  return Number.isNaN(min) || (figure !== null && figure >= min);
}
/* A cell of the filter row: the head's fill, and narrow enough to keep the column's width. */
const filterCell =
  "border-b border-border-strong bg-surface-head py-1.5 align-middle";
/** The shop's ledger, money both ways. Out: every PO เนื้อ and PO รมควัน (worked out from the
 *  PO, its invoice and the payments to its supplier), every other money-out line of Finance
 *  (view only, as a PO row) and every expense jotted by hand. In: every income jotted by
 *  hand. Newest first, under the figures worked out from it (this month's money in, out and
 *  the net of the two; what is still awaited and what the POs still to pay hold) and the
 *  last six months as bars, with a search, a filter under the head of every column, and the
 *  totals of what is shown. Green is money that came in (รับแล้ว), not money awaited. */
export function AccountingPage({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  const { remove } = useEntryActions(ws);
  /** What each column's filter holds, by the column's name. */
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const all = ledgerRows(db);
  const word = search.trim().toLowerCase();
  const rows = all.filter(
    (row) =>
      columns.every((column) =>
        passes(column, row, (filters[column.name] ?? "").trim()),
      ) &&
      (!word ||
        [
          row.item,
          row.itemType,
          row.detail,
          row.vendor,
          row.reference,
          row.sku,
        ].some((text) => text.toLowerCase().includes(word))),
  );
  // A long ledger draws its first rows; the totals below still count every row found.
  const { limit, more } = useShowMore(
    [word, ...columns.map((column) => filters[column.name] ?? "")].join("|"),
  );
  const month = today.slice(0, 7);
  const summary = ledgerSummary(all, month);
  const net = summary.received - summary.paid;
  // The whole ledger, never the rows found: a filter must not redraw the months.
  const bars = Array.from({ length: 6 }, (_, at) => {
    const key = shiftKey(month, at - 5);
    const { received, paid } = ledgerSummary(all, key);
    return {
      label: thaiDay(`${key}-01`, { month: "short" }),
      title: periodName(key),
      in: received,
      out: paid,
    };
  });
  // The quick filter: the POs still to pay, in one click; a second click clears it.
  const poPending =
    filters[sourceColumn] === ledgerSources.po &&
    filters[statusColumn] === ledgerStatuses.pending;
  const filtered = !!search || Object.values(filters).some(Boolean);
  // A cancelled row holds no money.
  const counted = rows.filter((row) => row.status !== "cancelled");
  const total = (key: "poAmount" | "paid", list = counted) =>
    list.reduce((a, row) => a + (row[key] ?? 0), 0);
  // As ledgerSummary counts: money in once it came (รับแล้ว), not while it is awaited.
  const totalIn = total(
    "paid",
    counted.filter((row) => row.direction === "in" && row.status === "paid"),
  );
  const totalOut = total(
    "paid",
    counted.filter((row) => row.direction === "out"),
  );

  if (!all.length)
    return (
      <EmptyState text='ยังไม่มีรายการ PO เนื้อและ PO รมควันจากหน้า Lots จะอยู่ที่นี่ ส่วนรายจ่ายและรายรับอื่นจดได้จากปุ่ม "บันทึกค่าใช้จ่าย" และ "บันทึกรายรับ"' />
    );

  const cell = (row: LedgerRow) => {
    const e = row.entry;
    const pay = row.payNote;
    const item = row.item ? (
      <>
        <span className="block">{row.item}</span>
        {row.sku && <Caption as="span">{row.sku}</Caption>}
      </>
    ) : (
      <MissingMark />
    );
    const Purpose = row.purpose === "project" ? FolderKanban : Building2;
    const moneyIn = row.direction === "in";
    return (
      <tr key={row.id} data-source={row.origin} data-direction={row.direction}>
        <td className={cn(td, "whitespace-nowrap")}>{dateLabel(row.date)}</td>
        <td className={td}>
          <Badge tone={moneyIn ? "success" : "danger"}>
            {directions[row.direction]}
          </Badge>
        </td>
        <td className={cn(td, "whitespace-nowrap")}>
          {row.sourceLabel || none}
        </td>
        <td className={cn(td, "whitespace-nowrap")}>
          {row.lotId ? (
            <Button variant="link" onClick={() => ws.showLot(row.lotId!)}>
              {row.reference}
            </Button>
          ) : (
            row.reference || none
          )}
        </td>
        <td className={td}>{row.itemType || <MissingMark />}</td>
        <td className={cn(td, "min-w-36")}>{item}</td>
        <td className={cn(td, "min-w-36")}>{row.detail || none}</td>
        <td className={td}>{row.vendor || none}</td>
        <td className={cn(td, "whitespace-nowrap")}>
          <span className="inline-flex items-center gap-1.5">
            <Purpose size={16} aria-hidden className="text-text-secondary" />
            {ledgerPurposes[row.purpose]}
          </span>
        </td>
        <td className={cn(td, "whitespace-nowrap")}>
          {row.purpose === "project" ? (
            row.project || <MissingMark />
          ) : (
            <Muted as="span">{central}</Muted>
          )}
        </td>
        <Num>
          {row.qty === null
            ? none
            : `${qty(row.qty)}${row.unit && ` ${row.unit}`}`}
        </Num>
        <Num>{row.poAmount === null ? none : baht(row.poAmount)}</Num>
        {/* Green once the money is in; one still awaited keeps its sign, not the colour. */}
        <Num tone={moneyIn && row.status === "paid" ? "in" : undefined}>
          {row.paid === null
            ? none
            : moneyIn
              ? signed(row.paid)
              : baht(row.paid)}
        </Num>
        <td className={td}>
          <Badge tone={statusTone[row.status]}>{row.statusLabel}</Badge>
        </td>
        <td className={cn(td, "whitespace-nowrap")}>
          {row.lotId ? (
            <Button variant="table" onClick={() => ws.showLot(row.lotId!)}>
              เปิด PO
            </Button>
          ) : pay?.values.attachment ? (
            <AttachmentButton
              action="view"
              label="เปิดเอกสาร"
              name={pay.values.attachment}
              data={pay.values.attachmentData}
              storageKey={pay.values.attachmentStorageKey}
            />
          ) : pay && !editBlock(db, pay, account) ? (
            // The file field is on the note's own form.
            <Button variant="table" onClick={() => ws.edit(pay.id)}>
              แนบเอกสาร
            </Button>
          ) : e?.values.attachment || isWebLink(e?.values.link) ? (
            <div className="flex flex-col items-start gap-1">
              {e?.values.attachment && (
                <AttachmentButton
                  action="view"
                  name={e.values.attachment}
                  data={e.values.attachmentData}
                  storageKey={e.values.attachmentStorageKey}
                />
              )}
              {isWebLink(e?.values.link) && (
                <a
                  href={e!.values.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-body-sm text-accent underline-offset-4 hover:underline pointer-coarse:min-h-11"
                >
                  เปิดลิงก์
                </a>
              )}
            </div>
          ) : (
            none
          )}
        </td>
        <td className={cn(td, "px-2 whitespace-nowrap")}>
          {e && (
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
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Notice className="my-0 text-body-sm">
        PO เนื้อและ PO รมควันจากหน้า Lots อยู่ในตารางนี้เป็นรายการรอจ่าย
        ยอดจ่ายจริงคิดจากรายการจ่ายเงินให้ผู้ขาย รายการจ่ายเงินอื่นจากหน้า
        Finance ขึ้นเองเป็นแถวจ่ายแล้ว ส่วนเงินที่ได้รับจดจากปุ่ม
        「บันทึกรายรับ」 ขึ้นเป็นแถวรายรับ
      </Notice>
      {/* Two groups, not five tiles: what moved this month (in, out, net), then what is
          still open, of any month. */}
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Panel aria-label="สรุปเดือนนี้">
          <h2 className="m-0 mb-3 text-label text-text-secondary">
            เดือนนี้ · {periodName(month)}
          </h2>
          <div className="grid grid-cols-3 gap-4 max-md:grid-cols-2 max-md:gap-3">
            <Stat
              label="รายรับเดือนนี้"
              value={
                <span className={signTone(summary.received)}>
                  {signed(summary.received)}
                </span>
              }
              note={versus(
                summary.received,
                summary.receivedBefore,
                "เดือนก่อนไม่มีรายรับ",
              )}
            />
            <Stat
              label="ยอดจ่ายจริงเดือนนี้"
              value={baht(summary.paid)}
              note={versus(
                summary.paid,
                summary.paidBefore,
                "เดือนก่อนไม่มียอดจ่าย",
              )}
            />
            <Stat
              className="max-md:col-span-2"
              label="สุทธิเดือนนี้"
              value={<span className={signTone(net)}>{signed(net)}</span>}
              note="รายรับ − ยอดจ่ายจริง"
            />
          </div>
        </Panel>
        <Panel aria-label="สรุปรายการที่ยังรอ">
          <h2 className="m-0 mb-3 text-label text-text-secondary">
            ยังรอรับ / รอจ่าย
          </h2>
          <div className="grid grid-cols-2 gap-4 max-md:gap-3">
            <Stat
              label="รอรับ"
              value={
                <span className={cn(summary.pendingIn.count && "text-warning")}>
                  {baht(summary.pendingIn.amount)}
                </span>
              }
              note={`${summary.pendingIn.count} รายการ`}
            />
            <Stat
              label="งบที่กันไว้จาก PO"
              value={baht(summary.reserved)}
              note={`${summary.waiting} รายการที่ยังรอจ่าย`}
            />
          </div>
        </Panel>
      </div>
      <Panel aria-label="รายรับ–รายจ่าย 6 เดือนล่าสุด">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="m-0 text-label text-text-secondary">
            รายรับ–รายจ่าย 6 เดือนล่าสุด
          </h2>
          <Caption>คิดจากทุกรายการในบัญชี ไม่เปลี่ยนตามตัวกรองของตาราง</Caption>
        </div>
        <CashFlowChart
          label={`กราฟแท่งรายรับและรายจ่าย 6 เดือนล่าสุด เดือนนี้รับ ${baht(summary.received)} จ่าย ${baht(summary.paid)}`}
          unit="เดือน"
          bars={bars}
        />
      </Panel>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Input
          type="search"
          variant="filter"
          aria-label="ค้นหา"
          placeholder="ค้นหารายการ ประเภท ผู้ขาย เลขอ้างอิง หรือ SKU"
          className="min-w-64 flex-1 max-md:basis-full"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {/* The same state as the filter under the column's head: one filter, two controls. */}
        <SegmentedChoice
          label={directionColumn}
          value={filters[directionColumn] ?? ""}
          onChange={(value) =>
            setFilters({ ...filters, [directionColumn]: value })
          }
          options={[
            { value: "", label: "ทั้งหมด" },
            ...Object.values(directions).map((value) => ({
              value,
              label: value,
            })),
          ]}
        />
        <Button
          size="sm"
          aria-pressed={poPending}
          className="min-h-10 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-fg"
          onClick={() => {
            setFilters({
              ...filters,
              // A PO is money out: รายรับ picked beside it would find nothing.
              ...(filters[directionColumn] === directions.in && {
                [directionColumn]: "",
              }),
              [sourceColumn]: poPending ? "" : ledgerSources.po,
              [statusColumn]: poPending ? "" : ledgerStatuses.pending,
            });
          }}
        >
          PO รอจ่าย ({summary.waiting})
        </Button>
        {filtered && (
          <Button
            size="sm"
            className="min-h-10"
            onClick={() => {
              setFilters({});
              setSearch("");
            }}
          >
            ล้างตัวกรอง
          </Button>
        )}
      </div>
      <Panel flush className="overflow-hidden">
        {/* relative: the sr-only head of the last column scrolls with the table, not the page. */}
        <div className="relative overflow-x-auto">
          <table
            // The ledger's grid: a line between columns, and the row under the pointer;
            // narrower cells than the other tables, so more of its columns fit.
            className="w-full border-collapse [&_tbody_tr:hover]:bg-surface-sunken [&_td]:border-r [&_td]:px-3 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:px-3 [&_th:last-child]:border-r-0"
            aria-label="บัญชีรายรับรายจ่าย"
          >
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.name}
                    className={cn(th, column.filter === "min" && "text-right")}
                  >
                    {column.name}
                  </th>
                ))}
                <th className={th}>
                  <span className="sr-only">แก้ไข / ลบ</span>
                </th>
              </tr>
              {/* td, not th: a filter is no heading of its column. */}
              <tr>
                {columns.map((column) => {
                  const control = {
                    variant: "filter" as const,
                    "aria-label": `กรอง ${column.name}`,
                    value: filters[column.name] ?? "",
                  };
                  const set = (value: string) =>
                    setFilters({ ...filters, [column.name]: value });
                  return (
                    <td key={column.name} className={filterCell}>
                      {column.filter === "pick" ? (
                        <Select
                          {...control}
                          className="w-full min-w-24"
                          onChange={set}
                          options={[
                            { value: "", label: "ทั้งหมด" },
                            ...[...new Set(all.flatMap(column.values))]
                              .filter(Boolean)
                              .map((value) => ({
                                value,
                                label: column.label?.(value),
                              })),
                          ]}
                        />
                      ) : (
                        <Input
                          {...control}
                          className={cn(
                            "w-full min-w-20",
                            column.filter === "min" && "text-right",
                          )}
                          placeholder={column.filter === "min" ? "≥" : "ค้นหา"}
                          inputMode={
                            column.filter === "min" ? "decimal" : undefined
                          }
                          onChange={(event) => set(event.target.value)}
                        />
                      )}
                    </td>
                  );
                })}
                <td className={filterCell} />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map(cell)}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className={cn(td, "text-text-secondary")}
                  >
                    ไม่มีรายการตามตัวกรอง
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                {/* align-top: the first line of the money cell sits on the row's line. */}
                <tr className="[&>td]:align-top">
                  <td colSpan={beforeTotals} className={cn(td, tf)}>
                    รวม {counted.length} รายการ
                    {counted.length < rows.length && (
                      <Caption as="span"> (ไม่รวมที่ยกเลิก)</Caption>
                    )}
                  </td>
                  <Num className={tf}>{baht(total("poAmount"))}</Num>
                  <Num className={tf}>
                    <span className="grid grid-cols-[auto_auto] items-baseline justify-end gap-x-3 gap-y-1">
                      <Caption as="span">รวมรับ</Caption>
                      <span className={signTone(totalIn)}>
                        {signed(totalIn)}
                      </span>
                      <Caption as="span">รวมจ่าย</Caption>
                      <span>{baht(totalOut)}</span>
                      <Caption as="span">สุทธิ</Caption>
                      <span className={signTone(totalIn - totalOut)}>
                        {signed(totalIn - totalOut)}
                      </span>
                    </span>
                  </Num>
                  <td colSpan={3} className={cn(td, tf)} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <ShowMore
          shown={Math.min(limit, rows.length)}
          total={rows.length}
          onMore={more}
        />
      </Panel>
      <Caption aria-live="polite">
        {rows.length} จาก {all.length} รายการ
      </Caption>
    </div>
  );
}
