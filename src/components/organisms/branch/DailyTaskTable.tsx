"use client";

import { Button } from "@/components/atoms/Button";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { entries, titles, type Database } from "@/lib/store";

export function DailyTaskTable({
  title,
  kinds,
  db,
  branch,
  date,
  disabled,
  hasLots,
  open,
}: {
  title: string;
  kinds: string[];
  db: Database;
  branch: string;
  date: string;
  disabled: boolean;
  hasLots: boolean;
  open: (kind: string, lotId?: string) => void;
}) {
  return (
    <DataTable
      title={title}
      columns={["รายการ", "สถานะ", "จำนวนรายการ", "การทำงาน"]}
      rowKeys={kinds}
      rows={kinds.map((kind) => {
        const count = entries(db, kind, undefined, branch, date).length;
        const optional = kind === "ricePurchase" || kind === "chiliPurchase";
        const label = kind === "ricePurchase" && branch === "ศาลาแดง"
          ? "ซื้อข้าวเหนียวดิบเข้าสต๊อก · กก."
          : titles[kind];
        return [
          optional ? `${label} · บันทึกเฉพาะวันที่ซื้อ` : label,
          count ? "บันทึกแล้ว" : optional ? "ไม่บังคับวันนี้" : "รอบันทึก",
          String(count),
          <Button
            key={kind}
            variant="table"
            disabled={disabled || (kind === "sale" && !hasLots)}
            onClick={() => open(kind)}
          >
            {kind === "closeDay" ? "ตรวจและปิดวัน" : "กรอกข้อมูล"}
          </Button>,
        ];
      })}
    />
  );
}
