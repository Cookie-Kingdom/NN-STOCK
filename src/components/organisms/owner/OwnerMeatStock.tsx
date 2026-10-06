"use client";

import { Caption, Muted } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import {
  Cell,
  HeldCell,
  Left,
  StatusCells,
  StockTable,
  Variance,
} from "@/components/organisms/branch/BranchStock";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import {
  branchChili,
  branchMeat,
  branchRice,
  branches,
  lotInfo,
  poInfo,
  purchaseLots,
  rawRiceBranches,
  shipments,
} from "@/lib/store";

/** Stock as the Owner and the Account Manager see it: the meat from the seller to each
 *  branch (V2-CAL-07, 08, 10), then the raw sticky rice and the chili of each branch.
 *  Read-only: the branch admins count on their own Stock page. */
export function OwnerMeatStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const held = purchaseLots(db)
    .map((lot) => ({ lot, kg: poInfo(db, lot.id).heldKg }))
    .filter((po) => po.kg > 0);
  const smoked = shipments(db)
    .map((lot) => lotInfo(db, lot.id))
    .filter((info) => info.backKg > 0);
  const places = branches.map((branch) => `สาขา${branch}`);
  // Raw rice: only the branches that steam their own (Settings); the others get a dash.
  const rice = Object.fromEntries(
    rawRiceBranches(db.config)
      .filter((branch) => branches.includes(branch))
      .map((branch) => [`สาขา${branch}`, branchRice(db, branch, today)]),
  );
  const chili = Object.fromEntries(
    branches.map((branch) => [`สาขา${branch}`, branchChili(db, branch, today)]),
  );
  return (
    <div className="flex flex-col gap-4">
      <DayCard
        aria-label="เนื้อ (กก.)"
        title="เนื้อ (กก.)"
        aside={<Caption>ตั้งแต่ผู้ขายจนถึงสาขา</Caption>}
      >
        <StockTable
          columns={[
            "ที่เก็บ",
            "รายการ",
            "คงเหลือ",
            "การนับ",
            "ส่วนต่างตอนนับล่าสุด",
          ]}
          right={["คงเหลือ", "ส่วนต่างตอนนับล่าสุด"]}
          wrap={["ส่วนต่างตอนนับล่าสุด"]}
        >
          {held.map(({ lot, kg }) => (
            <tr key={lot.id}>
              <Cell>ผู้ขาย (ฝากไว้)</Cell>
              <Cell>
                {[lot.poId, lot.values.supplier].filter(Boolean).join(" · ")}
              </Cell>
              <Left n={kg} />
              <Cell />
              <Cell />
            </tr>
          ))}
          {smoked.map((info) => (
            <tr key={info.lot.id}>
              <Cell>คลังกลาง</Cell>
              <Cell>{info.lot.poId}</Cell>
              <Left n={info.centralKg} />
              <Cell />
              <Cell />
            </tr>
          ))}
          {branches.map((branch) => {
            const meat = branchMeat(db, branch, today);
            return (
              <tr key={branch}>
                <Cell>สาขา{branch}</Cell>
                <Cell>เนื้อพร้อมขาย</Cell>
                <Left n={meat.kg} />
                <Cell tone={meat.countedToday ? "success" : "warning"}>
                  {meat.countedToday ? "นับแล้ววันนี้" : "วันนี้ยังไม่ได้นับ"}
                </Cell>
                <Cell right>
                  {meat.variance ? (
                    <Variance variance={meat.variance} unit="กก." />
                  ) : (
                    <Muted as="span" className="font-normal">
                      {meat.counted ? "นับครั้งแรก" : "ยังไม่เคยนับ"}
                    </Muted>
                  )}
                </Cell>
              </tr>
            );
          })}
        </StockTable>
      </DayCard>
      <DayCard
        aria-label="ข้าวเหนียวและน้ำพริก"
        title="ข้าวเหนียวและน้ำพริก"
        // A light rule between the columns.
        className="[&_:is(td,th)+:is(td,th)]:border-l"
      >
        <StockTable
          columns={["สินค้า", ...places, "รวม", "สถานะ"]}
          right={[...places, "รวม"]}
        >
          {/* No branch steams its own: no row, rather than a red "หมด" of nothing. */}
          {Object.keys(rice).length > 0 && (
            <tr>
              <Cell className="font-semibold">ข้าวเหนียวดิบ (กก.)</Cell>
              {places.map((place) => (
                <HeldCell key={place} held={rice[place]} today={today} />
              ))}
              <StatusCells at={rice} places={places} />
            </tr>
          )}
          <tr>
            <Cell className="font-semibold">น้ำพริก (หลอด)</Cell>
            {places.map((place) => (
              <HeldCell
                key={place}
                held={chili[place]}
                today={today}
                varianceUnit="หลอด"
              />
            ))}
            <StatusCells at={chili} places={places} />
          </tr>
        </StockTable>
      </DayCard>
      <Caption className="flex flex-col gap-1">
        {[
          "หน้านี้ดูได้อย่างเดียว ผู้ดูแลสาขาเป็นคนนับจากหน้า Stock ของสาขา",
          "ข้าวเหนียวดิบ = ยอดนับล่าสุด + ยอดที่ซื้อเข้าสาขาหลังจากนั้น ไม่มีการตัดยอดอัตโนมัติ จึงไม่มีส่วนต่าง",
          '"—" = สาขาที่ไม่ได้ใช้ข้าวเหนียวดิบ (กำหนดใน Settings)',
          "ช่องสีเหลืองคือยังไม่เคยนับหรือไม่ได้นับเกิน 7 วัน ช่องสีแดงคือไม่เหลือ",
          "ส่วนต่าง = ยอดที่นับได้ − ยอดที่ควรเหลือก่อนนับ ของการนับครั้งล่าสุด มีตั้งแต่การนับครั้งที่สอง",
        ].map((line) => (
          <span key={line}>{line}</span>
        ))}
      </Caption>
    </div>
  );
}
