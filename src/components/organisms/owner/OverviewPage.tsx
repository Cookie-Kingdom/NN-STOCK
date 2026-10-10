"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { Panel } from "@/components/atoms/Panel";
import { Caption } from "@/components/atoms/Text";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
import { td, th } from "@/components/organisms/shared/tableCell";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, qty } from "@/lib/format";
import { revenuePeriod, shiftKey } from "@/lib/period";
import {
  branches,
  capexCategory,
  liveEntries,
  monthPl,
  payCategories,
  plBetween,
  legacySale,
  noBranch,
  salesChannels,
  type Database,
} from "@/lib/store";
import { shopProject } from "@/lib/store/ledger";
import { cn } from "@/lib/utils";
import {
  FigureCard,
  FigureTable,
  Num,
  PlTable,
  percent,
  share,
} from "./PlTable";
import { RevenueChart } from "./RevenueChart";

/** How a figure moved against the like-for-like span before it: green up, red down, and
 *  never the colour alone (an arrow and a word). `versus` names that span. */
function Delta({
  now,
  before,
  versus,
}: {
  now: number;
  before: number;
  versus?: string;
}) {
  const chip =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-body-sm font-medium whitespace-nowrap [&>svg]:size-3.5";
  if (!before)
    return now ? (
      <span className={cn(chip, "bg-surface-sunken text-text-secondary")}>
        ช่วงก่อนไม่มีรายได้
      </span>
    ) : null;
  const change = ((now - before) / before) * 100;
  const up = change >= 0;
  return (
    <span
      className={cn(
        chip,
        up ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger",
      )}
    >
      {up ? <ArrowUpRight /> : <ArrowDownRight />}
      {up ? "เพิ่ม" : "ลด"} {percent(Math.abs(change))} {versus}
    </span>
  );
}

/** Rows of a name, a figure and a bar as long as its share of the longest. */
function Bars({
  total,
  rows,
}: {
  total: number;
  rows: { name: string; value: number; note?: string }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="grid gap-3.5 px-5 py-4 max-md:px-4">
      {rows.map((row) => (
        <div key={row.name}>
          <div className="flex items-baseline justify-between gap-3 text-body-sm">
            <span>{row.name}</span>
            <span className="font-semibold whitespace-nowrap">
              {baht(row.value)}{" "}
              <Caption as="span">{share(row.value, total)}</Caption>
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-text-secondary transition-[width] duration-(--motion-slow) ease-(--ease-enter)"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
          {row.note && <Caption className="mt-1 block">{row.note}</Caption>}
        </div>
      ))}
    </div>
  );
}

/** The period a page shows, a month or a year, and the control that picks it: month or year,
 *  then back and forward, never before the first live entry nor past today's. Opens on this
 *  month. */
export function usePeriod(db: Database, today: string) {
  const [view, setView] = useState<"month" | "year">("month");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(today.slice(0, 4));
  const key = view === "month" ? month : year;
  const step = (by: number) =>
    view === "month"
      ? setMonth(shiftKey(month, by))
      : setYear(shiftKey(year, by));
  const first = liveEntries(db).reduce(
    (a, e) => (e.date < a ? e.date : a),
    today,
  );
  const current = key === today.slice(0, key.length);
  const period = revenuePeriod(key, today);
  const span = view === "month" ? "เดือน" : "ปี";
  return {
    view,
    key,
    /** เดือน or ปี. */
    span,
    /** The period that holds today. */
    current,
    period,
    control: (
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedChoice
          label="ช่วงเวลา"
          value={view}
          onChange={setView}
          options={[
            { value: "month", label: "เดือน" },
            { value: "year", label: "ปี" },
          ]}
        />
        <div className="inline-flex items-center rounded-md border border-border bg-surface max-md:flex-1 max-md:justify-between">
          <IconButton
            label={`${span}ก่อนหน้า`}
            icon={<ChevronLeft />}
            disabled={shiftKey(key, -1) < first.slice(0, key.length)}
            onClick={() => step(-1)}
          />
          <output
            aria-live="polite"
            className="min-w-38 text-center text-body-sm font-medium"
          >
            {period.name}
          </output>
          <IconButton
            label={`${span}ถัดไป`}
            icon={<ChevronRight />}
            disabled={current}
            onClick={() => step(1)}
          />
        </div>
      </div>
    ),
  };
}

/** Revenue by month or by year: the total against the like-for-like span before it, a bar per
 *  day (or per month), how the revenue becomes the operating profit, the branches, the sales
 *  channels and the other income, then the P&L. One vocabulary all the way down: รายได้รวม
 *  is ยอดขาย (the branches' sales) and รายได้อื่น (V2-PAY-09) together; a figure per branch or
 *  per channel is of ยอดขาย alone and says so. Without `project` it is the shop's, with a
 *  row per project and one for the company's own other income; with it, that project's alone, the company's left out. Both
 *  read the entry log through `plBetween`, so they cannot disagree. */
export function Revenue({ ws, project }: { ws: Workspace; project?: string }) {
  const { db, today } = ws;
  const { view, key, period, control } = usePeriod(db, today);

  const now = monthPl(db, key, project);
  const before = plBetween(db, period.before.from, period.before.to, project);
  // The shop's page: the project's own figures, and what is left is the company's.
  const own = project ? now : monthPl(db, key, shopProject);
  const ownBefore = project
    ? before
    : plBetween(db, period.before.from, period.before.to, shopProject);
  const central = now.otherIncome - own.otherIncome;
  const centralBefore = before.otherIncome - ownBefore.otherIncome;
  /* ponytail: a bar reads the whole log once (twice with its mark): 62 passes for a month.
   * One pass that buckets by date if a long log makes the page slow. */
  const bars = period.buckets.map((bucket) => {
    const pl = bucket.future ? null : monthPl(db, bucket.key, project);
    return {
      label: bucket.label,
      title: bucket.title,
      value: pl && pl.income,
      part: pl && pl.otherIncome,
      mark: !pl
        ? null
        : view === "year"
          ? pl.profit
          : bucket.before
            ? monthPl(db, bucket.before, project).income
            : null,
    };
  });
  const names = Object.fromEntries(
    payCategories(db.config).map((c) => [c.id, c.name]),
  );
  // From the revenue down to the profit: the GP, the four largest categories, the rest as one.
  const paid = Object.entries(now.byCategory)
    .filter(([id, amount]) => id !== capexCategory && amount)
    .sort((a, b) => b[1] - a[1]);
  const rest = paid.slice(4).reduce((a, [, amount]) => a + amount, 0);
  const lines: [string, number][] = [
    ["หัก GP ช่องทางขาย", now.gp],
    ...paid
      .slice(0, 4)
      .map(([id, x]): [string, number] => [names[id] ?? id, x]),
    ["หมวดอื่น ๆ", rest],
  ];
  // Each step starts where the one above it ended, the first at the whole revenue.
  const steps = lines
    .filter(([, amount]) => amount)
    .map(([name, amount], i, all) => ({
      name,
      amount,
      left: now.income - all.slice(0, i + 1).reduce((a, [, x]) => a + x, 0),
    }));
  const scale = Math.max(now.income, now.income - now.profit, 1);
  const channels = salesChannels(db.config);
  const fall =
    "grid grid-cols-[minmax(7.5em,max-content)_minmax(0,1fr)_max-content] items-center gap-x-3.5 gap-y-2.5 px-5 py-4 text-body-sm max-md:px-4";
  const track = "relative h-5.5";
  const bar =
    "absolute top-0.5 h-4.5 min-w-0.5 rounded-sm transition-[left,width] duration-(--motion-slow) ease-(--ease-enter)";

  return (
    <div className="flex flex-col gap-4">
      {control}

      <Panel aria-label="รายได้รวม">
        <h2 className="m-0 text-label text-text-secondary">
          {period.title}
          {project && ` · ${project}`}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
          <strong className="text-[2.5rem] leading-12 font-semibold max-md:text-[2rem] max-md:leading-10">
            {baht(now.income)}
          </strong>
          <Delta
            now={now.income}
            before={before.income}
            versus={period.versus}
          />
        </div>
        {/* Only when the total is more than the sales: otherwise it would say it twice. */}
        {!!now.otherIncome && (
          <p className="m-0 mt-1 text-body-sm text-text-secondary">
            ยอดขาย {baht(now.sales)} · รายได้อื่น {baht(now.otherIncome)}
          </p>
        )}
        <div className="mt-5" />
        <RevenueChart
          label={`กราฟแท่ง${period.title} รวม ${baht(now.income)} · กดลูกศรซ้ายขวาเพื่ออ่านทีละ${view === "month" ? "วัน" : "เดือน"}`}
          unit={view === "month" ? "วันที่" : "เดือน"}
          bars={bars}
          name="รายได้รวม"
          baseName="ยอดขาย"
          partName="รายได้อื่น"
          markName={
            view === "month"
              ? `วันเดียวกันของ${period.prevName}`
              : "กำไรจากการดำเนินงาน"
          }
          markAs={view === "month" ? "tick" : "line"}
        />
      </Panel>

      {/* ponytail: the shop has one project, and every sale and payment is its own; only
          other income can be the company's (ส่วนกลาง), so the two rows add up to the figure
          at the top. Split the figures per project (a row and a bar colour each) when a
          second one is stored. */}
      {!project && (
        <FigureCard title="รายได้แต่ละ Project" note={period.name}>
          <FigureTable>
            <thead>
              <tr>
                <th className={th}>Project</th>
                <th className={cn(th, "text-right")}>รายได้รวม</th>
                <th className={cn(th, "text-right max-md:hidden")}>
                  เทียบช่วงก่อน
                </th>
                <th className={cn(th, "text-right max-md:hidden")}>กล่อง</th>
                <th className={cn(th, "text-right")}>กำไร</th>
                <th className={cn(th, "text-right max-md:hidden")}>
                  อัตรากำไร
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={td}>
                  <span className="flex items-center gap-2.5">
                    <i className="size-3 shrink-0 rounded-[3px] bg-accent" />
                    <span>
                      <strong className="block font-semibold">
                        {shopProject}
                      </strong>
                      <Caption>
                        {channels.map((c) => c.name).join(" · ")}
                      </Caption>
                    </span>
                  </span>
                </td>
                <Num className="font-semibold">{baht(own.income)}</Num>
                <Num className="max-md:hidden">
                  <Delta now={own.income} before={ownBefore.income} />
                  {!own.income && !ownBefore.income && "—"}
                </Num>
                <Num className="max-md:hidden">{qty(own.boxes)}</Num>
                <Num
                  tone={own.profit < 0 ? "out" : own.profit ? "in" : undefined}
                >
                  {baht(own.profit)}
                </Num>
                <Num className="max-md:hidden">
                  {share(own.profit, own.income) || "—"}
                </Num>
              </tr>
              {/* The company's other income has no boxes and no expense of its own on this
                  page: all of it is profit, so a margin would say nothing. */}
              {(central || centralBefore) !== 0 && (
                <tr>
                  <td className={td}>
                    <span className="flex items-center gap-2.5">
                      <i className="size-3 shrink-0 rounded-[3px] bg-border-strong" />
                      <span>
                        <strong className="block font-semibold">
                          ส่วนกลาง
                        </strong>
                        <Caption>รายได้อื่นที่ไม่ผูกกับ Project</Caption>
                      </span>
                    </span>
                  </td>
                  <Num className="font-semibold">{baht(central)}</Num>
                  <Num className="max-md:hidden">
                    <Delta now={central} before={centralBefore} />
                  </Num>
                  <Num className="max-md:hidden">—</Num>
                  <Num tone={central < 0 ? "out" : central ? "in" : undefined}>
                    {baht(central)}
                  </Num>
                  <Num className="max-md:hidden">—</Num>
                </tr>
              )}
            </tbody>
          </FigureTable>
        </FigureCard>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <FigureCard title="จากรายได้ถึงกำไร" note={period.name}>
          <div className={fall}>
            <span className="font-semibold">ยอดขาย</span>
            <div className={track}>
              <div
                className={cn(bar, "left-0 bg-success")}
                style={{ width: `${(now.sales / scale) * 100}%` }}
              />
            </div>
            <span className="text-right font-semibold">{baht(now.sales)}</span>
            {/* Starts where the sales end: the pair reads as the whole revenue, which the
                deductions under it step down from. */}
            {!!now.otherIncome && (
              <>
                <span className="font-semibold">รายได้อื่น</span>
                <div className={track}>
                  <div
                    className={cn(bar, "bg-success")}
                    style={{
                      left: `${(now.sales / scale) * 100}%`,
                      width: `${(Math.max(now.otherIncome, 0) / scale) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-right font-semibold whitespace-nowrap">
                  {baht(now.otherIncome)}{" "}
                  <Caption as="span">
                    {share(now.otherIncome, now.income)}
                  </Caption>
                </span>
              </>
            )}
            {steps.map(({ name, amount, left }) => (
              <div key={name} className="contents">
                <span>{name}</span>
                <div className={track}>
                  <div
                    className={cn(bar, "bg-danger/80")}
                    style={{
                      left: `${(Math.max(left, 0) / scale) * 100}%`,
                      width: `${(Math.max(Math.min(amount, left + amount), 0) / scale) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-right whitespace-nowrap">
                  {baht(-amount)}{" "}
                  <Caption as="span">{share(amount, now.income)}</Caption>
                </span>
              </div>
            ))}
            <hr className="col-span-full m-0 border-0 border-t border-border" />
            <span className="font-semibold">กำไรจากการดำเนินงาน</span>
            <div className={track}>
              <div
                className={cn(
                  bar,
                  "left-0",
                  now.profit < 0 ? "bg-danger/80" : "bg-text-primary",
                )}
                style={{ width: `${(Math.abs(now.profit) / scale) * 100}%` }}
              />
            </div>
            <span
              className={cn(
                "text-right font-semibold",
                now.profit < 0 ? "text-danger" : "text-success",
              )}
            >
              {baht(now.profit)}
            </span>
          </div>
        </FigureCard>
        <div className="grid gap-4">
          <FigureCard title="ยอดขายแยกสาขา">
            <Bars
              total={now.sales}
              rows={[
                ...branches.map((name) => ({
                  name,
                  value: now.byBranch[name] ?? 0,
                })),
                // Sales from the old books that name no branch, when there are some.
                ...(now.byBranch[""]
                  ? [{ name: noBranch, value: now.byBranch[""] }]
                  : []),
              ].sort((a, b) => b.value - a.value)}
            />
          </FigureCard>
          <FigureCard
            title="ยอดขายแยกช่องทางขาย"
            note="GP คือส่วนที่ช่องทางหักไป"
          >
            <Bars
              total={now.sales}
              rows={[
                ...channels.map((c) => {
                  const value = now.byChannel[c.key] ?? 0;
                  return {
                    name: c.name,
                    value,
                    note: c.gp
                      ? `GP ${c.gp}% = ${baht((-value * c.gp) / 100)} · เหลือ ${baht(value * (1 - c.gp / 100))}`
                      : "ไม่มี GP",
                  };
                }),
                ...(now.byChannel[legacySale.key]
                  ? [
                      {
                        name: legacySale.name,
                        value: now.byChannel[legacySale.key],
                        note: "ยอดจากไฟล์เดิมที่หัก GP มาแล้ว จึงไม่หักซ้ำ",
                      },
                    ]
                  : []),
              ].sort((a, b) => b.value - a.value)}
            />
          </FigureCard>
          {!!now.otherIncome && (
            <FigureCard
              title="รายได้อื่นแยกรายการ"
              note="นับเมื่อได้รับเงินแล้ว"
            >
              <Bars
                total={now.otherIncome}
                rows={Object.entries(now.byIncome)
                  .map(([item, value]) => ({
                    name: item || "ไม่ระบุรายการ",
                    value,
                  }))
                  .sort((a, b) => b.value - a.value)}
              />
            </FigureCard>
          )}
        </div>
      </div>

      <PlTable db={db} month={key} full project={project} />
    </div>
  );
}

/** The Owner's home: the shop's revenue over every project. */
export const OverviewPage = ({ ws }: { ws: Workspace }) => <Revenue ws={ws} />;

/** The project's own Overview, under its heading in the menu. */
export const ProjectOverviewPage = ({ ws }: { ws: Workspace }) => (
  <Revenue ws={ws} project={shopProject} />
);
