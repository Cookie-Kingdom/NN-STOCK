import { expect, test } from "vitest";
// Aliased: it is a plain function despite the name, and the alias keeps the hooks lint rule quiet.
import { useOwnerAlerts as ownerAlerts } from "@/components/organisms/owner/useOwnerAlerts";
import { seed } from "@/lib/store";
import {
  confirm,
  day,
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
  s.run("owner", "smokeOrder", {
    requestedSmokeDate: day,
    smoker: "Chef House",
    rawKg: "40",
  });
  expect(first().title).toMatch(/^รอ Chef House ยืนยัน PO/);
  s.run("cm", "smokeOrderAccept", { acceptedBy: "Chef House" });
  expect(first().title).toMatch(/^รอ Chef House Submit Invoice/);
  s.run("cm", "smokingInvoice", {
    invoiceNumber: "CH-1",
    invoiceDate: day,
    attachment: "ch.pdf",
  });
  expect(first()).toMatchObject({
    title: "รอตรวจ Invoice ค่ารมควัน · CH-1",
    tab: "invoices",
  });
  expect(alerts().badges.invoices).toBe(1);
  s.run("owner", "invoiceReview", { decision: "รับยอด", reviewedBy: "Owner" });
  expect(first().title).toMatch(/^รอชำระ/);
  s.run("owner", "invoicePayment", {
    paymentDate: day,
    paidBy: "Owner",
    paidAmount: "8800",
  });
  expect(first()).toMatchObject({
    title: "พร้อมทำใบขนส่งไป Chef House · F260909-001",
    tab: "transport",
  });
});

test("after smoking the owner is sent to transport, central receive and allocation", () => {
  const closed = smoked();
  closed.run("cm", "closeLot", { confirm: "สมชาย" });
  const afterClose = ownerAlerts(closed.db);
  expect(afterClose.returnReady).toHaveLength(1);
  expect(afterClose.notifications).toContainEqual({
    title: "Chef House ปิด Lot แล้ว · F260909-001",
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
