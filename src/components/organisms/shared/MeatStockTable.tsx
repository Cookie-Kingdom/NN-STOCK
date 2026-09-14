"use client";

import { Button } from "@/components/atoms/Button";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { balance, centralBagStock, centralStock, entries, n, processed, produced, rawAtFoodiva, stages, type Database, type Lot, type Role } from "@/lib/store";
import { fmt } from "@/lib/format";

export function MeatStockTable({
  db,
  role,
  branch,
  lots,
  open,
}: {
  db: Database;
  role: Role;
  branch: string;
  lots: Lot[];
  open: (kind: string, lotId?: string) => void;
}) {
  const lotIds = lots.map((lot) => lot.id);
  if (role === "owner")
    return (
      <DataTable
        title="สต๊อกเนื้อทุกจุด (Meat inventory)"
        columns={["Lot", "ค้างที่ Foodiva", "ส่วนกลาง", "ถุงในคลังกลาง", "ศาลาแดง", "มีนบุรี", "สถานะ", "การทำงาน"]}
        rowKeys={lotIds}
        rows={lots.map((lot) => [
          lot.id,
          entries(db, "foodDivaConfirm", lot.id).length
            ? `${fmt(rawAtFoodiva(db, lot))} กก. (เนื้อดิบ)`
            : "รอ Foodiva ยืนยัน Invoice",
          `${fmt(centralStock(db, lot.id))} กก.`,
          `${centralBagStock(db, lot.id)} ถุง`,
          `${fmt(balance(db, lot.id, "ศาลาแดง").frozen)} แช่แข็ง / ${fmt(balance(db, lot.id, "ศาลาแดง").ready)} พร้อมขาย`,
          `${fmt(balance(db, lot.id, "มีนบุรี").frozen)} แช่แข็ง / ${fmt(balance(db, lot.id, "มีนบุรี").ready)} พร้อมขาย`,
          stages[lot.stage],
          <Button
            key={lot.id}
            variant="table"
            disabled={lot.stage < 8 || centralStock(db, lot.id) <= 0.001}
            onClick={() => open("allocate", lot.id)}
          >
            จัดสรร
          </Button>,
        ])}
      />
    );
  if (role === "cm")
    return (
      <DataTable
        title="สต๊อกและงานผลิต Chef_house"
        columns={["Lot", "ก่อนสโมค", "รอผลิต", "น้ำหนักเนื้อหลังรมควัน", "สถานะ"]}
        rowKeys={lotIds}
        rows={lots.map((lot) => [
          lot.id,
          `${fmt(n(lot.values, "preKg"))} กก.`,
          `${fmt(n(lot.values, "preKg") - processed(db, lot.id))} กก.`,
          `${fmt(produced(db, lot.id))} กก.`,
          stages[lot.stage],
        ])}
      />
    );
  return (
    <DataTable
      title={`สต๊อกเนื้อ · ${branch}`}
      columns={["Lot", "รอรับจาก Owner", "รับแล้ว", "แช่แข็ง", "พร้อมขาย", "สถานะ"]}
      rowKeys={lotIds}
      rows={lots.map((lot) => {
        const stock = balance(db, lot.id, branch);
        const pending =
          entries(db, "allocate", lot.id, branch).reduce(
            (sum, allocation) => sum + n(allocation.values, "kg"),
            0,
          ) - stock.received;
        return [
          lot.id,
          pending > 0.001 ? `${fmt(pending)} กก.` : "-",
          `${fmt(stock.received)} กก.`,
          `${fmt(stock.frozen)} กก.`,
          `${fmt(stock.ready)} กก.`,
          pending > 0.001 ? "รอยืนยันรับของ · ทำต่อที่กรอกรายวัน" : stages[lot.stage],
        ];
      })}
    />
  );
}
