"use client";

import { Panel } from "@/components/atoms/Panel";
import { Caption } from "@/components/atoms/Text";
import { td, th } from "@/components/organisms/shared/tableCell";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht } from "@/lib/format";
import {
  branches,
  capexCategory,
  monthPl,
  netSalesByBranch,
  payCategories,
  plBetween,
  noBranch,
  salesChannels,
} from "@/lib/store";
import { shopProject } from "@/lib/store/ledger";
import { cn } from "@/lib/utils";
import { FigureCard, FigureTable, Num, share } from "./PlTable";
import { RevenueChart } from "./RevenueChart";
import { Bars, Delta, usePeriod } from "./overviewParts";

/** The Owner's home: the shop's real income from its projects, by month or by year. Every
 *  revenue figure here is after the sales channels' GP (`income − gp`: the sales less the GP,
 *  and the other income of V2-PAY-09), and says so: the total against the like-for-like span
 *  before it, a bar per day (or per month), a row per project and one for the company's own
 *  other income, how that revenue becomes the operating profit, the branches and the other
 *  income. One project's detail (its P&L, its channels, its boxes) is on the project's
 *  Overview (`ProjectOverviewPage`), a page of its own: nothing of this layout is shared
 *  with it. */
export function OverviewPage({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const { view, key, period, control } = usePeriod(db, today);

  const now = monthPl(db, key);
  const before = plBetween(db, period.before.from, period.before.to);
  // The project's own figures, and what is left is the company's.
  const own = monthPl(db, key, shopProject);
  const ownBefore = plBetween(
    db,
    period.before.from,
    period.before.to,
    shopProject,
  );
  const central = now.otherIncome - own.otherIncome;
  const centralBefore = before.otherIncome - ownBefore.otherIncome;
  /** What the shop keeps of a span's revenue: the channels' GP is never its money. Sales
   *  from the old books carry no GP (`saleMoney`), so nothing is taken off them twice. */
  const net = (pl: { income: number; gp: number }) => pl.income - pl.gp;
  const netSales = now.sales - now.gp;
  /* ponytail: a bar reads the whole log once (twice with its mark): 62 passes for a month.
   * One pass that buckets by date if a long log makes the page slow. */
  const bars = period.buckets.map((bucket) => {
    const pl = bucket.future ? null : monthPl(db, bucket.key);
    return {
      label: bucket.label,
      title: bucket.title,
      value: pl && net(pl),
      part: pl && pl.otherIncome,
      mark: !pl
        ? null
        : view === "year"
          ? pl.profit
          : bucket.before
            ? net(monthPl(db, bucket.before))
            : null,
    };
  });
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
      left: net(now) - all.slice(0, i + 1).reduce((a, [, x]) => a + x, 0),
    }));
  const scale = Math.max(net(now), net(now) - now.profit, 1);
  const byBranch = netSalesByBranch(db, key, `${key}~`);
  // `period.title` names the whole revenue; this page's is what is left after the GP.
  const title = `รายได้หลังหัก GP ${period.range}`;
  const fall =
    "grid grid-cols-[minmax(7.5em,max-content)_minmax(0,1fr)_max-content] items-center gap-x-3.5 gap-y-2.5 px-5 py-4 text-body-sm max-md:px-4";
  const track = "relative h-5.5";
  const bar =
    "absolute top-0.5 h-4.5 min-w-0.5 rounded-sm transition-[left,width] duration-(--motion-slow) ease-(--ease-enter)";

  return (
    <div className="flex flex-col gap-4">
      {control}

      <Panel aria-label="รายได้หลังหัก GP">
        <h2 className="m-0 text-label text-text-secondary">{title}</h2>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
          <strong className="text-[2.5rem] leading-12 font-semibold max-md:text-[2rem] max-md:leading-10">
            {baht(net(now))}
          </strong>
          <Delta now={net(now)} before={net(before)} versus={period.versus} />
        </div>
        {/* Only when the total is more than the sales: otherwise it would say it twice. */}
        {!!now.otherIncome && (
          <p className="m-0 mt-1 text-body-sm text-text-secondary">
            ยอดขายหลังหัก GP {baht(netSales)} · รายได้อื่น{" "}
            {baht(now.otherIncome)}
          </p>
        )}
        <div className="mt-5" />
        <RevenueChart
          label={`กราฟแท่ง${title} รวม ${baht(net(now))} · กดลูกศรซ้ายขวาเพื่ออ่านทีละ${view === "month" ? "วัน" : "เดือน"}`}
          unit={view === "month" ? "วันที่" : "เดือน"}
          bars={bars}
          name="รายได้หลังหัก GP"
          baseName="ยอดขายหลังหัก GP"
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
      <FigureCard title="รายได้แต่ละ Project" note={period.name}>
        <FigureTable>
          <thead>
            <tr>
              <th className={th}>Project</th>
              <th className={cn(th, "text-right")}>รายได้หลังหัก GP</th>
              <th className={cn(th, "text-right max-md:hidden")}>
                เทียบช่วงก่อน
              </th>
              <th className={cn(th, "text-right")}>กำไร</th>
              <th className={cn(th, "text-right max-md:hidden")}>อัตรากำไร</th>
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
                      {salesChannels(db.config)
                        .map((c) => c.name)
                        .join(" · ")}
                    </Caption>
                  </span>
                </span>
              </td>
              <Num className="font-semibold">{baht(net(own))}</Num>
              <Num className="max-md:hidden">
                <Delta now={net(own)} before={net(ownBefore)} />
                {!net(own) && !net(ownBefore) && "—"}
              </Num>
              <Num
                tone={own.profit < 0 ? "out" : own.profit ? "in" : undefined}
              >
                {baht(own.profit)}
              </Num>
              <Num className="max-md:hidden">
                {share(own.profit, net(own)) || "—"}
              </Num>
            </tr>
            {/* The company's other income has no expense of its own on this page: all of
                it is profit, so a margin would say nothing. */}
            {(central || centralBefore) !== 0 && (
              <tr>
                <td className={td}>
                  <span className="flex items-center gap-2.5">
                    <i className="size-3 shrink-0 rounded-[3px] bg-border-strong" />
                    <span>
                      <strong className="block font-semibold">ส่วนกลาง</strong>
                      <Caption>รายได้อื่นที่ไม่ผูกกับ Project</Caption>
                    </span>
                  </span>
                </td>
                <Num className="font-semibold">{baht(central)}</Num>
                <Num className="max-md:hidden">
                  <Delta now={central} before={centralBefore} />
                </Num>
                <Num tone={central < 0 ? "out" : central ? "in" : undefined}>
                  {baht(central)}
                </Num>
                <Num className="max-md:hidden">—</Num>
              </tr>
            )}
          </tbody>
        </FigureTable>
      </FigureCard>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <FigureCard title="จากรายได้ถึงกำไร" note={period.name}>
          <div className={fall}>
            <span className="font-semibold">ยอดขายหลังหัก GP</span>
            <div className={track}>
              <div
                className={cn(bar, "left-0 bg-success")}
                style={{ width: `${(Math.max(netSales, 0) / scale) * 100}%` }}
              />
            </div>
            <span className="text-right font-semibold">{baht(netSales)}</span>
            {/* Starts where the sales end: the pair reads as the whole revenue, which the
                deductions under it step down from. */}
            {!!now.otherIncome && (
              <>
                <span className="font-semibold">รายได้อื่น</span>
                <div className={track}>
                  <div
                    className={cn(bar, "bg-success")}
                    style={{
                      left: `${(Math.max(netSales, 0) / scale) * 100}%`,
                      width: `${(Math.max(now.otherIncome, 0) / scale) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-right font-semibold whitespace-nowrap">
                  {baht(now.otherIncome)}{" "}
                  <Caption as="span">
                    {share(now.otherIncome, net(now))}
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
                  <Caption as="span">{share(amount, net(now))}</Caption>
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
          <FigureCard title="ยอดขายแยกสาขา" note="หลังหัก GP ช่องทางขาย">
            <Bars
              total={netSales}
              rows={[
                ...branches.map((name) => ({
                  name,
                  value: byBranch[name] ?? 0,
                })),
                // Sales from the old books that name no branch, when there are some.
                ...(byBranch[""]
                  ? [{ name: noBranch, value: byBranch[""] }]
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
    </div>
  );
}
