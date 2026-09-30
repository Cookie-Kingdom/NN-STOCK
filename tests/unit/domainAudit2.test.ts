import { expect, test } from "vitest";
import {
  centralStock,
  check,
  chiliStock,
  entries,
  mutate,
  ownerChiliStock,
  ownerPendingInvoices,
  seed,
  type Database,
  type EntryKind,
} from "@/lib/store";
import { day, purchaseInfo, ready, setup } from "./fixtures";

const edit = (targetId: string, values: Record<string, string>) => ({
  targetId,
  reason: "ชั่งผิด",
  values: JSON.stringify(values),
});

test("STK-03: central is edited and voided by the Owner, and the lot cache follows", () => {
  const s = ready();
  const lotId = s.db.lots.at(-1)!.id;
  const central = entries(s.db, "central", lotId)[0];
  s.run("owner", "entryEdit", edit(central.id, { centralKg: "30" }), lotId);
  expect(centralStock(s.db, lotId)).toBe(30);
  expect(s.db.lots.at(-1)!.values.centralKg).toBe("30");
  s.run("owner", "void", { targetId: central.id, reason: "ผิดชุด" }, lotId);
  expect(centralStock(s.db, lotId)).toBe(0);
  expect(s.db.lots.at(-1)!.values.centralKg).toBeUndefined();
  // Voided, the batch takes a fresh central again.
  s.run("owner", "central", { centralKg: "34" }, lotId);
  expect(centralStock(s.db, lotId)).toBe(34);
});

test.each<[EntryKind, RegExp]>([
  ["dispatch", /ใบขนส่งขาไปของชุดนี้แล้ว/],
  ["cmReceive", /ยืนยันรับเนื้อของชุดนี้แล้ว/],
  ["prepare", /น้ำหนักก่อนสโมคของชุดนี้แล้ว/],
  ["closeLot", /ปิด Lot นี้แล้ว/],
  ["return", /เรียกรถขากลับของชุดนี้แล้ว/],
  ["central", /รับเข้าสต๊อกกลางของชุดนี้แล้ว/],
])("GEN-06: a second %s on one batch is refused", (kind, message) => {
  const s = ready();
  expect(s.check("owner", kind).error).toMatch(message);
});

test("GEN-05: a purchase-PO entry warns only when dated before the PO was opened", () => {
  let db: Database = mutate(
    seed,
    "owner",
    "purchase",
    { ...purchaseInfo, orderedKg: "10", price: "250" },
    "",
    "2026-09-01",
  );
  const lotId = db.lots[0].id;
  db = mutate(
    db,
    "owner",
    "foodivaConfirm",
    {
      invoiceNo: "INV-1",
      invoiceDate: "2026-09-05",
      attachment: "inv.pdf",
      confirmedBy: "Foodiva",
      confirmedKg: "10",
      readyForChiangMaiKg: "10",
      reservedForOwnerKg: "0",
      invoiceAmount: "1",
    },
    lotId,
    "2026-09-05",
  );
  const pay = (date: string) =>
    check(() =>
      mutate(
        db,
        "owner",
        "meatPayment",
        { paymentDate: date, paidBy: "Owner", paidAmount: "1" },
        lotId,
        date,
      ),
    ).warnings.join("\n");
  // After the PO opened, before the invoice: fine.
  expect(pay("2026-09-03")).not.toMatch(/วันเปิด PO/);
  expect(pay("2026-08-30")).toMatch(/วันเปิด PO ของ Lot นี้ \(2026-09-01\)/);
});

test("RPT-11: the Foodiva invoice alert clears once the meat is paid", () => {
  const s = setup();
  s.run("owner", "purchase", { ...purchaseInfo, orderedKg: "10", price: "1" });
  s.run("owner", "foodivaConfirm", {
    invoiceNo: "INV-1",
    invoiceDate: day,
    attachment: "inv.pdf",
    confirmedBy: "Foodiva",
    confirmedKg: "10",
    readyForChiangMaiKg: "10",
    reservedForOwnerKg: "0",
    invoiceAmount: "1",
  });
  expect(ownerPendingInvoices(s.db).unpaidMeatLots).toHaveLength(1);
  s.run("owner", "meatPayment", {
    paymentDate: day,
    paidBy: "Owner",
    paidAmount: "1",
  });
  expect(ownerPendingInvoices(s.db).unpaidMeatLots).toHaveLength(0);
});

test("old branch chili purchases count at the branch only, not in the Owner's store", () => {
  const s = setup();
  const legacy: Database = {
    ...s.db,
    entries: [
      ...s.db.entries,
      {
        id: "legacy-chili",
        kind: "chiliPurchase",
        role: "branch",
        lotId: "",
        branch: "ศาลาแดง",
        date: day,
        at: `${day}T08:00:00.000Z`,
        values: { chiliTubes: "12", chiliCost: "240", supplier: "x" },
      },
    ],
  };
  expect(ownerChiliStock(legacy)).toBe(0);
  expect(chiliStock(legacy, "ศาลาแดง")).toBe(12);
});

test("retired branch kinds are refused as new entries; an old one can still be edited", () => {
  const s = setup();
  for (const kind of [
    "chiliPurchase",
    "chiliIssue",
    "supplyPurchase",
    "supplyIssue",
  ] as const)
    expect(s.check("branch", kind, {}, "").error).toBe(
      "รายการชนิดนี้เลิกใช้แล้ว",
    );
  const old: Database = {
    ...s.db,
    entries: [
      {
        id: "old-chili",
        kind: "chiliPurchase",
        role: "branch",
        lotId: "",
        branch: "ศาลาแดง",
        date: day,
        at: `${day}T08:00:00.000Z`,
        values: { chiliTubes: "12", chiliCost: "240", supplier: "x" },
      },
    ],
  };
  const next = mutate(
    old,
    "owner",
    "entryEdit",
    edit("old-chili", { chiliTubes: "10", chiliCost: "200" }),
    "",
    day,
  );
  expect(entries(next, "chiliPurchase")[0].values.chiliTubes).toBe("10");
  expect(next.entries.at(-1)!.kind).toBe("entryEdit");
});
