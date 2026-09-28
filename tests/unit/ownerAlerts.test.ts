import { expect, test } from "vitest";
// Aliased: it is a plain function despite the name, and the alias keeps the hooks lint rule quiet.
import { useOwnerAlerts as ownerAlerts } from "@/components/organisms/owner/useOwnerAlerts";
import { materials, seed } from "@/lib/store";
import {
  closed,
  confirm,
  dispatch,
  invoice,
  packingList,
  purchase,
  ready,
  returned,
  setup,
  smoked,
  smokeOrder,
} from "./fixtures";

test("an empty database only asks for material settings", () => {
  const alerts = ownerAlerts(structuredClone(seed));
  expect(alerts.missingMaterialSettings).toBe(materials.length);
  expect(alerts.notifications).toEqual([
    {
      title: `ตั้งค่าวัสดุยังไม่ครบ ${materials.length} รายการ`,
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
  // Foodiva opens the batch before the Owner's smoke PO (D2): the batch lists what it
  // lacks (DASH-02) and points at the Owner's first missing step.
  dispatch(s, "");
  expect(first()).toEqual({
    title: "ชุด SH-2026-0001 ยังขาด 12 ขั้น",
    detail:
      "ยังขาด: PO รมควัน, Packing List, Chef รับ PO, ชั่งรับ และอีก 8 ขั้น",
    tab: "smoke-po",
  });
  expect(alerts().badges["smoke-po"]).toBe(1);
  packingList(s, "25\n24.5");
  expect(first().title).toBe("ชุด SH-2026-0001 ยังขาด 11 ขั้น");
  smokeOrder(s, [["F260909-001", "50"]]);
  expect(first()).toMatchObject({
    title: "ชุด SH-2026-0001 ยังขาด 10 ขั้น",
    tab: "invoices",
  });
  expect(alerts().badges["smoke-po"]).toBe(0);
  s.run("cm", "smokeOrderAccept", { acceptedBy: "Chef House" });
  expect(alerts().notifications.map((n) => n.title)).toEqual([
    "ชุด SH-2026-0001 ยังขาด 9 ขั้น",
    "รอชำระ Invoice เนื้อ · PO-2026-0001",
  ]);
});

test("a closed run lacks the smoking invoice, then waits on its review", () => {
  const s = closed();
  const titles = () =>
    ownerAlerts(s.db).notifications.map((item) => item.title);
  expect(ownerAlerts(s.db).notifications).toContainEqual(
    expect.objectContaining({
      title: expect.stringMatching(/^ชุด SH-2026-0001 ยังขาด/),
      detail: expect.stringContaining("Invoice ค่ารม"),
    }),
  );
  invoice(s);
  expect(titles()).toContain("รอตรวจ Invoice ค่ารมควัน · CH-1");
  // the badge counts the unpaid meat invoice too, same as the bell
  expect(ownerAlerts(s.db).badges.invoices).toBe(2);
});

test("after smoking the owner is sent to transport, central receive and allocation", () => {
  const closed = smoked();
  closed.run("cm", "closeLot", { confirm: "สมชาย" });
  const afterClose = ownerAlerts(closed.db);
  expect(afterClose.returnReady).toHaveLength(1);
  expect(afterClose.notifications).toContainEqual({
    title: "Chef House ปิด Lot แล้ว · SH-2026-0001",
    detail: "เรียกรถขากลับ 36.00 กก. · 360 กล่องรมควัน",
    tab: "return-shipment",
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
