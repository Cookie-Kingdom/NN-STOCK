"use client";

import { Button } from "@/components/atoms/Button";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  balance,
  branches,
  centralStock,
  entries,
  n,
  pendingSmokeKg,
  produced,
  smokedAtFoodiva,
  batchKinds,
  lotProgress,
  titles,
  type Database,
  type Lot,
  type EntryKind,
} from "@/lib/store";
import { fmt } from "@/lib/format";

const progressLabel = (db: Database, lotId: string) =>
  batchKinds
    .filter((k) => lotProgress(db, lotId).has(k))
    .map((k) => titles[k])
    .at(-1) ?? "—";

/** `owner`: every stock point with allocate; `chef`: Chef House's production stock (the Owner's
 *  `work` tab). */
export function MeatStockTable({
  db,
  variant,
  lots,
  open,
}: {
  db: Database;
  variant: "owner" | "chef";
  lots: Lot[];
  open: (kind: EntryKind, lotId?: string) => void;
}) {
  const lotIds = lots.map((lot) => lot.id);
  const branchCell = (lotId: string, branch: string) => {
    const { frozen, ready } = balance(db, lotId, branch);
    return `${fmt(frozen)} แช่แข็ง / ${fmt(ready)} ชิล/ละลายแล้ว`;
  };
  const unlinked = entries(db, "receive", "").length > 0;
  if (variant === "owner")
    return (
      <DataTable
        title="สต๊อกเนื้อทุกจุด (Meat inventory)"
        columns={[
          "Lot",
          "ค้างที่ Foodiva",
          "ส่วนกลาง",
          ...branches,
          "สถานะ",
          "การทำงาน",
        ]}
        rowKeys={[...lotIds, ...(unlinked ? [""] : [])]}
        rows={[
          ...lots.map((lot) => [
            lot.id,
            // A batch's smoked beef in Foodiva's freezer, not yet counted into central.
            smokedAtFoodiva(db, lot) > 0.001
              ? `${fmt(smokedAtFoodiva(db, lot))} กก. (รอรับเข้าส่วนกลาง)`
              : "—",
            `${fmt(centralStock(db, lot.id))} กก.`,
            ...branches.map((branch) => branchCell(lot.id, branch)),
            progressLabel(db, lot.id),
            // BR-01: always open; over central stock is a warning in the form.
            <Button
              key={lot.id}
              variant="table"
              onClick={() => open("allocate", lot.id)}
            >
              จัดสรร
            </Button>,
          ]),
          // DASH-06: branch meat in the "ไม่ระบุ Lot" bucket is stock too.
          ...(unlinked
            ? [
                [
                  "ไม่ระบุ Lot",
                  "—",
                  "—",
                  ...branches.map((branch) => branchCell("", branch)),
                  "ยังไม่ผูก Lot",
                  "—",
                ],
              ]
            : []),
        ]}
      />
    );
  return (
    <DataTable
      title="สต๊อกและงานผลิต Chef House"
      columns={["Lot", "ก่อนสโมค", "รอผลิต", "น้ำหนักเนื้อหลังรมควัน", "สถานะ"]}
      rowKeys={lotIds}
      rows={lots.map((lot) => [
        lot.id,
        `${fmt(n(lot.values, "preSmokeKg"))} กก.`,
        `${fmt(pendingSmokeKg(db, lot))} กก.`,
        `${fmt(produced(db, lot.id))} กก.`,
        progressLabel(db, lot.id),
      ])}
    />
  );
}
