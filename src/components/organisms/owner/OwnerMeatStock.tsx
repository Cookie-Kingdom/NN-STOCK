"use client";

import { Caption } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import {
  Cell,
  Left,
  StockTable,
} from "@/components/organisms/branch/BranchStock";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { qty } from "@/lib/format";
import {
  branchBought,
  branchChili,
  branchMeat,
  branches,
  lotInfo,
  poInfo,
  purchaseLots,
  shipments,
} from "@/lib/store";

/** Stock as the Owner and the Account Manager see it: the meat from the seller to each
 *  branch (V2-CAL-07, 08, 10), then the sticky rice and the chili of each branch.
 *  Read-only: the branch admins count on their own Inventory page. */
export function OwnerMeatStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const held = purchaseLots(db)
    .map((lot) => ({ lot, kg: poInfo(db, lot.id).heldKg }))
    .filter((po) => po.kg > 0);
  const smoked = shipments(db)
    .map((lot) => lotInfo(db, lot.id))
    .filter((info) => info.backKg > 0);
  // Sticky rice has no count and no use jotted: what was bought so far, not a balance.
  const rice = branches.map((branch) => branchBought(db, branch, "rice"));
  const chili = branches.map((branch) => branchChili(db, branch).qty);
  const sum = (figures: number[]) => figures.reduce((a, b) => a + b, 0);
  return (
    <div className="flex flex-col gap-4">
      <DayCard
        aria-label="เนื้อ (กก.)"
        title="เนื้อ (กก.)"
        aside={<Caption>ตั้งแต่ร้านขายเนื้อจนถึงสาขา</Caption>}
      >
        <StockTable
          columns={["อยู่ที่ไหน", "รายการ", "คงเหลือ", "การนับ"]}
          right={["คงเหลือ"]}
        >
          {held.map(({ lot, kg }) => (
            <tr key={lot.id}>
              <Cell>ฝากไว้ที่ร้านขายเนื้อ</Cell>
              <Cell>
                {[lot.poId, lot.values.supplier].filter(Boolean).join(" · ")}
              </Cell>
              <Left n={kg} />
              <Cell />
            </tr>
          ))}
          {smoked.map((info) => (
            <tr key={info.lot.id}>
              <Cell>สต๊อกกลาง</Cell>
              <Cell>{info.lot.poId}</Cell>
              <Left n={info.centralKg} />
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
          columns={[
            "สินค้า",
            ...branches.map((branch) => `สาขา${branch}`),
            "รวม",
            "สถานะ",
          ]}
          right={[...branches.map((branch) => `สาขา${branch}`), "รวม"]}
        >
          <tr>
            <Cell className="font-semibold">ข้าวเหนียว</Cell>
            {rice.map((n, i) => (
              <Cell key={branches[i]} right>
                {qty(n)}
              </Cell>
            ))}
            <Cell right>{qty(sum(rice))}</Cell>
            <Cell className="text-text-secondary">
              ซื้อเข้าสะสม · ยังไม่มียอดนับ
            </Cell>
          </tr>
          <tr>
            <Cell className="font-semibold">น้ำพริก</Cell>
            {chili.map((n, i) => (
              <Cell
                key={branches[i]}
                right
                tone={n <= 0 ? "danger" : undefined}
              >
                {qty(n)}
              </Cell>
            ))}
            <Cell right tone={sum(chili) < 0 ? "danger" : undefined}>
              {qty(sum(chili))}
            </Cell>
            <Cell tone={sum(chili) <= 0 ? "danger" : "success"}>
              {sum(chili) <= 0 ? "หมด" : "พร้อมใช้"}
            </Cell>
          </tr>
        </StockTable>
      </DayCard>
      <Caption>
        หน้านี้ดูได้อย่างเดียว แอดมินสาขาเป็นคนนับจากหน้าของสาขา ·
        ข้าวเหนียวเป็นยอดที่ซื้อเข้าสาขาสะสม ยังไม่มีการนับและการตัดยอด
        จึงไม่ใช่ยอดคงเหลือ
      </Caption>
    </div>
  );
}
