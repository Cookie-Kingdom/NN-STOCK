import { expect, test } from "vitest";
// Aliased: plain functions despite the names; the alias keeps the hooks lint rule quiet.
import { useBranchAlerts as branchAlerts } from "@/components/organisms/branch/useBranchAlerts";
import { useOwnerAlerts as ownerAlerts } from "@/components/organisms/owner/useOwnerAlerts";
import { today } from "@/lib/format";
import {
  STAGE,
  isClosed,
  ownerBranchScenario,
  ownerWasteOutstanding,
  purchaseLots,
} from "@/lib/store";

const end = today();
const db = ownerBranchScenario(end);
const day = (offset: number) => {
  const value = new Date(`${end}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - offset);
  return value.toISOString().slice(0, 10);
};
const titles = (items: { title: string }[]) => items.map((item) => item.title);

test("every shipment is parked at its own step", () => {
  const stage = (sh: number) =>
    db.lots.find(
      (lot) => lot.poId.endsWith(`-${String(sh).padStart(4, "0")}`) && lot.kind,
    )?.stage;
  expect([1, 3, 4, 5, 6, 7, 11, 12, 13].map(stage)).toEqual([
    STAGE.allocate,
    STAGE.dispatch,
    STAGE.cmReceive,
    STAGE.cmReceive,
    STAGE.smoke,
    STAGE.return,
    STAGE.central,
    STAGE.central,
    STAGE.allocate,
  ]);
  expect(
    purchaseLots(db).map((lot) => ownerWasteOutstanding(db, lot.id)),
  ).toEqual([20, 0, 20, 0]);
});

test("the Owner has one of every pending signal", () => {
  const alerts = ownerAlerts(db);
  const list = titles(alerts.notifications).join("\n");
  for (const title of [
    "คำขอแก้ไขรอพิจารณา 1 รายการ",
    "รอ Foodiva ออก Invoice",
    "รอ Foodiva ทำใบขนส่ง · SH-",
    "Packing List พร้อมแล้ว",
    "รอ Chef House ยืนยัน PO โรงรมควัน",
    "รอ Chef House Submit Invoice ค่ารมควัน",
    "รอตรวจ Invoice ค่ารมควัน",
    "รอชำระ Invoice ค่ารมควัน",
    "รอ Chef House แก้ Invoice",
    "รอ Foodiva รับเนื้อรมควัน",
    "รอชำระ Invoice เนื้อ",
    "Chef House ปิด Lot แล้ว",
    "Foodiva รับเนื้อรมควันแล้ว 1 Lot",
    "มีเนื้อพร้อมจัดสรร 2 Lot",
  ])
    expect(list).toContain(title);
  expect(alerts.missingMaterialSettings).toBe(0);
});

test("the two branches are in different states today", () => {
  expect(titles(branchAlerts(db, "ศาลาแดง", end).notifications)).toEqual([
    expect.stringContaining("คำขอแก้ไขรอพิจารณา"),
    "รับเนื้อเข้าสาขา 1 Lot",
    `ยังไม่แบ่งละลายเนื้อวันที่ ${end}`,
    `ยังไม่บันทึกยอดขายวันที่ ${end}`,
    `ยังขาด 4 รายการก่อนปิดวันที่ ${end}`,
    "วัสดุรอยืนยันรับ 2 รายการ",
    `ยังไม่ตรวจนับสต๊อกวัสดุวันที่ ${end}`,
  ]);
  expect(titles(branchAlerts(db, "มีนบุรี", end).notifications)).toEqual([
    expect.stringContaining("คำขอแก้ไขไม่สำเร็จ"),
    expect.stringContaining("คำขอแก้ไขสำเร็จ"),
    "รับเนื้อเข้าสาขา 1 Lot",
    `ยังขาด 1 รายการก่อนปิดวันที่ ${end}`,
  ]);
  for (const offset of [4, 3, 2]) {
    expect(isClosed(db, "ศาลาแดง", day(offset))).toBe(true);
    expect(isClosed(db, "มีนบุรี", day(offset))).toBe(true);
  }
  expect(isClosed(db, "ศาลาแดง", day(1))).toBe(false);
  expect(isClosed(db, "มีนบุรี", day(1))).toBe(true);
});
