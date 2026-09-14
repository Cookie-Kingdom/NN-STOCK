/** Default dashboard / daily-status range: the 7 days ending on `date` (inclusive). */
export function sevenDayRangeStart(date: string) {
  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return start.toISOString().slice(0, 10);
}

const minburiDailyKinds = [
  "ricePurchase",
  "riceCarry",
  "materials",
  "sale",
  "closeDay",
];
const saladaengDailyKinds = [
  "riceIssue",
  "rice",
  "materials",
  "sale",
  "closeDay",
];

/** Entry kinds a branch manager must record every working day. */
export function requiredDailyKinds(branchName: string) {
  return branchName === "มีนบุรี" ? minburiDailyKinds : saladaengDailyKinds;
}

export const requiredDailyLabels: Record<string, string> = {
  ricePurchase: "ซื้อข้าวเข้า",
  riceCarry: "บันทึกข้าวคงเหลือ",
  riceIssue: "เบิกข้าวไปใช้",
  rice: "บันทึกข้าวคงเหลือ",
  materials: "เช็กวัสดุ 7 รายการ",
  sale: "ยอดขายสิ้นวัน",
  closeDay: "ปิดวัน",
};
