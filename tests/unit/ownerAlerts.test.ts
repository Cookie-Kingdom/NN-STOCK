import { afterEach, beforeEach, expect, test, vi } from "vitest";
// Aliased: it is a plain function despite the name, and the alias keeps the hooks lint rule quiet.
import { useOwnerAlerts as ownerAlerts } from "@/components/organisms/owner/useOwnerAlerts";
import { materials, seed } from "@/lib/store";
import {
  closed,
  confirm,
  day,
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

// DASH-02 counts its 30 days back from today (Bangkok): pin the clock near the fixture day.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${day}T12:00:00+07:00`));
});
afterEach(() => {
  vi.useRealTimers();
});

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
    title: "ยังไม่ได้จด Invoice เนื้อ · F260909-001",
    tab: "foodiva",
  });
  expect(alerts().badges.foodiva).toBe(1);
  // The transport badge counts batches with work but no ใบขนส่ง (B4); a purchase PO is none.
  expect(alerts().badges.transport).toBe(0);

  confirm(s, "50");
  // Foodiva opens the batch before the Owner's smoke PO (D2): the batch lists what it
  // has no entry for (DASH-02) and opens a tab one of them is recorded on.
  dispatch(s, "");
  expect(first()).toEqual({
    title: "ชุด SH-2026-0001 ยังไม่ได้จด 11 รายการ",
    detail:
      "ยังไม่ได้จด: PO รมควัน, Packing List, ชั่งรับ, ก่อนสโมค และอีก 7 รายการ",
    tab: "smoke-po",
  });
  expect(alerts().badges["smoke-po"]).toBe(1);
  packingList(s, "25\n24.5");
  expect(first().title).toBe("ชุด SH-2026-0001 ยังไม่ได้จด 10 รายการ");
  expect(alerts().badges["cm-receive"]).toBe(1);
  smokeOrder(s, [["F260909-001", "50"]]);
  // Every record opens the tab it is written on, the partners' ones included.
  expect(first()).toMatchObject({
    title: "ชุด SH-2026-0001 ยังไม่ได้จด 9 รายการ",
    tab: "cm-receive",
  });
  expect(alerts().badges["smoke-po"]).toBe(0);
  // Q1: Chef accepting the PO is still recordable but is not on the "ยังไม่ได้จด" list.
  s.run("owner", "smokeOrderAccept", { acceptedBy: "Chef House" });
  expect(alerts().notifications.map((n) => n.title)).toEqual([
    "ชุด SH-2026-0001 ยังไม่ได้จด 9 รายการ",
    "รอชำระ Invoice เนื้อ · PO-2026-0001",
  ]);
});

test("a closed run lacks the smoking invoice, then waits on its review", () => {
  const s = closed();
  const titles = () =>
    ownerAlerts(s.db).notifications.map((item) => item.title);
  expect(ownerAlerts(s.db).notifications).toContainEqual(
    expect.objectContaining({
      title: expect.stringMatching(/^ชุด SH-2026-0001 ยังไม่ได้จด/),
      detail: expect.stringContaining("Invoice ค่ารม"),
    }),
  );
  expect(ownerAlerts(s.db).badges.work).toBe(1); // bill the smoking for Chef House
  invoice(s);
  expect(ownerAlerts(s.db).badges.work).toBe(0);
  expect(titles()).toContain("รอตรวจ Invoice ค่ารมควัน · CH-1");
  // the badge counts the unpaid meat invoice too, same as the bell
  expect(ownerAlerts(s.db).badges.invoices).toBe(2);
});

test("after smoking the owner is sent to transport and central receive, not allocation", () => {
  const closed = smoked();
  closed.run("owner", "closeLot", { confirm: "สมชาย" });
  const afterClose = ownerAlerts(closed.db);
  expect(afterClose.returnReady).toHaveLength(1);
  expect(afterClose.notifications).toContainEqual({
    title: "Chef House ปิด Lot แล้ว · SH-2026-0001",
    detail: "ยังไม่ได้จดรถขากลับ · 36.00 กก. · 360 กล่องรมควัน",
    tab: "return-shipment",
  });
  expect(ownerAlerts(returned().db).badges["central-receive"]).toBe(1);
  const stocked = ownerAlerts(ready().db);
  // Branches allocate for themselves now: no allocation badge or bell for the Owner.
  expect("branch-status" in stocked.badges).toBe(false);
  expect(stocked.notifications.map((item) => item.title)).not.toContain(
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
