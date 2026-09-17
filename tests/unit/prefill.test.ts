import { expect, test } from "vitest";
import { prefillValues } from "@/lib/prefill";
import { seed } from "@/lib/store";
import {
  confirm,
  day,
  last,
  purchase,
  readyToDispatch,
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
  const prefill = (kind: string) => prefillValues(s.db, kind, s.db.lots[0]);
  purchase(s, "40");
  s.run("foodiva", "foodivaConfirm", {
    ...prefill("foodivaConfirm"),
    invoiceNo: "INV-1",
    invoiceDate: day,
    attachment: "inv.pdf",
    confirmedBy: "Foodiva",
  });
  s.run("owner", "smokeOrder", {
    ...prefill("smokeOrder"),
    requestedSmokeDate: day,
  });
  s.run("cm", "smokeOrderAccept", { acceptedBy: "Chef_house" });
  s.run("cm", "smokingInvoice", {
    invoiceNumber: "CH-1",
    invoiceDate: day,
    attachment: "ch.pdf",
  });
  s.run("owner", "invoiceReview", { decision: "รับยอด", reviewedBy: "Owner" });
  s.run("owner", "invoicePayment", {
    ...prefill("invoicePayment"),
    paymentDate: day,
    paidBy: "Owner",
  });
  s.run("owner", "dispatch", {
    ...prefill("dispatch"),
    pickupDate: day,
    trip: "ไปกลับ",
    plate: "กข123",
    driverName: "คนขับ",
  });
  expect(last(s).values.dispatchKg).toBe("40");
  expect(prefill("return").plate).toBe("กข123");
  expect(prefill("cmReceive")).toEqual({});
});

test("a one-way trip does not copy the outbound truck into the return form", () => {
  const s = setup();
  readyToDispatch(s, "40");
  s.run("owner", "dispatch", {
    ...send,
    trip: "เที่ยวเดียว",
    dispatchKg: "40",
    plate: "กข123",
  });
  expect(prefillValues(s.db, "return", s.db.lots[0])).toEqual({
    returnKg: "0",
    origin: "เชียงใหม่",
    destination: "กรุงเทพฯ",
  });
});

test("smoke PO and Foodiva's return receipt start from earlier weights", () => {
  const s = setup();
  purchase(s, "40");
  confirm(s, "40", "30");
  expect(prefillValues(s.db, "smokeOrder", s.db.lots[0])).toEqual({
    smoker: "Chef_house",
    rawKg: "30",
  });
  const done = smoked();
  expect(
    prefillValues(done.db, "foodivaReturnReceive", done.db.lots[0]),
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
  s.run("owner", "smokeOrder", {
    ...prefillValues(s.db, "smokeOrder", s.db.lots[0]),
    requestedSmokeDate: day,
  });
  expect(prefillValues(s.db, "smokingInvoice", s.db.lots[0])).toEqual({
    serviceQuantity: "28",
  });
});
