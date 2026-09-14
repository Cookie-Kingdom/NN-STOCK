"use client";

import { DataTable } from "@/components/organisms/shared/DataTable";
import { chiliAllocated, entries, n, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

export function ChiliDailySummary({ db, branch, date }: { db: Database; branch: string; date: string }) {
  const allocatedToDate = chiliAllocated(db, branch, date);
  const soldBeforeToday = entries(db, "sale", undefined, branch)
    .filter((entry) => entry.date < date)
    .reduce((total, entry) => total + n(entry.values, "chiliSold"), 0);
  const salesToday = entries(db, "sale", undefined, branch, date);
  const soldToday = salesToday.reduce((total, entry) => total + n(entry.values, "chiliSold"), 0);
  const opening = allocatedToDate - soldBeforeToday;
  const expected = opening - soldToday;
  const latestCount = [...salesToday].reverse().find(
    (entry) => entry.values.chiliCount !== "" && entry.values.chiliCount !== undefined,
  );
  const actual = latestCount ? n(latestCount.values, "chiliCount") : null;
  const mismatch = actual !== null && actual !== expected;
  return (
    <DataTable
      title="น้ำพริกหลอด · Owner จัดสรร / สาขาตรวจสอบยอด"
      columns={["รายการ", "จำนวน", "หน่วย / สถานะ"]}
      rows={[
        ["ยอดตั้งต้นจาก Owner", fmt(opening), "หลอด · สาขาไม่ต้องซื้อหรือเบิกเอง"],
        ["ขายแยกวันนี้", fmt(soldToday), "หลอด · ระบบหักจากยอดขายอัตโนมัติ"],
        ["ควรเหลือหลังยอดขาย", fmt(expected), "หลอด"],
        ["ตรวจนับจริงปลายวัน", actual === null ? "ยังไม่ได้ตรวจนับ" : fmt(actual), mismatch ? <span className="badge danger">ยอดไม่ตรง</span> : actual === null ? "กรอกได้ในฟอร์มยอดขาย" : <span className="badge">ตรงกัน</span>],
        ["หมายเหตุส่วนต่าง", mismatch ? (latestCount?.values.chiliRemark || "—") : "—", mismatch ? "ต้องระบุเมื่อยอดไม่ตรง" : ""],
      ]}
    />
  );
}
