import { expect, test } from "vitest";
import { prefillValues } from "@/lib/prefill";
import { entries, poRemainingKg, seed } from "@/lib/store";
import {
  closed,
  confirm,
  day,
  dispatch,
  invoice,
  last,
  packingList,
  purchase,
  readyToDispatch,
  request,
  send,
  setup,
  smoked,
} from "./fixtures";

test("purchase starts from the company settings", () => {
  const db = structuredClone(seed);
  db.config.companyPhone = "021234567";
  expect(prefillValues(db, "purchase")).toEqual({
    customerName: "บริษัท เนิร์ดเนื้อ จำกัด",
    customerAddress: "",
    attention: "",
    phone: "021234567",
    taxId: "",
    productName: "เนื้อวัว",
  });
});

test("lot forms without a lot, and forms with nothing to carry over, start empty", () => {
  expect(prefillValues(seed, "dispatch")).toEqual({});
  const s = setup();
  purchase(s, "40");
  expect(prefillValues(s.db, "sale", s.db.lots[0])).toEqual({});
});

test("Foodiva's confirmation starts from the full PO weight and amount", () => {
  const s = setup();
  purchase(s, "40");
  expect(prefillValues(s.db, "foodivaConfirm", s.db.lots[0])).toEqual({
    confirmedKg: "40",
    readyForChiangMaiKg: "40",
    reservedForOwnerKg: "0",
    invoiceAmount: "10000",
  });
});

test("prefilled weights and amounts pass mutate as-is; receiving weights stay blank", () => {
  const s = setup();
  const prefill = (kind: string) => prefillValues(s.db, kind, s.db.lots.at(-1));
  purchase(s, "40");
  s.run("foodiva", "foodivaConfirm", {
    ...prefill("foodivaConfirm"),
    invoiceNo: "INV-1",
    invoiceDate: day,
    attachment: "inv.pdf",
    confirmedBy: "Foodiva",
  });
  request(s, [[s.db.lots[0].id, "40"]]);
  s.run("foodiva", "dispatch", {
    ...prefill("dispatch"),
    pickupDate: day,
    pickupTime: "06:30",
    trip: "ไปกลับ",
    plate: "กข123",
    driverName: "คนขับ",
  });
  expect(last(s).values.dispatchKg).toBe("40");
  packingList(s, "20\n20");
  s.run("owner", "smokeOrder", {
    ...prefill("smokeOrder"),
    requestedSmokeDate: day,
  });
  expect(last(s).values.rawKg).toBe("40");
  expect(prefill("return").plate).toBe("กข123");
  expect(prefill("cmReceive")).toEqual({});

  const done = closed();
  invoice(done);
  done.run("owner", "invoiceReview", {
    decision: "รับยอด",
    reviewedBy: "Owner",
  });
  done.run("owner", "invoicePayment", {
    ...prefillValues(done.db, "invoicePayment", done.db.lots.at(-1)),
    paymentDate: day,
    paidBy: "Owner",
  });
});

test("a one-way trip does not copy the outbound truck into the return form", () => {
  const s = setup();
  readyToDispatch(s, "40");
  s.run("foodiva", "dispatch", {
    ...send,
    trip: "เที่ยวเดียว",
    plate: "กข123",
  });
  expect(prefillValues(s.db, "return", s.db.lots.at(-1))).toEqual({
    returnKg: "0",
    origin: "เชียงใหม่",
    destination: "กรุงเทพฯ",
  });
});

test("the smoke PO takes its quantity from the Packing List, not the form; Foodiva's return receipt starts from earlier weights", () => {
  const s = setup();
  for (const kg of ["300", "700", "500"]) {
    purchase(s, kg);
    confirm(s, kg);
  }
  const [a, b, c] = s.db.lots.map((lot) => lot.id);
  request(s, [
    [a, "300"],
    [b, "600"],
    [c, "500"],
  ]);
  dispatch(s);
  packingList(s, "700\n690");
  const prefill = prefillValues(s.db, "smokeOrder", s.db.lots.at(-1));
  expect(prefill).toEqual({ smoker: "Chef House" });
  // 3 purchase POs, 1 smoke PO for the Packing List total (not the 1,400 kg requested).
  s.run("owner", "smokeOrder", {
    ...prefill,
    requestedSmokeDate: day,
    rawKg: "9999",
  });
  expect(last(s).values.rawKg).toBe("1390");
  expect(entries(s.db, "smokeOrder")).toHaveLength(1);
  expect(poRemainingKg(s.db, b)).toBe(100);
  const done = smoked();
  expect(
    prefillValues(done.db, "foodivaReturnReceive", done.db.lots.at(-1)),
  ).toEqual({ receivedBags: "360" });
});

test("BUG-J: editing Foodiva's invoice starts from the saved one, and saving it unchanged keeps the split", () => {
  const s = setup();
  purchase(s, "30");
  s.run("foodiva", "foodivaConfirm", {
    invoiceNo: "QA7-INV-005",
    invoiceDate: "2026-09-01",
    confirmedKg: "30",
    readyForChiangMaiKg: "28",
    reservedForOwnerKg: "2",
    invoiceAmount: "7500",
    attachment: "inv.pdf",
    attachmentStorageKey: "key-1",
    confirmedBy: "QA7 Foodiva",
  });
  const edit = prefillValues(s.db, "foodivaConfirm", s.db.lots[0]);
  expect(edit).toMatchObject({
    invoiceNo: "QA7-INV-005",
    invoiceDate: "2026-09-01",
    readyForChiangMaiKg: "28",
    reservedForOwnerKg: "2",
    attachment: "inv.pdf",
    attachmentStorageKey: "key-1",
    confirmedBy: "QA7 Foodiva",
  });
  s.run("foodiva", "foodivaConfirm", edit);
  expect(last(s).values).toMatchObject({
    readyForChiangMaiKg: "28",
    reservedForOwnerKg: "2",
    attachmentStorageKey: "key-1",
  });
});

test("BUG-I: the smoking invoice form carries the smoke PO quantity for its preview", () => {
  const s = setup();
  purchase(s, "30");
  confirm(s, "30", "28");
  request(s, [[s.db.lots[0].id, "28"]]);
  dispatch(s);
  packingList(s, "28");
  s.run("owner", "smokeOrder", {
    ...prefillValues(s.db, "smokeOrder", s.db.lots.at(-1)),
    requestedSmokeDate: day,
  });
  expect(prefillValues(s.db, "smokingInvoice", s.db.lots.at(-1))).toEqual({
    serviceQuantity: "28",
  });
});
