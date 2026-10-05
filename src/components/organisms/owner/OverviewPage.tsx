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
import { Stat } from "@/components/atoms/Stat";
import { Caption } from "@/components/atoms/Text";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
import { lotLabel } from "@/components/organisms/shared/noteText";
import { td, th } from "@/components/organisms/shared/tableCell";
import { TodoBox } from "@/components/organisms/workspace/TodoBox";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, fmt, qty } from "@/lib/format";
import { revenuePeriod, shiftKey } from "@/lib/period";
import {
  boxCost,
  branches,
  capexCategory,
  giftBoxes,
  liveEntries,
  monthPl,
  n,
  payCategories,
  plBetween,
  salesChannels,
} from "@/lib/store";
import { shopProject } from "@/lib/store/ledger";
import { cn } from "@/lib/utils";
import { cardGrid, figureGrid } from "./FinancePage";
import { FigureCard, FigureTable, Num, PlTable } from "./PlTable";
import { RevenueChart } from "./RevenueChart";

const hint = "mt-1 block text-caption font-normal text-text-secondary";
const percent = (x: number) =>
  `${x.toLocaleString("th-TH", { maximumFractionDigits: Math.abs(x) < 10 ? 1 : 0 })}%`;
/** `part` of `whole` as a percentage; nothing when there is no whole. */
const share = (part: number, whole: number) =>
  whole ? percent((part / whole) * 100) : "";

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
        เริ่มในช่วงนี้
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

/** The Owner's home: the shop's revenue over every project, by month or by year. The total
 *  against the like-for-like span before it, a bar per day (or per month), the figures of the
 *  period, each project, how the revenue becomes the operating profit, the branches and the
 *  sales channels, then the P&L and everything not jotted yet. */
export function OverviewPage({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  const [view, setView] = useState<"month" | "year">("month");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(today.slice(0, 4));
  // The Account Manager has no Overview (V2-ACC-01); the workspace never sends it here.
  if (account.hidesSales) return null;

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
  const now = monthPl(db, key);
  const before = plBetween(db, period.before.from, period.before.to);
  /* ponytail: a bar reads the whole log once (twice with its mark): 62 passes for a month.
   * One pass that buckets by date if a long log makes the page slow. */
  const bars = period.buckets.map((bucket) => {
    const pl = bucket.future ? null : monthPl(db, bucket.key);
    return {
      label: bucket.label,
      title: bucket.title,
      value: pl && pl.sales,
      mark: !pl
        ? null
        : view === "year"
          ? pl.profit
          : bucket.before
            ? monthPl(db, bucket.before).sales
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
    ["ค่าใช้จ่ายอื่น", rest],
  ];
  // Each step starts where the one above it ended.
  const steps = lines
    .filter(([, amount]) => amount)
    .map(([name, amount], i, all) => ({
      name,
      amount,
      left: now.sales - all.slice(0, i + 1).reduce((a, [, x]) => a + x, 0),
    }));
  const scale = Math.max(now.sales, now.sales - now.profit, 1);
  const channels = salesChannels(db.config);
  const cost = boxCost(db);
  const gifts = giftBoxes(db, key);
  const span = view === "month" ? "เดือน" : "ปี";
  const fall =
    "grid grid-cols-[minmax(7.5em,max-content)_minmax(0,1fr)_max-content] items-center gap-x-3.5 gap-y-2.5 px-5 py-4 text-body-sm max-md:px-4";
  const track = "relative h-5.5";
  const bar =
    "absolute top-0.5 h-4.5 min-w-0.5 rounded-sm transition-[left,width] duration-(--motion-slow) ease-(--ease-enter)";

  return (
    <div className="flex flex-col gap-4">
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

      <Panel aria-label="รายได้รวม">
        <h2 className="m-0 text-label text-text-secondary">{period.title}</h2>
        <div className="mt-1.5 mb-5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
          <strong className="text-[2.5rem] leading-12 font-semibold max-md:text-[2rem] max-md:leading-10">
            {baht(now.sales)}
          </strong>
          <Delta now={now.sales} before={before.sales} versus={period.versus} />
        </div>
        <RevenueChart
          label={`กราฟแท่ง${period.title} รวม ${baht(now.sales)} · กดลูกศรซ้ายขวาเพื่ออ่านทีละ${view === "month" ? "วัน" : "เดือน"}`}
          unit={view === "month" ? "วันที่" : "เดือน"}
          bars={bars}
          name="รายได้"
          markName={
            view === "month"
              ? `วันเดียวกันของ${period.prevName}`
              : "กำไรจากการดำเนินงาน"
          }
          markAs={view === "month" ? "tick" : "line"}
        />
      </Panel>

      <Panel className={figureGrid} aria-label={`ตัวเลขของ${span}`}>
        <Stat
          label="หลังหัก GP ช่องทางขาย"
          value={baht(now.sales - now.gp)}
          note={`GP ${baht(now.gp)}`}
        />
        <Stat
          label="กำไรจากการดำเนินงาน"
          value={
            <span className={now.profit < 0 ? "text-danger" : "text-success"}>
              {baht(now.profit)}
            </span>
          }
          note={
            now.sales
              ? `คิดเป็น ${share(now.profit, now.sales)} ของรายได้`
              : "ยังไม่มีรายได้"
          }
        />
        <Stat
          label="กล่องที่ขาย"
          value={`${qty(now.boxes)} กล่อง`}
          note={`รายได้เฉลี่ย ${baht(now.sales / period.days)} ต่อวัน`}
        />
        <Stat
          label="ต้นทุนต่อกล่อง"
          value={
            <>
              {cost ? `฿${fmt(cost.total)}` : "—"}
              <small className={hint}>
                {cost
                  ? `เนื้อ ฿${fmt(cost.meat)} + แพ็กเกจ ${baht(cost.pack)} · ขาย ${baht(n(db.config, "boxPrice"))} · จาก ${lotLabel(db, cost.lotId)}`
                  : "ยังไม่มี Lot ที่จดครบ"}
              </small>
            </>
          }
        />
        <Stat
          label={current ? `กล่องแจก${span}นี้` : `กล่องแจก ${period.name}`}
          value={
            <>
              {qty(gifts.boxes)} กล่อง
              <small className={hint}>
                {gifts.value !== null &&
                  `มูลค่าต้นทุนประมาณ ${baht(gifts.value)} · `}
                ไม่บวกเข้า P&L
              </small>
            </>
          }
        />
      </Panel>

      {/* ponytail: the shop has one project, and every sale and payment is its own. Split
          the figures per project (a row and a bar colour each) when a second one is stored. */}
      <FigureCard title="รายได้แต่ละ Project" note={period.name}>
        <FigureTable>
          <thead>
            <tr>
              <th className={th}>Project</th>
              <th className={cn(th, "text-right")}>รายได้</th>
              <th className={cn(th, "text-right max-md:hidden")}>
                เทียบช่วงก่อน
              </th>
              <th className={cn(th, "text-right max-md:hidden")}>กล่อง</th>
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
                    <Caption>{channels.map((c) => c.name).join(" · ")}</Caption>
                  </span>
                </span>
              </td>
              <Num className="font-semibold">{baht(now.sales)}</Num>
              <Num className="max-md:hidden">
                <Delta now={now.sales} before={before.sales} />
                {!now.sales && !before.sales && "—"}
              </Num>
              <Num className="max-md:hidden">{qty(now.boxes)}</Num>
              <Num
                tone={now.profit < 0 ? "out" : now.profit ? "in" : undefined}
              >
                {baht(now.profit)}
              </Num>
              <Num className="max-md:hidden">
                {share(now.profit, now.sales) || "—"}
              </Num>
            </tr>
          </tbody>
        </FigureTable>
      </FigureCard>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <FigureCard title="จากรายได้ถึงกำไร" note={period.name}>
          <div className={fall}>
            <span className="font-semibold">รายได้</span>
            <div className={track}>
              <div
                className={cn(bar, "left-0 bg-success")}
                style={{ width: `${(now.sales / scale) * 100}%` }}
              />
            </div>
            <span className="text-right font-semibold">{baht(now.sales)}</span>
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
                  <Caption as="span">{share(amount, now.sales)}</Caption>
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
          <FigureCard title="รายได้แยกสาขา">
            <Bars
              total={now.sales}
              rows={branches
                .map((name) => ({ name, value: now.byBranch[name] ?? 0 }))
                .sort((a, b) => b.value - a.value)}
            />
          </FigureCard>
          <FigureCard
            title="รายได้แยกช่องทางขาย"
            note="GP คือส่วนที่ช่องทางหักไป"
          >
            <Bars
              total={now.sales}
              rows={channels
                .map((c) => {
                  const value = now.byChannel[c.key] ?? 0;
                  return {
                    name: c.name,
                    value,
                    note: c.gp
                      ? `GP ${c.gp}% = ${baht((-value * c.gp) / 100)} · เหลือ ${baht(value * (1 - c.gp / 100))}`
                      : "ไม่มี GP",
                  };
                })
                .sort((a, b) => b.value - a.value)}
            />
          </FigureCard>
        </div>
      </div>

      {/* A wide screen: the P&L keeps its figures near their labels, the to-do list gets the rest. */}
      <div
        className={cn(cardGrid, "2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]")}
      >
        <PlTable db={db} month={key} full />
        <TodoBox ws={ws} />
      </div>
    </div>
  );
}
