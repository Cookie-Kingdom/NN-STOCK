"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Caption, Muted } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import { FormError } from "@/components/molecules/FormError";
import { td, th } from "@/components/organisms/shared/tableCell";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { dateLabel, qty as fmt, thaiDay } from "@/lib/format";
import { latestDatabase } from "@/lib/persistence";
import {
  mutate,
  pendingTransfers,
  placeLabel,
  stockLines,
  titles,
  type Entry,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { DailySheet } from "./DailySheet";

const tones = {
  warning: "bg-warning-subtle font-medium text-warning",
  success: "bg-success-subtle font-medium text-success",
  danger: "bg-danger-subtle font-medium text-danger",
};

/** A table cell. `tone` fills it (yellow late, green ready, red below zero) and is
 *  also `data-tone`, for the tests; `right` is a figure. */
export function Cell({
  tone,
  right,
  className,
  ...props
}: ComponentProps<"td"> & { tone?: keyof typeof tones; right?: boolean }) {
  return (
    <td
      data-tone={tone}
      className={cn(
        td,
        right && "text-right font-medium whitespace-nowrap",
        tone && tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** `columns` named in `right` hold figures; those in `wideOnly` are left out on a phone
 *  (their cells hide themselves, `max-md:hidden`). */
export function StockTable({
  columns,
  right = [],
  wideOnly = [],
  wrap = [],
  foot,
  children,
}: {
  columns: string[];
  right?: string[];
  wideOnly?: string[];
  /** Columns whose long header may break, so it does not set the column's width. */
  wrap?: string[];
  /** The total row(s), in a `tfoot`. */
  foot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse tabular-nums">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className={cn(
                  th,
                  right.includes(column) && "text-right",
                  wideOnly.includes(column) && "max-md:hidden",
                  wrap.includes(column) && "whitespace-normal",
                )}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {foot && <tfoot>{foot}</tfoot>}
      </table>
    </div>
  );
}

/** What is left: red below zero. */
export const Left = ({ n }: { n: number }) => (
  <Cell right tone={n < 0 ? "danger" : undefined}>
    {fmt(n)}
  </Cell>
);

/** What is left at one place and its last count. */
export type Held = { qty: number; countedOn: string; stale: boolean };

/** One place's cell of a row: the figure, and under it the last count. Red with nothing
 *  left, yellow with a late count; no cell at all (a dash) where the item cannot be. */
export function HeldCell({ held, today }: { held?: Held; today: string }) {
  if (!held)
    return (
      <Cell right>
        <Muted as="span">—</Muted>
      </Cell>
    );
  const { qty, countedOn, stale } = held;
  return (
    <Cell right tone={qty <= 0 ? "danger" : stale ? "warning" : undefined}>
      {fmt(qty)}
      <span className="block text-caption font-normal">
        {!countedOn
          ? "ยังไม่เคยนับ"
          : countedOn === today
            ? "นับวันนี้"
            : `นับ ${thaiDay(countedOn)}${stale ? " · เกิน 7 วัน" : ""}`}
      </span>
    </Cell>
  );
}

/** A row's status: out, a late count (`late` says it, and where), or ready. */
export function StatusCell({
  total,
  late,
  className,
}: {
  total: number;
  late?: string;
  className?: string;
}) {
  return (
    <Cell
      tone={total <= 0 ? "danger" : late ? "warning" : "success"}
      className={cn("whitespace-nowrap", className)}
    >
      {total <= 0 ? "หมด" : late || "พร้อมใช้"}
    </Cell>
  );
}

/** A row's total and status over `places`. `extra` is what the row holds where nothing is
 *  counted (the central warehouse, in transit): in the total, never late. */
export function StatusCells({
  at,
  places,
  extra = 0,
  className,
}: {
  at: Record<string, Held>;
  places: string[];
  extra?: number;
  /** Of the status cell. */
  className?: string;
}) {
  const total = places.reduce(
    (sum, place) => sum + (at[place]?.qty ?? 0),
    extra,
  );
  const late = places.filter((place) => at[place]?.stale);
  return (
    <>
      <Cell right tone={total < 0 ? "danger" : undefined}>
        {fmt(total)}
      </Cell>
      <StatusCell
        total={total}
        late={late.length ? `ยังไม่ได้นับ: ${late.join(", ")}` : undefined}
        className={className}
      />
    </>
  );
}

/** A branch's Stock: the daily sheet of its meat, its raw rice (a branch that steams its
 *  own, V2-BR-08) and its chili. */
export function BranchMeatStock({ ws }: { ws: Workspace }) {
  return (
    <div className="flex flex-col gap-4">
      <DailySheet ws={ws} sheet="meat" />
      <Caption>วัสดุอยู่ที่หน้า Inventory</Caption>
    </div>
  );
}

/** The transfers sent to a branch with "สาขาต้องกดยืนยันรับ" that it has yet to confirm, a row
 *  each. 「ยืนยันรับ」 saves a `transferReceive` dated today for the whole transfer: from then
 *  on the quantity is in the branch's stock. */
function PendingTransfers({ ws, rows }: { ws: Workspace; rows: Entry[] }) {
  const { account, today } = ws;
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  const receive = async ({ id, values: v }: Entry) => {
    setError("");
    const next = await run(() =>
      mutate(
        latestDatabase(),
        account,
        "transferReceive",
        { transferId: id },
        "",
        today,
      ),
    );
    if (next)
      ws.setToast(
        `จดแล้ว: ${titles.transferReceive} · ${v.itemName} ${fmt(Number(v.qty))}`,
      );
  };
  return (
    <DayCard
      aria-label="รอยืนยันรับสินค้า"
      title="รอยืนยันรับสินค้า"
      tone="warning"
      className="[&_:is(td,th)+:is(td,th)]:border-l"
      aside={<Caption>{rows.length} รายการ</Caption>}
    >
      {/* A phone keeps the name, the quantity and the button. */}
      <StockTable
        columns={["วันที่", "รายการ", "จำนวน", "คลังต้นทาง", "ยืนยัน"]}
        right={["จำนวน", "ยืนยัน"]}
        wideOnly={["วันที่", "คลังต้นทาง"]}
      >
        {rows.map((e) => (
          <tr key={e.id}>
            <Cell className="whitespace-nowrap max-md:hidden">
              {dateLabel(e.date)}
            </Cell>
            <Cell className="font-semibold">
              {e.values.itemName}
              <span className="block font-mono text-caption font-normal text-accent">
                {e.values.sku}
              </span>
            </Cell>
            <Cell right>{fmt(Number(e.values.qty))}</Cell>
            <Cell className="whitespace-nowrap max-md:hidden">
              {placeLabel(e.values.from)}
            </Cell>
            <Cell right className="py-1.5">
              <Button
                variant="primary"
                aria-label={`ยืนยันรับ ${e.values.itemName}`}
                disabled={saving}
                onClick={() => receive(e)}
              >
                ยืนยันรับ
              </Button>
            </Cell>
          </tr>
        ))}
      </StockTable>
      <FormError error={error} className="mx-5 my-3 max-md:mx-4" />
    </DayCard>
  );
}

/** A branch's Inventory: the transfers waiting for it to confirm (`PendingTransfers`, only
 *  while there are any), the daily sheet of its materials and, read-only, whatever else it
 *  holds: every SKU that is not a material of the list and whose balance at the branch is not
 *  zero. One search over the sheet's rows and that table. */
export function BranchStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const branch = ws.account.branch ?? "";
  const [search, setSearch] = useState("");
  const pending = pendingTransfers(db, branch);
  const word = search.trim().toLowerCase();
  const others = stockLines(db, today).filter(
    (line) =>
      !line.materialId &&
      (line.at[branch] ?? 0) !== 0 &&
      (!word ||
        line.name.toLowerCase().includes(word) ||
        line.sku.toLowerCase().includes(word)),
  );
  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        variant="filter"
        aria-label="ค้นหา"
        placeholder="ค้นหารายการ หรือ SKU"
        className="min-h-11"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {pending.length > 0 && <PendingTransfers ws={ws} rows={pending} />}
      <DailySheet ws={ws} sheet="materials" word={word} />
      {others.length > 0 && (
        <DayCard
          aria-label="สินทรัพย์อื่นของสาขา"
          title="สินทรัพย์อื่นของสาขา"
          className="[&_:is(td,th)+:is(td,th)]:border-l"
          aside={<Caption>{others.length} รายการ</Caption>}
        >
          <StockTable
            columns={["SKU", "รายการ", "คงเหลือ"]}
            right={["คงเหลือ"]}
          >
            {others.map((line) => (
              <tr key={line.sku}>
                <Cell className="font-mono whitespace-nowrap text-accent">
                  {line.sku}
                </Cell>
                <Cell className="font-semibold">
                  {line.name || <Muted as="span">—</Muted>}
                </Cell>
                <Left n={line.at[branch]} />
              </tr>
            ))}
          </StockTable>
        </DayCard>
      )}
      {/* A line per subject, close together: one note, not four. */}
      <div className="flex flex-col gap-1">
        <Caption>
          {
            '"รอยืนยันรับสินค้า" คือของที่ส่งมาให้สาขา จะเข้ายอดของสาขาเมื่อกด "ยืนยันรับ"'
          }
        </Caption>
        <Caption>
          {
            '"สินทรัพย์อื่นของสาขา" คือของที่ซื้อเข้าหรือจัดสรรมาให้สาขา ไม่อยู่ในใบสต๊อกรายวัน ตัวเลขสีแดงคือยอดติดลบ'
          }
        </Caption>
        <Caption>เนื้อ ข้าวเหนียว และน้ำพริกอยู่ที่หน้า Stock</Caption>
      </div>
    </div>
  );
}
