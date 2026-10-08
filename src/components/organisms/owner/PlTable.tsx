import type { ComponentProps, ReactNode } from "react";
import { Caption } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import { td, th } from "@/components/organisms/shared/tableCell";
import { baht } from "@/lib/format";
import { periodName, shiftKey } from "@/lib/period";
import {
  capexCategory,
  missingText,
  monthPl,
  payCategories,
  payrollCategory,
  rentCategory,
  salesChannels,
  type Database,
} from "@/lib/store";
import { cn } from "@/lib/utils";

const tones = {
  in: "text-success",
  out: "text-danger",
  warning: "bg-warning-subtle text-warning",
  ok: "bg-success-subtle text-success",
};

/** A right-aligned figure cell. `in` / `out` colour the figure (money in, money out);
 *  `warning` / `ok` fill the cell (not jotted or not paid yet, paid in full). */
export function Num({
  tone,
  className,
  ...props
}: ComponentProps<"td"> & { tone?: keyof typeof tones }) {
  return (
    <td
      data-tone={tone}
      className={cn(
        td,
        "text-right font-medium whitespace-nowrap tabular-nums",
        tone && tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** A card with a title, a muted note beside it and a figure table under them. */
export function FigureCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DayCard
      aria-label={title}
      title={title}
      aside={note && <Caption>{note}</Caption>}
    >
      {children}
    </DayCard>
  );
}
export const FigureTable = (props: ComponentProps<"table">) => (
  // relative: an sr-only column head scrolls with the table, not the page.
  <div className="relative overflow-x-auto">
    <table className="w-full border-collapse" {...props} />
  </div>
);

export const percent = (x: number) =>
  `${x.toLocaleString("th-TH", { maximumFractionDigits: Math.abs(x) < 10 ? 1 : 0 })}%`;
/** `part` of `whole` as a percentage; nothing when there is no whole. */
export const share = (part: number, whole: number) =>
  whole ? percent((part / whole) * 100) : "";

/** Green in, red out, a dash for nothing. */
const Money = ({ x }: { x: number }) => (
  <Num tone={x > 0 ? "in" : x < 0 ? "out" : undefined}>{x ? baht(x) : "—"}</Num>
);

/** The month (or the year: `month` is then `YYYY`) and the one before it, side by side
 *  (V2-CAL-02). `full` (the Owner): sales, GP
 *  per channel, every category, the operating profit, then อุปกรณ์/ลงทุน on its own line.
 *  Without it: the categories only and what they add up to, with payroll for the Owner
 *  (`payroll`), never for the Account Manager. ค่าเช่า/น้ำไฟ with nothing jotted in the month is yellow (V2-PAY-04). */
export function PlTable({
  db,
  month,
  full = false,
  payroll = full,
}: {
  db: Database;
  month: string;
  full?: boolean;
  payroll?: boolean;
}) {
  const months = [month, shiftKey(month, -1)];
  const span = month.length === 4 ? "ปี" : "เดือน";
  const [a, b] = months.map((m) => monthPl(db, m));
  const names = Object.fromEntries(
    payCategories(db.config).map((c) => [c.id, c.name]),
  );
  // Also a category that Settings no longer lists but a payment still carries.
  const ids = [
    ...new Set([...Object.keys(a.byCategory), ...Object.keys(b.byCategory)]),
  ].filter((id) => id !== capexCategory && (payroll || id !== payrollCategory));
  const of = (pl: typeof a, id: string) => pl.byCategory[id] ?? 0;
  const paid = (pl: typeof a) => ids.reduce((all, id) => all + of(pl, id), 0);
  /* This period's line as a share of this period's sales, signed like the figure beside it.
   * `full` only: beside the categories alone it would give the sales away (V2-ACC-01).
   * Hidden on a phone, as the secondary columns of the other figure tables are. */
  const ofSales = (x: number) =>
    full && (
      <Num className="max-md:hidden">
        {x && a.sales
          ? `${x < 0 ? "−" : ""}${share(Math.abs(x), a.sales)}`
          : "—"}
      </Num>
    );
  const line = (name: string, x: number, y: number, total = false) => (
    <tr key={name} className={cn(total && "bg-surface-sunken font-semibold")}>
      <td className={td}>{name}</td>
      <Money x={x} />
      {ofSales(x)}
      <Money x={y} />
    </tr>
  );
  return (
    <FigureCard
      title={full ? `P&L ราย${span}` : "ยอดจ่ายแยกหมวด"}
      note={
        full
          ? `ยอดตาม${span}ที่จ่ายเงิน เป็นตัวเลขประมาณสำหรับบริหาร ไม่ใช่งบสำหรับยื่นภาษี`
          : `ยอดตาม${span}ที่จ่ายเงิน`
      }
    >
      <FigureTable>
        <thead>
          <tr>
            <th className={th}>รายการ</th>
            {months.map((m, i) => [
              <th key={m} className={cn(th, "text-right")}>
                {periodName(m)}
              </th>,
              full && !i && (
                <th key="share" className={cn(th, "text-right max-md:hidden")}>
                  % ของยอดขาย
                </th>
              ),
            ])}
          </tr>
        </thead>
        <tbody>
          {full && line("ยอดขาย", a.sales, b.sales)}
          {full &&
            salesChannels(db.config).map((c) =>
              line(
                `GP ${c.name} ${c.gp}%`,
                (-(a.byChannel[c.key] ?? 0) * c.gp) / 100,
                (-(b.byChannel[c.key] ?? 0) * c.gp) / 100,
              ),
            )}
          {ids.map((id) =>
            id === rentCategory && !of(a, id) ? (
              <tr key={id}>
                <td className={td}>{names[id] ?? id}</td>
                <Num tone="warning">{missingText}</Num>
                {ofSales(0)}
                <Money x={-of(b, id)} />
              </tr>
            ) : (
              line(names[id] ?? id, -of(a, id), -of(b, id))
            ),
          )}
          {full
            ? line("กำไรจากการดำเนินงาน", a.profit, b.profit, true)
            : line("รวมยอดจ่าย", -paid(a), -paid(b), true)}
          {line(
            `${names[capexCategory] ?? capexCategory} (ไม่รวมในยอดข้างบน)`,
            -a.capex,
            -b.capex,
          )}
        </tbody>
      </FigureTable>
    </FigureCard>
  );
}

export const figureGrid =
  "grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4 max-md:grid-cols-2 max-md:gap-3";
export const cardGrid =
  "grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-4";
