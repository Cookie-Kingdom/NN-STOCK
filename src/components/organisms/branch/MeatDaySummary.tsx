"use client";

import { Notice } from "@/components/molecules/Notice";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { branchMeatDay, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

/** Thawed meat of one branch day, per lot: what came in from yesterday's chiller, what
 * was thawed, used and wasted today, and what goes back into the chiller for tomorrow. */
export function MeatDaySummary({
  db,
  branch,
  date,
}: {
  db: Database;
  branch: string;
  date: string;
}) {
  const days = db.lots
    .map((lot) => ({ id: lot.id, ...branchMeatDay(db, lot.id, branch, date) }))
    .filter((d) =>
      [d.chillIn, d.thawed, d.used, d.waste].some((kg) => Math.abs(kg) > 0.001),
    );
  const total = (key: "chillIn" | "thawed" | "used" | "waste" | "chillOut") =>
    days.reduce((s, d) => s + d[key], 0);
  const kg = (value: number) => `${fmt(value)} กก.`;
  return (
    <>
      <DataTable
        title={`เนื้อละลายวันนี้ · ${date} · ${branch}`}
        columns={[
          "Lot",
          "ชิลยกมา",
          "ละลายแล้ววันนี้",
          "ใช้จริงวันนี้",
          "เวสต์",
          "คงเหลือชิล (ยกไปวันถัดไป)",
        ]}
        rowKeys={days.map((d) => d.id)}
        rows={days.map((d) => [
          d.id,
          kg(d.chillIn),
          kg(d.thawed),
          kg(d.used),
          kg(d.waste),
          kg(d.chillOut),
        ])}
        emptyText="วันนี้ยังไม่มีเนื้อละลายหรือชิลยกมา"
      />
      {days.length > 0 && (
        <Notice tone="success" role="none">
          ใช้ {kg(total("used"))} + เวสต์ {kg(total("waste"))} + คงเหลือชิล{" "}
          {kg(total("chillOut"))} = ละลายแล้ว {kg(total("thawed"))}
          {total("chillIn") > 0.001 && ` + ชิลยกมา ${kg(total("chillIn"))}`}
          {total("chillOut") > 0.001 &&
            ` · ปิดวันได้ คงเหลือชิล ${kg(total("chillOut"))} ยกไปวันถัดไป`}
        </Notice>
      )}
    </>
  );
}
