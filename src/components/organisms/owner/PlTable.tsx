import type { ComponentProps, ReactNode } from "react";
import { Caption } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import { baht, thaiDay } from "@/lib/format";
import {
  capexCategory,
  entries,
  missingText,
  monthPl,
  payCategories,
  payrollCategory,
  rentCategory,
  salesChannels,
  sum,
  type Database,
} from "@/lib/store";
import { cn } from "@/lib/utils";

/* The plain figure table of Finance and Overview: no sorting and no paging (a P&L has one
 * order), so not a DataTable. */
export const th =
  "border-b border-border px-5 py-2 text-left text-caption font-medium whitespace-nowrap text-text-secondary max-md:px-2.5";
export const td =
  "border-b border-border px-5 py-3 text-body-sm max-md:px-2.5 [tr:last-child>&]:border-b-0";
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
  <div className="overflow-x-auto">
    <table className="w-full border-collapse" {...props} />
  </div>
);

/** `YYYY-MM` as "ตุลาคม 2569". */
export const monthName = (month: string) =>
  thaiDay(`${month}-01`, { month: "long", year: "numeric" });
const monthBefore = (month: string) =>
  new Date(Date.UTC(+month.slice(0, 4), +month.slice(5) - 2, 1))
    .toISOString()
    .slice(0, 7);

/** Green in, red out, a dash for nothing. */
const Money = ({ x }: { x: number }) => (
  <Num tone={x > 0 ? "in" : x < 0 ? "out" : undefined}>{x ? baht(x) : "—"}</Num>
);

/** The month and the one before it, side by side (V2-CAL-02). `full` (the Owner): sales, GP
 *  per channel, every category, the operating profit, then อุปกรณ์/ลงทุน on its own line.
 *  Without it (the Account Manager): the categories only, never payroll, and what they add
 *  up to. ค่าเช่า/น้ำไฟ with nothing jotted in the month is yellow (V2-PAY-04). */
export function PlTable({
  db,
  month,
  full = false,
}: {
  db: Database;
  month: string;
  full?: boolean;
}) {
  const months = [month, monthBefore(month)];
  const [a, b] = months.map((m) => monthPl(db, m));
  const names = Object.fromEntries(
    payCategories(db.config).map((c) => [c.id, c.name]),
  );
  // Also a category that Settings no longer lists but a payment still carries.
  const ids = [
    ...new Set([...Object.keys(a.byCategory), ...Object.keys(b.byCategory)]),
  ].filter((id) => id !== capexCategory && (full || id !== payrollCategory));
  const of = (pl: typeof a, id: string) => pl.byCategory[id] ?? 0;
  const paid = (pl: typeof a) => ids.reduce((all, id) => all + of(pl, id), 0);
  const line = (name: string, x: number, y: number, total = false) => (
    <tr key={name} className={cn(total && "bg-surface-sunken font-semibold")}>
      <td className={td}>{name}</td>
      <Money x={x} />
      <Money x={y} />
    </tr>
  );
  return (
    <FigureCard
      title={full ? "P&L รายเดือน" : "จ่ายเงินแยกหมวด"}
      note="นับตามเดือนที่จ่ายเงิน"
    >
      <FigureTable>
        <thead>
          <tr>
            <th className={th}>รายการ</th>
            {months.map((m) => (
              <th key={m} className={cn(th, "text-right")}>
                {monthName(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {full && line("ยอดขาย", a.sales, b.sales)}
          {full &&
            salesChannels(db.config).map((c) => {
              const [x, y] = months.map(
                (m) =>
                  (sum(
                    entries(db, "sale").filter((e) => e.date.startsWith(m)),
                    c.key,
                  ) *
                    c.gp) /
                  100,
              );
              return line(`GP ${c.name} ${c.gp}%`, -x, -y);
            })}
          {ids.map((id) =>
            id === rentCategory && !of(a, id) ? (
              <tr key={id}>
                <td className={td}>{names[id] ?? id}</td>
                <Num tone="warning">{missingText}</Num>
                <Money x={-of(b, id)} />
              </tr>
            ) : (
              line(names[id] ?? id, -of(a, id), -of(b, id))
            ),
          )}
          {full
            ? line("กำไรจากการดำเนินงาน", a.profit, b.profit, true)
            : line("รวมที่จ่าย", -paid(a), -paid(b), true)}
          {line(
            `${names[capexCategory] ?? capexCategory} (แยกบรรทัด)`,
            -a.capex,
            -b.capex,
          )}
        </tbody>
      </FigureTable>
    </FigureCard>
  );
}
