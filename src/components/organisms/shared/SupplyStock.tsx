"use client";

import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  chiliAllocated,
  chiliStock,
  cookedRiceStock,
  entries,
  issuedRawRiceStock,
  n,
  rawRiceStock,
  type Database,
} from "@/lib/store";
import { fmt } from "@/lib/format";

export function SupplyStock({
  db,
  branches: stockBranches,
}: {
  db: Database;
  branches: string[];
}) {
  return (
    <DataTable
      title="สต๊อกข้าวเหนียวและน้ำพริก (Rice & chili inventory)"
      columns={[
        "สาขา",
        "ข้าวดิบในคลัง",
        "ข้าวดิบที่เบิก",
        "ข้าวสุก",
        "น้ำพริกที่ Owner จัดสรร",
        "น้ำพริกคงเหลือ",
        "ข้าวที่ควรซื้อเพิ่ม",
        "ซื้อเข้าล่าสุด",
      ]}
      rowKeys={stockBranches}
      rows={stockBranches.map((name) => {
        const latest = [
          ...entries(db, "supplyPurchase", undefined, name),
          ...entries(db, "ricePurchase", undefined, name),
        ]
          .sort((a, b) => a.at.localeCompare(b.at))
          .at(-1);
        const boughtCooked = n(latest?.values ?? {}, "cookedRiceKg") > 0;
        return [
          <strong key={name}>{name}</strong>,
          `${fmt(rawRiceStock(db, name))} กก.`,
          `${fmt(issuedRawRiceStock(db, name))} กก.`,
          `${fmt(cookedRiceStock(db, name))} กก.`,
          `${fmt(chiliAllocated(db, name))} หลอด`,
          `${fmt(chiliStock(db, name))} หลอด`,
          `${fmt(
            Math.max(
              0,
              // The branch's latest round decides which rice it tops up (B2).
              n(db.config, boughtCooked ? "cookedRicePar" : "rawRicePar") -
                (boughtCooked
                  ? cookedRiceStock(db, name)
                  : rawRiceStock(db, name)),
            ),
          )} กก.`,
          latest ? latest.date : "ยังไม่มีรายการซื้อเข้า",
        ];
      })}
    />
  );
}
