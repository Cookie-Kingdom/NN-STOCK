import { requiredRiceKinds, type Database, type EntryKind } from "@/lib/store";

/** Default dashboard / daily-status range: the 7 days ending on `date` (inclusive). */
export function sevenDayRangeStart(date: string) {
  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return start.toISOString().slice(0, 10);
}

/** Entry kinds a branch manager owes for `date`. Rice follows what the branch did that
 *  day (requiredRiceKinds, the same rule closeDay checks), not which branch it is. */
export function requiredDailyKinds(
  db: Database,
  branchName: string,
  date: string,
): EntryKind[] {
  return [
    ...requiredRiceKinds(db, branchName, date),
    "materials",
    "sale",
    "closeDay",
  ];
}

export const requiredDailyLabels: Record<string, string> = {
  ricePurchase: "ซื้อข้าวเข้า",
  riceCarry: "ยืนยันข้าวสุกคงเหลือ",
  riceIssue: "เบิกข้าวไปใช้",
  rice: "บันทึกหุงข้าว",
  materials: "เช็กวัสดุ 7 รายการ",
  sale: "ยอดขายสิ้นวัน",
  closeDay: "ปิดวัน",
};
