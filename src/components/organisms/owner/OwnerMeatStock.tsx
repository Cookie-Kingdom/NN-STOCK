"use client";

import { Fragment } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { MissingMark } from "@/components/atoms/MissingMark";
import { Caption, Muted } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import {
  Cell,
  Left,
  StockTable,
} from "@/components/organisms/branch/BranchStock";
import { lotMeat } from "@/components/organisms/shared/noteText";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { qty, thaiDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  branchItem,
  branches,
  centralPlace,
  isMeatItem,
  meatStock,
  meatTypeOf,
  meatTypes,
  pendingTransfers,
  placeLabel,
  places,
  stockLines,
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

/** Each branch's day on `sheet`: saved (and by whom) or waiting. */
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
      <Badge key={branch} tone={saved ? "success" : "warning"}>
        สาขา{branch} ·{" "}
        {saved
          ? `บันทึกวันนี้แล้ว${reporter ? ` · ${reporter}` : ""}`
          : "รอบันทึกวันนี้"}
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

/** Stock as the Owner sees it: the meat still with the seller and the smoked meat kept at
 *  Foodiva (V2-CAL-07, 08; an old lot holds none, `meatStock`), each smoked row with
 *  「จัดสรร」 (a `transfer` on its PO รมควัน to a branch), each round still at Chef House with
 *  「+ จดหลังรมควัน」 (its meat is jotted nowhere else until then), then where each kind of meat and
 *  each ingredient is, one row each as on Inventory: the central warehouse (for the meat the
 *  smoked meat at Foodiva), each branch's Stock sheet (what is left and today's waste,
 *  V2-CAL-10), on its way, the total and a status; and the waste of the last 7 days. A branch saves its own sheet on its Stock page. */
export function OwnerMeatStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const { held, central: smoked, waiting } = meatStock(db);
  const where = [...places.map(placeLabel), "ระหว่างส่ง", "รวม", "สถานะ"];
  const lines = new Map(stockLines(db, today).map((line) => [line.sku, line]));
  const lots = new Map(db.lots.map((lot) => [lot.id, lot]));
  const sent = branches.flatMap((branch) => pendingTransfers(db, branch));
  /** Where an item is besides the branches: a kind of meat in the smoked meat kept at Foodiva
   *  (its คลังกลาง) and on its way to a branch, by its RM code; an ingredient in the central
   *  warehouse and on its way, by its ING code (`stockLines`). */
  const whereOf = (item: Material) => {
    if (!isMeatItem(item.id)) {
      const line = lines.get(item.sku);
      return {
        code: item.sku,
        central: line?.at[centralPlace] ?? 0,
        transit: line?.inTransit ?? 0,
      };
    }
    const ofKind = (lotId: string) => meatTypeOf(lots.get(lotId)) === item.id;
    return {
      code: meatTypes(db.config).find((type) => type.id === item.id)?.code,
      central: smoked
        .filter((info) => ofKind(info.lot.id))
        .reduce((a, info) => a + info.centralKg, 0),
      transit: sent
        .filter((e) => e.lotId && ofKind(e.lotId))
        .reduce((a, e) => a + Number(e.values.qty || 0), 0),
    };
  };
  return (
    <div className="flex flex-col gap-4">
      <DayCard
        aria-label="เนื้อ (กก.)"
        title="เนื้อ (กก.)"
        aside={
          <Caption>
            ที่ผู้ขายและที่ Foodiva ·
            เนื้อที่ส่งไปรมควันจัดสรรได้เมื่อจดหลังรมควันแล้ว
          </Caption>
        }
      >
        <StockTable
          columns={["ที่เก็บ", "รายการ", "คงเหลือ", "จัดสรร"]}
          right={["คงเหลือ", "จัดสรร"]}
        >
          {held.map(({ lot, kg }) => (
            <tr key={lot.id}>
              <Cell>ผู้ขาย (ฝากไว้)</Cell>
              <Cell>
                {[lot.poId, lot.values.supplier, lotMeat(db, lot.id)]
                  .filter(Boolean)
                  .join(" · ")}
              </Cell>
              <Left n={kg} />
              <Cell />
            </tr>
          ))}
          {smoked.map((info) => (
            <tr key={info.lot.id}>
              <Cell>Foodiva (รมควันแล้ว)</Cell>
              <Cell>
                {[info.lot.poId, lotMeat(db, info.lot.id)]
                  .filter(Boolean)
                  .join(" · ")}
              </Cell>
              <Left n={info.centralKg} />
              <Cell right className="py-1.5">
                <Button
                  variant="primary"
                  aria-label={`จัดสรร ${info.lot.poId}`}
                  onClick={() =>
                    ws.jot({
                      kind: "transfer",
                      lotId: info.lot.id,
                      // What is left there, to send all of it or type less.
                      values:
                        info.centralKg > 0
                          ? { qty: String(+info.centralKg.toFixed(2)) }
                          : undefined,
                    })
                  }
                >
                  จัดสรร
                </Button>
              </Cell>
            </tr>
          ))}
          {waiting.map(({ lot, round }) => (
            <tr key={round.dispatch.id}>
              <Cell>Chef House (รอจดหลังรมควัน)</Cell>
              <Cell>
                {lot.poId} · {round.number} · ส่ง {qty(round.sentKg)} กก.
              </Cell>
              <Cell right>
                <MissingMark />
              </Cell>
              <Cell right className="py-1.5">
                <Button
                  variant="table-secondary"
                  aria-label={`จดหลังรมควัน ${lot.poId} ${round.number}`}
                  onClick={() =>
                    ws.jot({
                      kind: "smoked",
                      lotId: lot.id,
                      values: { dispatchId: round.dispatch.id },
                    })
                  }
                >
                  + จดหลังรมควัน
                </Button>
              </Cell>
            </tr>
          ))}
          {held.length + smoked.length + waiting.length === 0 && (
            <tr>
              <Cell
                colSpan={4}
                className="py-8 text-center text-text-secondary"
              >
                ยังไม่มีเนื้อที่ผู้ขายหรือที่ Foodiva
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
          columns={["รหัส", "รายการ", ...where]}
          right={where.slice(0, -1)}
          wideOnly={["รหัส"]}
        >
          {sheetItems(db, "meat").map((item) => {
            const { code, central, transit } = whereOf(item);
            const sheets = branches.map((b) =>
              branchItem(db, b, item.id, today),
            );
            const total =
              central +
              transit +
              sheets.reduce((a, sheet) => a + sheet.remaining, 0);
            // Never set at a branch and nothing anywhere: no figure yet, grey (as Inventory).
            const unset = sheets.every((sheet) => !sheet.set) && !total;
            // A row deleted in Settings only while it has a figure.
            if (item.removed && unset) return null;
            return (
              <tr key={item.id}>
                <Cell className="font-mono whitespace-nowrap text-accent max-md:hidden">
                  {code || none}
                </Cell>
                <Cell className="font-semibold">{item.name}</Cell>
                <Cell right tone={central < 0 ? "danger" : undefined}>
                  {qty(central)} {item.unit}
                </Cell>
                {branches.map((branch) => (
                  <SheetCells
                    key={branch}
                    db={db}
                    branch={branch}
                    item={item}
                    today={today}
                    stacked
                  />
                ))}
                <Cell right>{transit ? qty(transit) : none}</Cell>
                <Cell right tone={total < 0 ? "danger" : undefined}>
                  {qty(total)} {item.unit}
                </Cell>
                <Cell
                  tone={unset ? undefined : total <= 0 ? "danger" : "success"}
                  className={cn(
                    "whitespace-nowrap",
                    unset && "text-text-secondary",
                  )}
                >
                  {unset ? "ยังไม่ตั้งยอด" : total <= 0 ? "หมด" : "พร้อมใช้"}
                </Cell>
              </tr>
            );
          })}
        </StockTable>
      </DayCard>
      <WasteWeekCard db={db} sheet="meat" today={today} />
      <Caption className="flex flex-col gap-1">
        {[
          'ผู้ดูแลสาขาบันทึกใบสต๊อกรายวันจากหน้า Stock ของสาขา "จัดสรร" ส่งเนื้อรมควันจาก Foodiva ไปสาขา เข้าสต๊อกสาขาทันทีหรือเมื่อสาขากดยืนยันรับ',
          "PO จากไฟล์เดิมไม่นับเป็นสต๊อก",
          "สต๊อกของสาขา: หนึ่งแถวคือเนื้อหนึ่งชนิดหรือวัตถุดิบหนึ่งรายการ คลังกลางของเนื้อคือเนื้อรมควันที่ Foodiva ของวัตถุดิบคือยอดซื้อเข้าจากหน้า Accounting ลบยอดที่จัดสรรออก ระหว่างส่งคือของที่ส่งแล้วและรอสาขากดยืนยันรับ ช่องรวมนับของระหว่างส่งด้วย",
          "คงเหลือ = ยอดยกมา + รับเข้า − ใช้ไป − ตัดจากยอดขาย ของใบสต๊อกรายวัน Waste นับรวมอยู่ในยอดใช้ไปแล้ว",
          "ตัดจากยอดขาย: เว็บตัดให้เองจากยอดขายและกล่องที่แจก ตามส่วนประกอบของสินค้าใน Settings ยกเว้นเนื้อ ที่สาขาชั่งแล้วกรอกเองในยอดใช้ไป",
          "วันนี้ยังไม่บันทึก: คงเหลือคือยอดล่าสุดที่ยกมา",
          '"—" = ยังไม่มีตัวเลขของวันนี้',
          "ช่องสีแดงคือยอดติดลบ",
        ].map((line) => (
          <span key={line}>{line}</span>
        ))}
      </Caption>
    </div>
  );
}
