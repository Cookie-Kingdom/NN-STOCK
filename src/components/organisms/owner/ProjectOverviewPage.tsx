"use client";

import { Panel } from "@/components/atoms/Panel";
import { Stat } from "@/components/atoms/Stat";
import { Caption } from "@/components/atoms/Text";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, dateLabel, fmt, qty, thaiDay } from "@/lib/format";
import { rangeBuckets, stepName } from "@/lib/period";
import {
  branches,
  capexCategory,
  giftBoxes,
  monthPl,
  payCategories,
  plBetween,
  pieceUnit,
  products,
  legacySale,
  noBranch,
  salesChannels,
} from "@/lib/store";
import { shopProject } from "@/lib/store/ledger";
import { cn } from "@/lib/utils";
import { BranchSalesSummary } from "./BranchSalesSummary";
import { FigureCard, PlTable, figureGrid, share } from "./PlTable";
import { ChartRange, useChartRange } from "./ChartRange";
import { RevenueChart } from "./RevenueChart";
import { Bars, Delta, usePeriod } from "./overviewParts";

const hint = "mt-1 block text-caption font-normal text-text-secondary";
/** Baht to the satang, as a per-box figure is printed: "฿181.00", "−฿4.50". */
const perBox = (x: number) => `${x < 0 ? "−" : ""}฿${fmt(Math.abs(x))}`;

/** The project's own Overview, under its heading in the menu: its revenue by month or by
 *  year. The total against the like-for-like span before it, a chart over a span picked on two calendars (the period until another is picked; a bar a day up to 62 days, else a month),
 *  the figures of the period, how the revenue becomes the operating profit, the branches,
 *  the sales channels and the other income, each branch's sales per day or month
 *  (`BranchSalesSummary`), then the P&L. One vocabulary all the way down:
 *  รายได้รวม is ยอดขาย (the sales receipts) and รายได้อื่น (V2-PAY-09) together; a figure per
 *  box or per channel is of ยอดขาย alone, the branches' share is of what they jotted, and
 *  each says so. Only the project's own
 *  other income counts, the company's left out. The shop's Overview (`OverviewPage`) is a
 *  page of its own: nothing of this layout is shared with it. */
export function ProjectOverviewPage({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const { key, span, current, period, control } = usePeriod(db, today);

  const now = monthPl(db, key, shopProject);
  // "" .. key: every date before the period's first day ("2026-11-01" > "2026-11").
  const carried = plBetween(db, "", key, shopProject).income;
  const before = plBetween(
    db,
    period.before.from,
    period.before.to,
    shopProject,
  );
  // The chart's own span: the page's period until another is picked.
  const range = useChartRange(period.start, period.end);
  const chart = rangeBuckets(range.from, range.to, range.by);
  /* ponytail: a bar reads the whole log once (twice with its mark): 62 passes for 62 days.
   * One pass that buckets by date if a long log makes the page slow. */
  const bars = chart.bars.map((bar) => {
    const pl =
      bar.from > today ? null : plBetween(db, bar.from, bar.to, shopProject);
    return {
      label: chart.byDay ? String(+bar.from.slice(8)) : bar.label,
      title: chart.byDay
        ? thaiDay(bar.from, { weekday: "long", day: "numeric", month: "long" })
        : bar.title,
      value: pl && pl.income,
      part: pl && pl.otherIncome,
      mark: !pl
        ? null
        : !chart.byDay
          ? pl.profit
          : bar.before
            ? plBetween(db, bar.before, bar.before, shopProject).income
            : null,
    };
  });
  const chartName = `${stepName[chart.by].name} ${dateLabel(range.from)} – ${dateLabel(range.to)}`;
  const names = Object.fromEntries(
    payCategories(db.config).map((c) => [c.id, c.name]),
  );
  // From the revenue down to the profit: the four largest categories, the rest as one.
  const paid = Object.entries(now.byCategory)
    .filter(([id, amount]) => id !== capexCategory && amount)
    .sort((a, b) => b[1] - a[1]);
  const rest = paid.slice(4).reduce((a, [, amount]) => a + amount, 0);
  const lines: [string, number][] = [
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
  // A channel deleted in Settings stays only while it has sales in the period.
  const channels = salesChannels(db.config).filter(
    (c) => !c.removed || now.byChannel[c.key],
  );
  // Pieces of every product; they are boxes while the box is the only one.
  const piece = pieceUnit(products(db.config));
  const several = piece !== "กล่อง";
  const gifts = giftBoxes(db, key);
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
          {` · ${shopProject}`}
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
        <div className="mt-5 mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Caption>รายได้รวม{chartName}</Caption>
          <ChartRange range={range} />
        </div>
        <RevenueChart
          label={`กราฟแท่งรายได้รวม${chartName} · แตะหรือกดลูกศรซ้ายขวาเพื่ออ่านทีละ${stepName[chart.by].unit}`}
          unit={chart.byDay ? "วันที่" : stepName[chart.by].unit}
          bars={bars}
          name="รายได้รวม"
          baseName="ยอดขาย"
          partName="รายได้อื่น"
          markName={
            chart.byDay ? "วันเดียวกันของเดือนก่อน" : "กำไรจากการดำเนินงาน"
          }
          markAs={chart.byDay ? "tick" : "line"}
        />
      </Panel>

      <Panel className={figureGrid} aria-label={`ตัวเลขของ${span}`}>
        {/* The receipts are what the channels paid: already after their GP. */}
        <Stat
          label="ยอดยกมา"
          value={baht(carried)}
          note={`รายได้รวมสะสมตั้งแต่เริ่มจด ถึงก่อน ${period.name}`}
        />
        <Stat label="รายได้หลังหัก GP ช่องทางขาย" value={baht(now.income)} />
        <Stat
          label="กำไรจากการดำเนินงาน"
          value={
            <span className={now.profit < 0 ? "text-danger" : "text-success"}>
              {baht(now.profit)}
            </span>
          }
          note={
            now.income
              ? `${share(now.profit, now.income)} ของรายได้รวม`
              : "ยังไม่มีรายได้"
          }
        />
        <Stat
          label={several ? "สินค้าที่ขาย" : "กล่องที่ขาย"}
          value={`${qty(now.boxes)} ${piece}`}
          note={`ยอดขายต่อ${piece} ${now.boxes ? perBox(now.sales / now.boxes) : "—"} · ยอดขายเฉลี่ย ${baht(now.sales / period.days)} ต่อวัน`}
        />
        <Stat
          label={`${several ? "สินค้าแจก" : "กล่องแจก"}${current ? `${span}นี้` : ` ${period.name}`}`}
          value={
            <>
              {qty(gifts.boxes)} {piece}
              <small className={hint}>
                {gifts.value !== null && `ต้นทุนประมาณ ${baht(gifts.value)} `}
                ไม่นับใน P&L
              </small>
            </>
          }
        />
      </Panel>

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
          <FigureCard title="ยอดขายแยกสาขา" note="ตามที่สาขาจด">
            <Bars
              total={Object.values(now.byBranch).reduce((a, b) => a + b, 0)}
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
            note="ยอดรับเงินค่าขาย ช่องทางหัก GP แล้ว"
          >
            <Bars
              total={now.sales}
              rows={[
                ...channels.map((c) => {
                  const value = now.byChannel[c.key] ?? 0;
                  return {
                    name: c.name,
                    value,
                    note: c.gp ? `หัก GP ${c.gp}% แล้ว` : "ไม่มี GP",
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

      <BranchSalesSummary db={db} period={key} />

      <PlTable db={db} month={key} full project={shopProject} />
    </div>
  );
}
