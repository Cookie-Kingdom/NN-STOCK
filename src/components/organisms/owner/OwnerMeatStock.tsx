"use client";

import { Fragment } from "react";
import { Badge } from "@/components/atoms/Badge";
import { MissingMark } from "@/components/atoms/MissingMark";
import { Caption, Muted } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import {
  Cell,
  Left,
  StockTable,
} from "@/components/organisms/branch/BranchStock";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { qty, thaiDay } from "@/lib/format";
import {
  branchItem,
  branches,
  entries,
  meatStock,
  sheetItems,
  sheetNote,
  sheetOf,
  wasteWeek,
  type Database,
  type Material,
  type Sheet,
} from "@/lib/store";

const none = <Muted as="span">—</Muted>;
const under = "block text-caption font-normal";

/** Whether `branch` has set the opening stock of `sheet` by `today`: before that its sheet
 *  starts from nothing, so what is left there is not a figure to show. */
const hasOpening = (
  db: Database,
  branch: string,
  sheet: Sheet,
  today: string,
) =>
  entries(db, "opening", undefined, branch).some(
    (e) => e.values.sheet === sheet && e.date <= today,
  );

/** Each branch's day on `sheet`: saved (and by whom), waiting, or no opening stock yet. */
export function SheetStatus({
  db,
  sheet,
  today,
}: {
  db: Database;
  sheet: Sheet;
  today: string;
}) {
  return branches.map((branch) => {
    const saved = sheetNote(db, "daily", branch, sheet, today);
    const reporter = saved?.values.reporter;
    return (
      <Badge
        key={branch}
        tone={
          saved
            ? "success"
            : hasOpening(db, branch, sheet, today)
              ? "warning"
              : "neutral"
        }
      >
        สาขา{branch} ·{" "}
        {saved
          ? `บันทึกวันนี้แล้ว${reporter ? ` · ${reporter}` : ""}`
          : hasOpening(db, branch, sheet, today)
            ? "รอบันทึกวันนี้"
            : "ยังไม่ตั้งสต๊อก"}
      </Badge>
    );
  });
}

/** One item at one branch on `today`, as its daily sheet reads (`branchItem`): what is left
 *  (red below zero; the latest balance, and that it is, while today's sheet is not saved) and
 *  today's waste with its reason, each in the item's unit. Two cells, or `stacked` one cell
 *  with the waste under the balance (the Inventory table has no room for a column more). */
export function SheetCells({
  db,
  branch,
  item,
  today,
  stacked,
}: {
  db: Database;
  branch: string;
  item: Material;
  today: string;
  stacked?: boolean;
}) {
  if (!hasOpening(db, branch, sheetOf(item.id), today))
    return (
      <>
        <Cell right className="font-normal text-text-secondary">
          ยังไม่มีสต๊อกตั้งต้น
        </Cell>
        {!stacked && <Cell right>{none}</Cell>}
      </>
    );
  const { remaining, waste, reason, saved } = branchItem(
    db,
    branch,
    item.id,
    today,
  );
  const wasted = (
    <>
      {qty(waste)} {item.unit}
      {waste > 0 && (
        <span className={`${under} whitespace-normal`}>
          {reason || <MissingMark>ยังไม่ได้จดสาเหตุ</MissingMark>}
        </span>
      )}
    </>
  );
  return (
    <>
      <Cell right tone={remaining < 0 ? "danger" : undefined}>
        {qty(remaining)} {item.unit}
        {!saved && <span className={under}>ยังไม่บันทึกวันนี้</span>}
        {stacked && waste > 0 && <span className={under}>Waste {wasted}</span>}
      </Cell>
      {!stacked && <Cell right>{saved ? wasted : none}</Cell>}
    </>
  );
}

/** Waste ย้อนหลัง 7 วัน of `sheet`, both branches (`wasteWeek`): per item its total, then a
 *  line per day and branch, newest first. The head says how many of the branch-day sheets
 *  were saved: a day with none is not a day of no waste. */
export function WasteWeekCard({
  db,
  sheet,
  today,
}: {
  db: Database;
  sheet: Sheet;
  today: string;
}) {
  const weeks = branches.map((branch) => ({
    branch,
    ...wasteWeek(db, branch, today),
  }));
  const saved = weeks.reduce((a, week) => a + week.saved[sheet], 0);
  // One row per item over the branches: both read one list, so an id is one unit.
  const items = new Map<
    string,
    Material & {
      lines: { date: string; branch: string; waste: number; reason: string }[];
    }
  >();
  for (const { branch, items: list } of weeks)
    for (const { days, ...item } of list) {
      if (sheetOf(item.id) !== sheet) continue;
      const row = items.get(item.id) ?? { ...item, lines: [] };
      row.lines.push(...days.map((day) => ({ ...day, branch })));
      items.set(item.id, row);
    }
  const columns = ["รายการ", "วันที่", "สาขา", "Waste", "สาเหตุ"];
  return (
    <DayCard
      aria-label="Waste ย้อนหลัง 7 วัน"
      title="Waste ย้อนหลัง 7 วัน"
      aside={
        <Caption>
          บันทึกแล้ว {saved} จาก {branches.length * 7} ใบ ({branches.length}{" "}
          สาขา × 7 วัน) · วันที่ไม่บันทึกไม่ถือว่า waste เป็น 0
        </Caption>
      }
    >
      {items.size ? (
        <StockTable columns={columns} right={["Waste"]}>
          {[...items.values()].map((item) => (
            <Fragment key={item.id}>
              <tr>
                <Cell className="font-semibold">{item.name}</Cell>
                <Cell colSpan={2} className="text-text-secondary">
                  รวม 7 วัน
                </Cell>
                <Cell right className="font-semibold">
                  {qty(item.lines.reduce((a, line) => a + line.waste, 0))}{" "}
                  {item.unit}
                </Cell>
                <Cell />
              </tr>
              {item.lines
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((line) => (
                  <tr key={line.date + line.branch}>
                    <Cell />
                    <Cell className="whitespace-nowrap">
                      {thaiDay(line.date)}
                    </Cell>
                    <Cell className="whitespace-nowrap">สาขา{line.branch}</Cell>
                    <Cell right>
                      {qty(line.waste)} {item.unit}
                    </Cell>
                    <Cell>
                      {line.reason || (
                        <MissingMark>ยังไม่ได้จดสาเหตุ</MissingMark>
                      )}
                    </Cell>
                  </tr>
                ))}
            </Fragment>
          ))}
        </StockTable>
      ) : (
        <p className="m-0 px-5 py-8 text-center text-text-secondary max-md:px-4">
          ยังไม่มี waste ที่บันทึกในช่วงนี้
        </p>
      )}
    </DayCard>
  );
}

/** Stock as the Owner sees it: the meat still with the seller and in the central warehouse
 *  (V2-CAL-07, 08; an old lot holds none, `meatStock`), then each branch's Stock sheet (the
 *  meat, the raw sticky rice and the chili: what is left and today's waste, V2-CAL-10) and
 *  the waste of the last 7 days. Read-only: a branch saves its own sheet on its Stock page. */
export function OwnerMeatStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const { held, central: smoked } = meatStock(db);
  const figures = branches.flatMap((branch) => [
    `สาขา${branch} คงเหลือ`,
    `สาขา${branch} Waste วันนี้`,
  ]);
  return (
    <div className="flex flex-col gap-4">
      <DayCard
        aria-label="เนื้อ (กก.)"
        title="เนื้อ (กก.)"
        aside={<Caption>ที่ผู้ขายและคลังกลาง</Caption>}
      >
        <StockTable
          columns={["ที่เก็บ", "รายการ", "คงเหลือ"]}
          right={["คงเหลือ"]}
        >
          {held.map(({ lot, kg }) => (
            <tr key={lot.id}>
              <Cell>ผู้ขาย (ฝากไว้)</Cell>
              <Cell>
                {[lot.poId, lot.values.supplier].filter(Boolean).join(" · ")}
              </Cell>
              <Left n={kg} />
            </tr>
          ))}
          {smoked.map((info) => (
            <tr key={info.lot.id}>
              <Cell>คลังกลาง</Cell>
              <Cell>{info.lot.poId}</Cell>
              <Left n={info.centralKg} />
            </tr>
          ))}
          {held.length + smoked.length === 0 && (
            <tr>
              <Cell
                colSpan={3}
                className="py-8 text-center text-text-secondary"
              >
                ยังไม่มีเนื้อที่ผู้ขายหรือคลังกลาง
              </Cell>
            </tr>
          )}
        </StockTable>
      </DayCard>
      <DayCard
        aria-label="สต๊อกของสาขา"
        title="สต๊อกของสาขา"
        // A light rule between the columns.
        className="[&_:is(td,th)+:is(td,th)]:border-l"
        aside={<SheetStatus db={db} sheet="meat" today={today} />}
      >
        <StockTable
          columns={["รายการ", ...figures]}
          right={figures}
          wrap={figures}
        >
          {sheetItems(db, "meat")
            // Raw rice no branch steams (Settings) has no row (V2-BR-08).
            .filter((item) =>
              branches.some((branch) =>
                sheetItems(db, "meat", branch).some((i) => i.id === item.id),
              ),
            )
            .map((item) => (
              <tr key={item.id}>
                <Cell className="font-semibold">{item.name}</Cell>
                {branches.map((branch) =>
                  // Raw rice: only at a branch that steams its own (Settings).
                  sheetItems(db, "meat", branch).some(
                    (i) => i.id === item.id,
                  ) ? (
                    <SheetCells
                      key={branch}
                      db={db}
                      branch={branch}
                      item={item}
                      today={today}
                    />
                  ) : (
                    <Fragment key={branch}>
                      <Cell right>{none}</Cell>
                      <Cell right>{none}</Cell>
                    </Fragment>
                  ),
                )}
              </tr>
            ))}
        </StockTable>
      </DayCard>
      <WasteWeekCard db={db} sheet="meat" today={today} />
      <Caption className="flex flex-col gap-1">
        {[
          "หน้านี้ดูได้อย่างเดียว ผู้ดูแลสาขาบันทึกใบสต๊อกรายวันจากหน้า Stock ของสาขา",
          "PO จากไฟล์เดิม (Old Lots) ไม่นับเป็นสต๊อก",
          "คงเหลือ = ยอดยกมา + รับเข้า − ใช้ไป − ตัดจากยอดขาย ของใบสต๊อกรายวัน Waste นับรวมอยู่ในยอดใช้ไปแล้ว",
          "ตัดจากยอดขาย: เว็บตัดให้เองจากยอดขายและกล่องที่แจก ตามส่วนประกอบของสินค้าใน Settings",
          "วันนี้ยังไม่บันทึก: คงเหลือคือยอดล่าสุดที่ยกมา",
          '"—" = สาขาที่ไม่ได้ใช้ข้าวเหนียวดิบ (กำหนดใน Settings) หรือยังไม่มีตัวเลขของวันนี้',
          "ช่องสีแดงคือยอดติดลบ",
        ].map((line) => (
          <span key={line}>{line}</span>
        ))}
      </Caption>
    </div>
  );
}
