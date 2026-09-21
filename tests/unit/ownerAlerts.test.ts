import { expect, test } from "vitest";
// Aliased: it is a plain function despite the name, and the alias keeps the hooks lint rule quiet.
import { useOwnerAlerts as ownerAlerts } from "@/components/organisms/owner/useOwnerAlerts";
import { seed } from "@/lib/store";
import {
  confirm,
  purchase,
  ready,
  returned,
  setup,
  smoked,
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

test("a lot's notification follows its next missing document", () => {
  const s = setup();
  const alerts = () => ownerAlerts(s.db);
  const first = () => alerts().notifications[0];
  purchase(s, "40");
  expect(first()).toMatchObject({
    title: "รอ Foodiva ออก Invoice · F260909-001",
    tab: "po",
  });
  expect(alerts().badges.transport).toBe(1);
  confirm(s, "40");
  expect(first().tab).toBe("smoke-po");
  expect(alerts().badges["smoke-po"]).toBe(1);
  // ponytail: the smoke PO → invoice → transport steps moved onto the shipment; P4 rewrites these alerts.
});

test("after smoking the owner is sent to transport, central receive and allocation", () => {
  const closed = smoked();
  closed.run("cm", "closeLot", { confirm: "สมชาย" });
  const afterClose = ownerAlerts(closed.db);
  expect(afterClose.returnReady).toHaveLength(1);
  expect(afterClose.notifications).toContainEqual({
    title: "Chef House ปิด Lot แล้ว · S260909-001",
    detail: "เรียกรถขากลับ 36.00 กก. · 360 ถุง",
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
    { paymentDate: "2026-09-09", paidBy: "Owner", paidAmount: "1", slips: "[]" },
    po.id,
  );
  expect(meatAlert()).toBeUndefined();
});
