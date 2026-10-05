"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Caption, Muted } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import { FormError } from "@/components/molecules/FormError";
import { timeOf } from "@/components/organisms/shared/noteText";
import { td, th } from "@/components/organisms/shared/tableCell";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { dateLabel, qty as fmt, thaiDay } from "@/lib/format";
import { latestDatabase } from "@/lib/persistence";
import {
  branchChili,
  branchMaterial,
  branchMeat,
  branchRice,
  materialList,
  mutate,
  pendingTransfers,
  placeLabel,
  rawRiceBranches,
  stockLines,
  titles,
  type CountVariance,
  type Entry,
  type Values,
} from "@/lib/store";
import { cn } from "@/lib/utils";

const tones = {
  warning: "bg-warning-subtle font-medium text-warning",
  success: "bg-success-subtle font-medium text-success",
  danger: "bg-danger-subtle font-medium text-danger",
};

/** A table cell. `tone` fills it (yellow not counted, green counted, red below zero) and is
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
  children,
}: {
  columns: string[];
  right?: string[];
  wideOnly?: string[];
  /** Columns whose long header may break, so it does not set the column's width. */
  wrap?: string[];
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

/** What is left at one place and its last count (`branchMaterial`, `branchChili`). */
export type Held = {
  qty: number;
  countedOn: string;
  stale: boolean;
  variance?: CountVariance;
};

/** "+3", "−2.5", "0": a difference to two decimals, as `fmt` rounds. */
const signed = (x: number) => {
  const r = Math.round(x * 100) / 100;
  return r === 0 ? "0" : `${r < 0 ? "−" : "+"}${fmt(Math.abs(r))}`;
};

/** `fmt` with the minus sign `signed` writes (U+2212), so both lines of a `Variance` agree. */
const minus = (x: number) => fmt(x).replace("-", "−");

/** The latest count against what the web expected just before it: the signed difference,
 *  and under it the two figures it comes from. A plain figure in the text colour, never a
 *  warning (V2-RUL-05). `label` is for a cell that holds other figures: it names the
 *  difference and leaves the date to the cell; without it the count's date is said here. */
export function Variance({
  variance,
  unit,
  label,
}: {
  variance: CountVariance;
  unit: string;
  label?: boolean;
}) {
  return (
    <span data-variance={signed(variance.diff)} className="text-text-primary">
      {label && "ส่วนต่าง "}
      {signed(variance.diff)} {unit}
      {/* May wrap in a narrow table, but only between its parts, so it never sets the
          column's width. */}
      <span className="block text-caption font-normal whitespace-normal text-text-secondary">
        <span className="whitespace-nowrap">{`ควรเหลือ ${minus(variance.expected)} ·`}</span>{" "}
        <span className="whitespace-nowrap">{`นับได้ ${minus(variance.counted)}${label ? "" : " ·"}`}</span>
        {!label && " "}
        {!label && (
          <span className="whitespace-nowrap">{`นับ ${thaiDay(variance.date)}`}</span>
        )}
      </span>
    </span>
  );
}

/** One place's cell of a row: the figure, and under it the last count. Red with nothing
 *  left, yellow with a late count; no cell at all (a dash) where the item cannot be.
 *  `varianceUnit` (the Owner's pages only) adds the last count's `Variance` in that unit. */
export function HeldCell({
  held,
  today,
  varianceUnit,
}: {
  held?: Held;
  today: string;
  varianceUnit?: string;
}) {
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
      {varianceUnit && held.variance && (
        <span className="mt-1 block text-caption font-normal">
          <Variance variance={held.variance} unit={varianceUnit} label />
        </span>
      )}
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
}: {
  at: Record<string, Held>;
  places: string[];
  extra?: number;
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
      />
    </>
  );
}

/** A row of a branch's count table. `count` is the key its count is saved under in the
 *  `materials` note; a row without one (the chili) is counted in the sale form. */
type CountRow = {
  id: string;
  sku?: string;
  name: string;
  held: Held;
  count?: string;
};

/** A branch's own table of what is left, in the columns of the Owner's (the figure with the
 *  last count under it, the status), plus an input per row. 「บันทึกยอดนับ」 saves one
 *  `materials` note dated today that holds only the rows typed (V2-BR-03). */
function CountTable({
  ws,
  title,
  rows,
  sku,
  aside,
}: {
  ws: Workspace;
  title: string;
  rows: CountRow[];
  /** A leading SKU column (the materials). */
  sku?: boolean;
  aside?: ReactNode;
}) {
  const { account, today } = ws;
  const [counts, setCounts] = useState<Values>({});
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  const columns = [
    // Inventory names its rows as the Owner's does; the Stock page keeps "สินค้า".
    ...(sku ? ["SKU", "รายการ"] : ["สินค้า"]),
    "คงเหลือ",
    "สถานะ",
    "นับได้",
  ];
  const save = async () => {
    setError("");
    const typed = Object.fromEntries(
      Object.entries(counts).filter(([, value]) => value.trim()),
    );
    const next = await run(() =>
      mutate(latestDatabase(), account, "materials", typed, "", today),
    );
    if (!next) return;
    setCounts({});
    ws.setToast(
      `จดแล้ว: ${titles.materials} · ${Object.keys(typed).length} รายการ`,
    );
  };
  return (
    <DayCard
      aria-label={title}
      title={title}
      // A light rule between the columns.
      className="[&_:is(td,th)+:is(td,th)]:border-l"
      aside={aside}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        {/* A phone keeps the name, the figure (its fill says the status) and the input. */}
        <StockTable
          columns={columns}
          right={["คงเหลือ", "นับได้"]}
          wideOnly={["SKU", "สถานะ"]}
        >
          {rows.map(({ id, sku: code, name, held, count }) => (
            <tr key={id}>
              {sku && (
                <Cell className="font-mono whitespace-nowrap text-accent max-md:hidden">
                  {code || <Muted as="span">—</Muted>}
                </Cell>
              )}
              <Cell className="font-semibold md:whitespace-nowrap">{name}</Cell>
              <HeldCell held={held} today={today} />
              <StatusCell
                total={held.qty}
                late={held.stale ? "ยังไม่ได้นับ" : undefined}
                className="max-md:hidden"
              />
              {count ? (
                <Cell right className="py-1.5">
                  {/* Text, not number: `mutate` words the refusal of a bad figure. */}
                  <Input
                    inputMode="decimal"
                    aria-label={`นับ ${name}`}
                    className="mt-0 ml-auto min-h-10 w-24 text-right max-md:w-20"
                    value={counts[count] ?? ""}
                    onChange={(event) => {
                      setError("");
                      setCounts({ ...counts, [count]: event.target.value });
                    }}
                  />
                </Cell>
              ) : (
                <Cell right className="font-normal text-text-secondary">
                  นับในฟอร์มยอดขาย
                </Cell>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <Cell
                colSpan={columns.length}
                className="py-8 text-center text-text-secondary"
              >
                ไม่พบรายการที่ตรงกับที่ค้นหา
              </Cell>
            </tr>
          )}
        </StockTable>
        {/* Only the chili: nothing to type here. */}
        {rows.some((row) => row.count) && (
          <>
            <FormError error={error} className="mx-5 mt-3 mb-0 max-md:mx-4" />
            <div className="flex justify-center px-5 pt-3 pb-4">
              <Button type="submit" variant="primary" disabled={saving}>
                บันทึกยอดนับ
              </Button>
            </div>
          </>
        )}
      </form>
    </DayCard>
  );
}

const legend =
  "ช่องสีเหลือง = ยังไม่เคยนับ หรือไม่ได้นับเกิน 7 วัน · ช่องสีแดง = ไม่เหลือ";

/** A branch's Stock, what `OwnerMeatStock` is to the Owner: its meat (yellow until it is
 *  counted today, V2-BR-02), then its raw rice (a branch that steams its own, V2-BR-08) and
 *  its chili. */
export function BranchMeatStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const branch = ws.account.branch ?? "";
  const meat = branchMeat(db, branch, today);
  const done = meat.countedToday;
  const steams = rawRiceBranches(db.config).includes(branch);
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="เนื้อคงเหลือ"
        data-tone={done ? "success" : "warning"}
        className={cn(
          "flex flex-col gap-3 rounded-lg border p-5 max-md:p-4",
          done
            ? "border-success/30 bg-success-subtle"
            : "border-warning/40 bg-warning-subtle",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2
            className={cn(
              "m-0 text-h2",
              meat.kg < 0
                ? "text-danger"
                : done
                  ? "text-success"
                  : "text-warning",
            )}
          >
            เนื้อคงเหลือ {fmt(meat.kg)} กก.
          </h2>
          <Badge
            tone={done ? "success" : "warning"}
            className={cn(
              "border",
              done ? "border-success/30" : "border-warning/40",
            )}
          >
            {done ? "นับแล้ววันนี้" : "วันนี้ยังไม่ได้นับ"}
          </Badge>
        </div>
        <Caption>
          นับล่าสุด{" "}
          {meat.counted
            ? `${thaiDay(meat.counted.date)} ${timeOf(meat.counted.at)} ได้ ${fmt(Number(meat.counted.values.kg))} กก.`
            : "ยังไม่เคยนับ"}{" "}
          · หลังจากนั้นเว็บบวกเนื้อที่รับเข้า และหักเนื้อที่ใช้กับที่เสีย
        </Caption>
        <Button
          className="self-start"
          onClick={() => ws.jot({ kind: "meatCount" })}
        >
          นับเนื้อคงเหลือ
        </Button>
      </section>
      <CountTable
        ws={ws}
        title={steams ? "ข้าวเหนียวและน้ำพริก" : "น้ำพริก"}
        rows={[
          ...(steams
            ? [
                {
                  id: "rice",
                  name: "ข้าวเหนียวดิบ (กก.)",
                  held: branchRice(db, branch, today),
                  count: "count.rice",
                },
              ]
            : []),
          {
            id: "chili",
            name: "น้ำพริก (หลอด)",
            held: branchChili(db, branch, today),
          },
        ]}
      />
      <Caption>
        {steams &&
          "ข้าวเหนียวดิบ: ยอดนับล่าสุด บวกที่ซื้อเข้าสาขาหลังจากนั้น เว็บไม่ตัดยอดเอง · "}
        น้ำพริกนับในฟอร์มยอดขาย · {legend} · วัสดุอยู่ที่หน้า Inventory
      </Caption>
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
        columns={["วันที่", "รายการ", "จำนวน", "จากคลัง", "ยืนยัน"]}
        right={["จำนวน", "ยืนยัน"]}
        wideOnly={["วันที่", "จากคลัง"]}
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

/** A branch's Inventory, what `OwnerStock` is to the Owner: the transfers waiting for it to
 *  confirm (`PendingTransfers`, only while there are any), its materials, a row per material
 *  with the count inputs the Owner's has not, and, read-only, whatever else it holds: every
 *  SKU that is not a Settings material and whose balance at the branch is not zero. One
 *  search over the two tables. */
export function BranchStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const branch = ws.account.branch ?? "";
  const [search, setSearch] = useState("");
  const pending = pendingTransfers(db, branch);
  const rows = materialList(db.config).map((m) => ({
    id: m.id,
    // "" until the materials list is saved again (a list stored before SKUs).
    sku: m.sku,
    name: m.name,
    held: branchMaterial(db, branch, m.id, today),
    count: `count.${m.id}`,
  }));
  const word = search.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      !word ||
      row.name.toLowerCase().includes(word) ||
      row.sku.toLowerCase().includes(word),
  );
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
        placeholder="ค้นหาสินค้า หรือ SKU"
        className="min-h-11"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {pending.length > 0 && <PendingTransfers ws={ws} rows={pending} />}
      <CountTable
        ws={ws}
        title="วัสดุ"
        sku
        rows={shown}
        aside={
          <Caption aria-live="polite">
            แสดง {shown.length} จาก {rows.length} รายการ
          </Caption>
        }
      />
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
      <Caption>
        ใส่เฉพาะรายการที่นับ ยอดที่นับล่าสุดคือยอดจริง · วัสดุนับเป็นชิ้น ·{" "}
        {legend} · รอยืนยันรับสินค้า = ของที่ส่งมาให้สาขา
        กด「ยืนยันรับ」แล้วจึงเข้ายอดของสาขา · สินทรัพย์อื่นของสาขา =
        ของที่ซื้อเข้าหรือจัดสรรมาให้สาขา ไม่ต้องนับ ตัวเลขสีแดง = ติดลบ · เนื้อ
        ข้าวเหนียว และน้ำพริกอยู่ที่หน้า Stock
      </Caption>
    </div>
  );
}
