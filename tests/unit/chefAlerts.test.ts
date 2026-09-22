import { expect, test } from "vitest";
// Aliased: it is a plain function despite the name, and the alias keeps the hooks lint rule quiet.
import { useChefAlerts as chefAlerts } from "@/components/organisms/chef/useChefAlerts";
import { seed, visibleDatabase, type Database } from "@/lib/store";
import {
  closed,
  day,
  dispatch,
  invoice,
  packingList,
  packs,
  readyToDispatch,
  received,
  setup,
  smoked,
  smokeOrder,
} from "./fixtures";

/** The bell reads the Chef House view of the database, same as the workspace does. */
const chef = (db: Database) => chefAlerts(visibleDatabase(db, "cm"));
const titles = (db: Database) =>
  chef(db).notifications.map((item) => item.title);

/** A 50 kg shipment trucked in with its smoke PO sent but not accepted yet. */
function atTheDoor() {
  const s = setup();
  readyToDispatch(s, "50");
  dispatch(s);
  packingList(s, "25\n25");
  smokeOrder(s);
  return s;
}

test("an empty database gives Chef House nothing to do", () => {
  const alerts = chef(structuredClone(seed));
  expect(alerts.notifications).toEqual([]);
  expect(alerts.badges).toEqual({ "cm-receive": 0, work: 0, history: 0 });
});

test("meat at the door and an unaccepted PO are two separate jobs", () => {
  const s = atTheDoor();
  expect(chef(s.db).notifications).toEqual([
    {
      title: "มีเนื้อมาส่ง รอยืนยันรับ · SH-2026-0001",
      detail:
        "2 กล่องรับเข้า · 50.00 กก. ตาม Packing List · ชั่งน้ำหนักจริงรายกล่อง",
      tab: "cm-receive",
    },
    {
      title: "PO รมควันใหม่รอยืนยัน · SO-2026-0001",
      detail: "ต้องยืนยันรับ PO รมควันก่อนเริ่มงานรมควัน (รับเนื้อเข้าก่อนได้)",
      tab: "work",
    },
  ]);
  expect(chef(s.db).badges).toEqual({
    "cm-receive": 1,
    work: 1,
    history: 0,
  });
  // Receiving the meat first drops that job and leaves the PO; then the pre-smoke weight.
  s.run("cm", "cmReceive", { arrival: "08:00", receivedBoxes: "24.5\n24.5" });
  expect(titles(s.db)).toEqual([
    "PO รมควันใหม่รอยืนยัน · SO-2026-0001",
    "รอบันทึกน้ำหนักก่อนสโมค · SH-2026-0001",
  ]);
  expect(chef(s.db).badges).toEqual({
    "cm-receive": 0,
    work: 1,
    history: 0,
  });
  s.run("cm", "smokeOrderAccept", { acceptedBy: "Chef House" });
  expect(chef(s.db).notifications).toEqual([
    {
      title: "รอบันทึกน้ำหนักก่อนสโมค · SH-2026-0001",
      detail: "รับเข้าแล้ว 49.00 กก. · กรอกน้ำหนักก่อนสโมคเพื่อเริ่มผลิต",
      tab: "work",
    },
  ]);
});

test("the production stages each name the step that is waiting", () => {
  const s = setup();
  received(s, "50", "25\n25", "24.5\n24.5");
  s.run("cm", "prepare", { preSmokeKg: "48" });
  expect(chef(s.db).notifications).toEqual([
    {
      title: "รอบันทึก Lot สโมครายวัน · SH-2026-0001",
      detail: "เหลือรอผลิต 48.00 กก.",
      tab: "work",
    },
  ]);
  s.run("cm", "smoke", {
    smokeDate: day,
    inputKg: "20",
    wasteKg: "5",
    packs: packs(150),
  });
  expect(chef(s.db).notifications[0].detail).toBe("เหลือรอผลิต 28.00 กก.");
  expect(chef(s.db).badges.work).toBe(1);
  // Everything smoked: the run only needs closing now.
  const done = smoked();
  expect(titles(done.db)).toEqual(["รอยืนยันปิด Lot · SH-2026-0001"]);
});

test("a closed run asks for the smoking invoice, then for the Owner's fixes", () => {
  const s = closed();
  expect(titles(s.db)).toEqual([
    "ยังไม่ Submit Invoice ค่ารมควัน · SH-2026-0001",
  ]);
  expect(chef(s.db).badges.work).toBe(1);
  const sent = invoice(s);
  // Submitted and waiting for the Owner: nothing is in Chef House's hands.
  expect(titles(s.db)).toEqual([]);
  expect(chef(s.db).badges.work).toBe(0);
  s.run("owner", "invoiceReview", {
    invoiceId: sent.id,
    decision: "ส่งกลับแก้ไข",
    reviewedBy: "Owner",
    comment: "ยอดคลาดเคลื่อน",
  });
  expect(chef(s.db).notifications).toEqual([
    {
      title: "Owner ส่ง Invoice กลับมาแก้ไข · CH-1",
      detail: "ยอดคลาดเคลื่อน · แก้ไขแล้ว Submit ใบวางบิลใหม่",
      tab: "work",
    },
  ]);
  expect(chef(s.db).badges.work).toBe(1);
  s.run("owner", "invoiceReview", {
    invoiceId: sent.id,
    decision: "รับยอด",
    reviewedBy: "Owner",
  });
  // Accepted, then paid: news for Chef House, not work.
  expect(titles(s.db)).toEqual([]);
});
