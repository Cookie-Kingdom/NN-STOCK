"use client";

import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  branchMeatDay,
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

export function DailySummary({
  db,
  branch,
  date,
}: {
  db: Database;
  branch: string;
  date: string;
}) {
  const sales = entries(db, "sale", undefined, branch, date);
  return (
    <DataTable
      title={`สรุปรายวัน · ${date} · ${branch}`}
      columns={["รายการ", "ยอดวันนี้", "หน่วย / สถานะ"]}
      rows={[
        [
          "ยอดขาย LINE MAN",
          fmt(sales.reduce((s, e) => s + n(e.values, "revenue"), 0)),
          "บาท",
        ],
        [
          "คงเหลือชิลทั้งหมด (ยกไปวันถัดไป)",
          fmt(
            db.lots.reduce(
              (s, l) => s + branchMeatDay(db, l.id, branch, date).chillOut,
              0,
            ),
          ),
          "กก.",
        ],
        ...(branch === "ศาลาแดง"
          ? [
              ["ข้าวเหนียวดิบคงเหลือ", fmt(rawRiceStock(db, branch)), "กก."],
              [
                "ข้าวเหนียวดิบที่เบิกแล้วยังไม่หุง",
                fmt(issuedRawRiceStock(db, branch)),
                "กก.",
              ],
            ]
          : []),
        ["ข้าวเหนียวสุกคงเหลือ", fmt(cookedRiceStock(db, branch)), "กก."],
        ...(branch === "มีนบุรี"
          ? [
              [
                "ข้าวเหนียวสุกที่ควรซื้อเพิ่ม",
                fmt(
                  Math.max(
                    0,
                    n(db.config, "cookedRicePar") - cookedRiceStock(db, branch),
                  ),
                ),
                "กก.",
              ],
            ]
          : []),
        ["น้ำพริกที่ Owner จัดสรร", String(chiliAllocated(db, branch)), "หลอด"],
        ["น้ำพริกคงเหลือหลังหักยอดขาย", String(chiliStock(db, branch)), "หลอด"],
        [
          "ตรวจนับวัสดุ",
          String(entries(db, "materials", undefined, branch, date).length),
          entries(db, "materials", undefined, branch, date).length
            ? "บันทึกแล้ว"
            : "ยังไม่บันทึก",
        ],
      ]}
    />
  );
}
