"use client";

import { Button } from "@/components/atoms/Button";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  balance,
  centralStock,
  entries,
  n,
  pendingReceiveKg,
  pendingSmokeKg,
  produced,
  rawAtFoodiva,
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
 *  `work` tab); `branch`: one branch's stock. */
export function MeatStockTable({
  db,
  variant,
  branch,
  lots,
  open,
}: {
  db: Database;
  variant: "owner" | "chef" | "branch";
  branch: string;
  lots: Lot[];
  open: (kind: EntryKind, lotId?: string) => void;
}) {
  const lotIds = lots.map((lot) => lot.id);
  if (variant === "owner")
    return (
      <DataTable
        title="สต๊อกเนื้อทุกจุด (Meat inventory)"
        columns={[
          "Lot",
          "ค้างที่ Foodiva",
          "ส่วนกลาง",
          "ศาลาแดง",
          "มีนบุรี",
          "สถานะ",
          "การทำงาน",
        ]}
        rowKeys={lotIds}
        rows={lots.map((lot) => [
          lot.id,
          // Shipments hold no raw beef at Foodiva; it is counted on their purchase POs.
          lot.kind
            ? "—"
            : entries(db, "foodivaConfirm", lot.id).length
              ? `${fmt(rawAtFoodiva(db, lot))} กก. (เนื้อดิบ)`
              : "รอ Foodiva ยืนยัน Invoice",
          `${fmt(centralStock(db, lot.id))} กก.`,
          `${fmt(balance(db, lot.id, "ศาลาแดง").frozen)} แช่แข็ง / ${fmt(balance(db, lot.id, "ศาลาแดง").ready)} ชิล/ละลายแล้ว`,
          `${fmt(balance(db, lot.id, "มีนบุรี").frozen)} แช่แข็ง / ${fmt(balance(db, lot.id, "มีนบุรี").ready)} ชิล/ละลายแล้ว`,
          progressLabel(db, lot.id),
          // BR-01: always open; over central stock is a warning in the form.
          <Button
            key={lot.id}
            variant="table"
            onClick={() => open("allocate", lot.id)}
          >
            จัดสรร
          </Button>,
        ])}
      />
    );
  if (variant === "chef")
    return (
      <DataTable
        title="สต๊อกและงานผลิต Chef House"
        columns={[
          "Lot",
          "ก่อนสโมค",
          "รอผลิต",
          "น้ำหนักเนื้อหลังรมควัน",
          "สถานะ",
        ]}
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
  return (
    <DataTable
      title={`สต๊อกเนื้อ · ${branch}`}
      columns={[
        "Lot",
        "รอรับจาก Owner",
        "รับแล้ว",
        "แช่แข็ง",
        "คงเหลือชิล (ละลายแล้ว)",
        "สถานะ",
      ]}
      rowKeys={lotIds}
      rows={lots.map((lot) => {
        const stock = balance(db, lot.id, branch);
        const pending = pendingReceiveKg(db, lot.id, branch);
        return [
          lot.id,
          pending > 0 ? `${fmt(pending)} กก.` : "-",
          `${fmt(stock.received)} กก.`,
          `${fmt(stock.frozen)} กก.`,
          `${fmt(stock.ready)} กก.`,
          pending > 0
            ? "รอยืนยันรับของ · ทำต่อที่กรอกรายวัน"
            : progressLabel(db, lot.id),
        ];
      })}
    />
  );
}
