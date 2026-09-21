import { expect, test } from "vitest";
// Aliased: it is a plain function despite the name, and the alias keeps the hooks lint rule quiet.
import { useOwnerAlerts as ownerAlerts } from "@/components/organisms/owner/useOwnerAlerts";
import { seed } from "@/lib/store";
import {
  closed,
  confirm,
  dispatch,
  invoice,
  packingList,
  purchase,
  ready,
  request,
  returned,
  setup,
  smoked,
  smokeOrder,
} from "./fixtures";

test("an empty database only asks for material settings", () => {
  const alerts = ownerAlerts(structuredClone(seed));
  expect(alerts.missingMaterialSettings).toBe(7);
  expect(alerts.notifications).toEqual([
    {
      title: "ตั้งค่าวัสดุยังไม่ครบ 7 รายการ",
      detail: expect.any(String),
      tab: "config",
    },
  ]);
});

test("a purchase PO waits on Foodiva's invoice, a shipment on its next document", () => {
  const s = setup();
  const alerts = () => ownerAlerts(s.db);
  const first = () => alerts().notifications[0];
  purchase(s, "50");
  expect(first()).toMatchObject({
    title: "รอ Foodiva ออก Invoice · F260909-001",
    tab: "po",
  });
  expect(alerts().badges.transport).toBe(0); // a purchase PO is never a truck job
  confirm(s, "50");
  request(s, [["F260909-001", "50"]]);
  expect(first()).toMatchObject({
    title: "รอ Foodiva ทำใบขนส่ง · SH-2026-0001",
    tab: "transport",
  });
  expect(alerts().badges.transport).toBe(1);
  dispatch(s);
  expect(first()).toMatchObject({
    title: "รอ Foodiva ทำ Packing List · SH-2026-0001",
    tab: "smoke-po",
  });
  expect(alerts().badges["smoke-po"]).toBe(0);
  packingList(s, "25\n24.5");
  expect(first()).toEqual({
    title: "Packing List พร้อมแล้ว · SH-2026-0001",
    detail: "ออก PO รมควัน · 2 กล่องรับเข้า · 49.50 กก.",
    tab: "smoke-po",
  });
  expect(alerts().badges["smoke-po"]).toBe(1);
  smokeOrder(s);
  expect(first().title).toBe(
    "รอ Chef House ยืนยัน PO โรงรมควัน · SH-2026-0001",
  );
  expect(alerts().badges["smoke-po"]).toBe(0);
  s.run("cm", "smokeOrderAccept", { acceptedBy: "Chef House" });
  // Chef House is working: only the unpaid meat invoice still waits on the owner
  expect(alerts().notifications.map((n) => n.title)).toEqual([
    "รอชำระ Invoice เนื้อ · PO-2026-0001",
  ]);
});

test("a closed run waits on the smoking invoice, then its review", () => {
  const s = closed();
  const titles = () =>
    ownerAlerts(s.db).notifications.map((item) => item.title);
  expect(titles()).toContain(
    "รอ Chef House Submit Invoice ค่ารมควัน · SH-2026-0001",
  );
  invoice(s);
  expect(titles()).toContain("รอตรวจ Invoice ค่ารมควัน · CH-1");
  expect(ownerAlerts(s.db).badges.invoices).toBe(1);
});

test("after smoking the owner is sent to transport, central receive and allocation", () => {
  const closed = smoked();
  closed.run("cm", "closeLot", { confirm: "สมชาย" });
  const afterClose = ownerAlerts(closed.db);
  expect(afterClose.returnReady).toHaveLength(1);
  expect(afterClose.notifications).toContainEqual({
    title: "Chef House ปิด Lot แล้ว · S260909-001",
    detail: "เรียกรถขากลับ 36.00 กก. · 360 กล่องรมควัน",
    tab: "transport",
  });
  expect(ownerAlerts(returned().db).badges["central-receive"]).toBe(1);
  const stocked = ownerAlerts(ready().db);
  expect(stocked.badges["branch-status"]).toBe(1);
  expect(stocked.notifications.map((item) => item.title)).toContain(
    "มีเนื้อพร้อมจัดสรร 1 Lot",
  );
});

test("an unpaid Foodiva meat invoice asks the Owner to pay it until meatPayment is saved", () => {
  const s = setup();
  purchase(s, "40");
  const po = s.db.lots[0];
  const meatAlert = () =>
    ownerAlerts(s.db).notifications.find((item) =>
      item.title.startsWith("รอชำระ Invoice เนื้อ"),
    );
  expect(meatAlert()).toBeUndefined();
  confirm(s, "40");
  expect(meatAlert()).toMatchObject({
    title: `รอชำระ Invoice เนื้อ · ${po.poId}`,
    tab: "invoices",
  });
  s.run(
    "owner",
    "meatPayment",
    {
      paymentDate: "2026-09-09",
      paidBy: "Owner",
      paidAmount: "1",
      slips: "[]",
    },
    po.id,
  );
  expect(meatAlert()).toBeUndefined();
});
