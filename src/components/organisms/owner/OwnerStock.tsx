"use client";

import { Button } from "@/components/atoms/Button";
import { Caption } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import {
  Cell,
  Left,
  MaterialCount,
  StockTable,
} from "@/components/organisms/branch/BranchStock";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import {
  branchMeat,
  branches,
  lotInfo,
  poInfo,
  purchaseLots,
  shipments,
} from "@/lib/store";

/** Inventory as the Owner and the Account Manager see it: the meat from the seller to each
 *  branch (V2-CAL-07, 08, 10), then every branch's materials and chili. 「นับเนื้อ」 still
 *  opens the meat count of a branch; the materials cards are read-only, the branch admins
 *  count them on their own Inventory page. */
export function OwnerStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const held = purchaseLots(db)
    .map((lot) => ({ lot, kg: poInfo(db, lot.id).heldKg }))
    .filter((po) => po.kg > 0);
  const central = shipments(db)
    .map((lot) => lotInfo(db, lot.id))
    .filter((info) => info.backKg > 0);
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
          {central.map((info) => (
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
                <Cell
                  tone={meat.countedToday ? "success" : "warning"}
                  className="py-1"
                >
                  <span className="flex flex-wrap items-center justify-between gap-x-3">
                    {meat.countedToday ? "นับแล้ววันนี้" : "วันนี้ยังไม่ได้นับ"}
                    <Button
                      variant="link"
                      className="min-h-11 text-label"
                      aria-label={`นับเนื้อ สาขา${branch}`}
                      onClick={() => ws.jot({ kind: "meatCount", branch })}
                    >
                      นับเนื้อ
                    </Button>
                  </span>
                </Cell>
              </tr>
            );
          })}
        </StockTable>
      </DayCard>
      <Caption>
        วัสดุและน้ำพริกไม่มีคลังกลาง ซื้อแล้วเข้าสาขาทันที ·
        แอดมินสาขาเป็นคนอัปเดตยอดนับจากหน้าของสาขา หน้านี้ดูได้อย่างเดียว ·
        ไม่ได้นับเกิน 7 วันขึ้นสีเหลือง
      </Caption>
      <div className="grid grid-cols-2 items-start gap-4 max-[1000px]:grid-cols-1">
        {branches.map((branch) => (
          <MaterialCount
            key={branch}
            ws={ws}
            branch={branch}
            title={`วัสดุและน้ำพริก สาขา${branch}`}
            note="แอดมินสาขาเป็นคนอัปเดต"
            readOnly
          />
        ))}
      </div>
    </div>
  );
}
