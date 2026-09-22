import { expect, test } from "vitest";
import { currentTimeSlot } from "@/lib/forms";
import {
  carryLast,
  lastLabel,
  lastValue,
  lastValues,
  nextDocNumber,
  prefillValues as prefillWithSources,
} from "@/lib/prefill";
import {
  entries,
  materials,
  poRemainingKg,
  riceSources,
  seed,
} from "@/lib/store";
import {
  closed,
  confirm,
  day,
  dispatch,
  invoice,
  last,
  chillDay,
  packingList,
  packs,
  purchase,
  readyToDispatch,
  received,
  request,
  returned,
  send,
  setup,
  smoked,
} from "./fixtures";

/** 08:10 in Bangkok. */
const morning = new Date("2026-09-21T01:10:00Z");

const prefillValues = (...args: Parameters<typeof prefillWithSources>) =>
  prefillWithSources(...args).values;

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

test("prefilled weights and amounts pass mutate as-is", () => {
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
  expect(
    prefillValues(s.db, "return", s.db.lots.at(-1), { now: morning }),
  ).toEqual({
    returnTime: "08:30",
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
  // 3 purchase POs, 1 smoke PO pre-filled with the Packing List total (not the 1,400 kg requested).
  expect(prefill).toEqual({ smoker: "Chef House", rawKg: "1390" });
  s.run("owner", "smokeOrder", { ...prefill, requestedSmokeDate: day });
  expect(last(s).values.rawKg).toBe("1390");
  expect(entries(s.db, "smokeOrder")).toHaveLength(1);
  expect(poRemainingKg(s.db, b)).toBe(100);
  const done = smoked();
  expect(
    prefillValues(done.db, "foodivaReturnReceive", done.db.lots.at(-1), {
      now: morning,
    }),
  ).toEqual({ receivedBags: "360", receivedTime: "08:00" });
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
    netPayable: String(28 * 220),
  });
});

test("the meat payment starts from Foodiva's invoice amount", () => {
  const s = setup();
  purchase(s, "40");
  confirm(s, "40");
  expect(prefillValues(s.db, "meatPayment", s.db.lots[0])).toEqual({
    paidAmount: "1",
  });
});

test("every prefilled value says where it came from; predicted readings are marked expected", () => {
  const s = setup();
  purchase(s, "40");
  const { values, sources } = prefillWithSources(
    s.db,
    "foodivaConfirm",
    s.db.lots[0],
  );
  expect(Object.keys(sources).sort()).toEqual(Object.keys(values).sort());
  expect(sources.confirmedKg).toMatchObject({ expected: true });
  expect(sources.invoiceAmount.expected).toBeFalsy();
  expect(sources.invoiceAmount.label).toMatch(/^จาก /);
  const done = smoked();
  expect(
    prefillWithSources(done.db, "foodivaReturnReceive", done.db.lots.at(-1))
      .sources.receivedBags,
  ).toEqual({ label: "ตามยอดส่ง", expected: true });
});

test("a blank prefill value carries no caption", () => {
  const { sources } = prefillWithSources(structuredClone(seed), "purchase");
  expect(sources.customerAddress).toBeUndefined();
  expect(sources.productName).toEqual({ label: "ค่าเริ่มต้น" });
});

test("lastValues / lastValue read the most recent matching entry", () => {
  const s = setup();
  purchase(s, "40");
  purchase(s, "50");
  const [a, b] = s.db.lots.map((lot) => lot.id);
  s.run(
    "foodiva",
    "foodivaConfirm",
    {
      ...prefillValues(s.db, "foodivaConfirm", s.db.lots[0]),
      invoiceNo: "INV-0012",
      invoiceDate: day,
      attachment: "inv.pdf",
      attachmentStorageKey: "key-1",
      confirmedBy: "สมชาย",
    },
    a,
  );
  s.run(
    "foodiva",
    "foodivaConfirm",
    {
      ...prefillValues(s.db, "foodivaConfirm", s.db.lots[1]),
      invoiceNo: "INV-0013",
      invoiceDate: day,
      attachment: "inv.pdf",
      confirmedBy: "สมหญิง",
    },
    b,
  );
  expect(lastValues(s.db, "foodivaConfirm")?.values.invoiceNo).toBe("INV-0013");
  expect(
    lastValues(s.db, "foodivaConfirm", { lotId: a })?.values.invoiceNo,
  ).toBe("INV-0012");
  expect(
    lastValues(s.db, "foodivaConfirm", {
      where: (e) => e.values.invoiceNo === "INV-0012",
    })?.date,
  ).toBe(last(s).date);
  expect(lastValues(s.db, "sale")).toBeUndefined();
  // An entry without the value is skipped for the one before it.
  expect(lastValue(s.db, "foodivaConfirm", "attachmentStorageKey")?.value).toBe(
    "key-1",
  );
  expect(carryLast(s.db, "foodivaConfirm", ["confirmedBy", "nope"])).toEqual({
    values: { confirmedBy: "สมหญิง" },
    sources: { confirmedBy: { label: lastLabel(last(s).date) } },
  });
});

test("lastLabel reads dd/MM", () => {
  expect(lastLabel("2026-09-18")).toBe("ล่าสุด 18/09");
});

test("nextDocNumber increments the trailing digits and keeps the padding", () => {
  expect(nextDocNumber("INV-0012")).toBe("INV-0013");
  expect(nextDocNumber("A9")).toBe("A10");
  expect(nextDocNumber("099")).toBe("100");
  expect(nextDocNumber("QA7-INV-005")).toBe("QA7-INV-006");
  expect(nextDocNumber("INV-12A")).toBe("INV-13A");
  expect(nextDocNumber("INV")).toBeUndefined();
  expect(nextDocNumber(undefined)).toBeUndefined();
  expect(nextDocNumber("")).toBeUndefined();
});

test.each([
  ["2026-09-21T01:10:00Z", "08:00"],
  ["2026-09-21T01:30:00Z", "08:30"],
  ["2026-09-21T00:00:00Z", "07:00"],
  ["2026-09-21T16:59:00Z", "23:30"],
  ["2026-09-21T17:00:00Z", "00:00"],
])("currentTimeSlot %s → %s", (now, slot) => {
  expect(currentTimeSlot(new Date(now))).toBe(slot);
});

test("owner forms carry the last PO, names and truck, and predict weights", () => {
  const s = setup();
  purchase(s, "40", "260");
  const po = prefillWithSources(s.db, "purchase");
  expect(po.values).toMatchObject({
    packSize: "6 ชิ้นต่อกล่อง",
    productName: "เนื้อวัว",
    orderedKg: "40",
    price: "260",
  });
  expect(po.sources.price).toEqual({ label: `จาก ${s.db.lots[0].poId}` });
  expect(po.values.reference).toBeUndefined();

  // Smoke PO: finish date keeps the last PO's lead time; the instruction carries.
  const t = setup();
  readyToDispatch(t, "40");
  dispatch(t);
  packingList(t, "20\n20");
  t.run("owner", "smokeOrder", {
    smoker: "Chef House",
    requestedSmokeDate: day,
    expectedFinishedDate: "2026-09-12",
    instruction: "รมอ่อน",
  });
  const order = prefillWithSources(t.db, "smokeOrder", t.db.lots.at(-1), {
    date: "2026-09-20",
  });
  expect(order.values).toMatchObject({
    expectedFinishedDate: "2026-09-23",
    instruction: "รมอ่อน",
  });
  expect(order.sources.expectedFinishedDate.label).toMatch(/3 วัน/);

  // Review and payment names carry; the meat payment falls back to the smoking one.
  const c = closed();
  invoice(c);
  c.run("owner", "invoiceReview", { decision: "รับยอด", reviewedBy: "คุณเอ" });
  const lot = c.db.lots.at(-1);
  expect(prefillValues(c.db, "invoiceReview", lot).reviewedBy).toBe("คุณเอ");
  c.run("owner", "invoicePayment", {
    ...prefillValues(c.db, "invoicePayment", lot),
    paymentDate: day,
    paidBy: "คุณบี",
  });
  expect(prefillValues(c.db, "invoicePayment", lot).paidBy).toBe("คุณบี");
  expect(prefillValues(c.db, "meatPayment", c.db.lots[0]).paidBy).toBe("คุณบี");

  // Central count and the Owner's pick-up start from what is expected, strongly marked.
  const r = returned();
  const central = prefillWithSources(r.db, "central", r.db.lots.at(-1));
  expect(central.values).toEqual({ centralKg: "36" });
  expect(central.sources.centralKg.expected).toBe(true);
  const w = setup();
  purchase(w, "100");
  confirm(w, "100", "90");
  w.run("owner", "ownerWasteReceive", {
    receivedDate: day,
    receivedKg: "4",
    receiver: "Owner",
  });
  const waste = prefillWithSources(w.db, "ownerWasteReceive", w.db.lots[0]);
  expect(waste.values).toEqual({ receivedKg: "6", receiver: "Owner" });
  expect(waste.sources.receivedKg.expected).toBe(true);
  expect(waste.sources.receiver.expected).toBeFalsy();
});

test("a one-way return carries the last return truck and picks the next time slot", () => {
  const s = returned();
  readyToDispatch(s, "40");
  s.run("foodiva", "dispatch", {
    ...send,
    trip: "เที่ยวเดียว",
    plate: "ขค999",
  });
  expect(
    prefillValues(s.db, "return", s.db.lots.at(-1), { now: morning }),
  ).toMatchObject({
    returnTime: "08:30",
    vehicleType: "รถห้องเย็น",
    plate: "กข123",
    driverName: "คนขับ",
    driverPhone: "0800000000",
  });
});

test("chili allocation tops the branch up to par from the Owner's stock; expenses carry by category", () => {
  const s = setup();
  s.run("owner", "generalPurchase", {
    purchaseDate: day,
    item: "น้ำพริกหลอด",
    purchaseCategory: "วัตถุดิบ",
    quantity: "150",
    unitPrice: "20",
    supplier: "ร้านน้ำพริก",
  });
  s.run("owner", "chiliAllocate", {
    branch: "ศาลาแดง",
    chiliTubes: "30",
    receiver: "พี่เอ",
  });
  expect(prefillValues(s.db, "chiliAllocate")).toEqual({
    chiliTubes: "70",
    receiver: "พี่เอ",
  });
  // มีนบุรี is 100 short, the Owner holds 120: the whole 100, and no one to carry.
  expect(
    prefillValues(s.db, "chiliAllocate", undefined, {
      values: { branch: "มีนบุรี" },
    }),
  ).toEqual({ chiliTubes: "100" });

  s.run("owner", "expense", {
    category: "ค่าเช่า",
    amount: "15000",
    payer: "Owner",
    detail: "ค่าเช่าเดือนนี้",
  });
  s.run("owner", "expense", {
    category: "ค่าสาธารณูปโภค",
    amount: "2000",
    payer: "คุณบี",
    detail: "ค่าไฟ",
  });
  expect(prefillValues(s.db, "expense")).toEqual({
    category: "ค่าสาธารณูปโภค",
    payer: "คุณบี",
    amount: "2000",
  });
  expect(
    prefillValues(s.db, "expense", undefined, {
      values: { category: "ค่าเช่า" },
    }).amount,
  ).toBe("15000");
});

test("Foodiva's next invoice number follows the last one; its return receipt starts from the return truck", () => {
  const s = setup();
  purchase(s, "40");
  confirm(s, "40");
  purchase(s, "50");
  const next = prefillWithSources(s.db, "foodivaConfirm", s.db.lots[1]);
  expect(next.values).toMatchObject({
    invoiceNo: "INV-2",
    confirmedBy: "Foodiva",
  });
  expect(next.sources.invoiceNo.label).toBe("ต่อจาก INV-1");

  const c = closed();
  c.run("owner", "return", {
    returnDate: day,
    returnTime: "09:00",
    origin: "Chef House",
    destination: "Foodiva",
    vehicleType: "รถห้องเย็น",
    plate: "กข123",
    driverName: "คนขับ",
    driverPhone: "0800000000",
    returnKg: "35.8",
  });
  const receipt = prefillWithSources(
    c.db,
    "foodivaReturnReceive",
    c.db.lots.at(-1),
    { now: morning },
  );
  expect(receipt.values).toEqual({
    receivedBags: "360",
    receivedKg: "35.8",
    receivedTime: "08:00",
  });
  expect(receipt.sources.receivedKg.expected).toBe(true);
  expect(receipt.sources.receivedTime.expected).toBeFalsy();
});

test("Chef House forms carry names and start weights from the lot", () => {
  const s = setup();
  received(s, "50", "25\n25", "24.5\n24.5");
  const lot = () => s.db.lots.at(-1);
  expect(prefillValues(s.db, "smokeOrderAccept", lot())).toEqual({
    acceptedBy: "Chef House",
  });
  const prepare = prefillWithSources(s.db, "prepare", lot());
  expect(prepare.values).toEqual({ preSmokeKg: "49" });
  expect(prepare.sources.preSmokeKg).toEqual({
    label: "ตามยอดรับจริง",
    expected: true,
  });
  s.run("cm", "prepare", { preSmokeKg: "48" });
  s.run("cm", "smoke", {
    smokeDate: day,
    inputKg: "20",
    wasteKg: "5",
    packs: packs(150),
  });
  const smoke = prefillWithSources(s.db, "smoke", lot());
  expect(smoke.values).toEqual({ inputKg: "28" });
  expect(smoke.sources.inputKg.expected).toBe(true);

  const c = closed();
  expect(prefillValues(c.db, "closeLot", c.db.lots.at(-1))).toEqual({
    confirm: "สมชาย",
  });
  // A new bill numbers on from the last one on any lot.
  const other = {
    ...c.db.entries.at(-1)!,
    id: "earlier-invoice",
    kind: "smokingInvoice",
    lotId: "another-lot",
    values: { invoiceNumber: "CH-0009" },
  };
  const withEarlier = { ...c.db, entries: [...c.db.entries, other] };
  expect(
    prefillValues(withEarlier, "smokingInvoice", c.db.lots.at(-1))
      .invoiceNumber,
  ).toBe("CH-0010");
  // A bill the Owner sent back comes back with its own number and detail.
  c.run("cm", "smokingInvoice", {
    invoiceNumber: "CH-1",
    invoiceDate: day,
    attachment: "ch.pdf",
    invoiceDetail: "ค่ารม 50 กก.",
  });
  c.run("owner", "invoiceReview", {
    decision: "ส่งกลับแก้ไข",
    reviewedBy: "Owner",
  });
  const again = prefillWithSources(c.db, "smokingInvoice", c.db.lots.at(-1));
  expect(again.values).toMatchObject({
    invoiceNumber: "CH-1",
    invoiceDetail: "ค่ารม 50 กก.",
  });
  expect(again.sources.invoiceNumber.label).toBe("จากใบที่ส่งกลับ");
});

test("branch meat forms: one open allocation is picked, thaw repeats the last one within frozen stock, sale kg follows the packs", () => {
  const s = chillDay();
  const branch = "ศาลาแดง";
  const lot = () => s.db.lots.at(-1);
  s.run("owner", "allocate", { branch, kg: "2", deliveryDate: day });
  const allocation = last(s).id;
  const receive = prefillWithSources(s.db, "receive", lot(), { branch });
  expect(receive.values).toEqual({ allocation, kg: "2" });
  expect(receive.sources.kg.expected).toBe(true);
  // Only the acting branch's allocations count.
  expect(prefillValues(s.db, "receive", lot(), { branch: "มีนบุรี" })).toEqual(
    {},
  );
  s.run("branch", "receive", { kg: "2", allocation });

  // Last thaw was 70 kg; only 2 kg is frozen now.
  const thaw = prefillWithSources(s.db, "thaw", lot(), { branch });
  expect(thaw.values).toEqual({ kg: "2" });
  expect(thaw.sources.kg.expected).toBe(true);
  expect(thaw.sources.kg.label).toMatch(/เท่าที่มีแช่แข็ง/);

  const sale = (values = {}) =>
    prefillWithSources(s.db, "sale", lot(), { branch, values });
  expect(sale().values).toEqual({});
  expect(sale({ boxes: "3", addons: "2" }).values).toEqual({ soldKg: "0.51" });
  expect(sale({ boxes: "3" }).sources.soldKg).toEqual({
    label: "ตามจำนวนซีล",
    expected: true,
  });
  s.run("branch", "sale", {
    boxes: "0",
    addons: "10",
    chiliAddons: "0",
    soldKg: "1.015",
    wasteKg: "0",
    riceWasteKg: "0",
    expense: "50",
    payer: "พี่ซี",
    lineMan: "3200",
  });
  // LINE MAN and the chili count stay blank: they are the day's own check.
  expect(sale().values).toEqual({ payer: "พี่ซี" });
  s.run("branch", "influencerBox", {
    influencer: "ช่องเอ",
    boxes: "0",
    addons: "1",
    chiliAddons: "0",
    soldKg: "0.1",
    shippingFee: "60",
  });
  expect(
    prefillValues(s.db, "influencerBox", lot(), {
      branch,
      values: { addons: "2" },
    }),
  ).toEqual({ influencer: "ช่องเอ", shippingFee: "60", soldKg: "0.2" });
});

test("branch rice forms carry the branch's last choice and fill up to par or from stock", () => {
  const branch = "ศาลาแดง";
  const s = setup(branch);
  s.run("branch", "ricePurchase", {
    riceSource: riceSources[0],
    supplier: "ร้านข้าว",
    rawRiceKg: "15",
    rawRiceCost: "825",
  });
  const bought = prefillWithSources(s.db, "ricePurchase", undefined, {
    branch,
  });
  expect(bought.values).toEqual({
    riceSource: riceSources[0],
    supplier: "ร้านข้าว",
    rawRiceKg: "5",
    rawRiceCost: "275",
  });
  expect(bought.sources.rawRiceKg.expected).toBeFalsy();
  // The other branch has no history of its own: the first source, up to its par.
  expect(
    prefillValues(s.db, "ricePurchase", undefined, { branch: "มีนบุรี" }),
  ).toEqual({ rawRiceKg: "20", rawRiceCost: "1100" });
  // Switching the source: no supplier for it yet, cooked rice up to its par.
  expect(
    prefillValues(s.db, "ricePurchase", undefined, {
      branch,
      values: { riceSource: riceSources[1] },
    }),
  ).toEqual({
    riceSource: riceSources[0],
    cookedRiceKg: "30",
    cookedRiceCost: "1350",
  });
  // The cost follows a typed kg.
  expect(
    prefillValues(s.db, "ricePurchase", undefined, {
      branch,
      values: { riceSource: riceSources[0], rawRiceKg: "8" },
    }).rawRiceCost,
  ).toBe("440");

  s.run("branch", "riceIssue", { rawRiceIssuedKg: "10", receiver: "ครัว" });
  // 10 kg last time, 5 kg left in stock.
  expect(prefillValues(s.db, "riceIssue", undefined, { branch })).toEqual({
    rawRiceIssuedKg: "5",
    receiver: "ครัว",
  });

  const rice = (values?: Record<string, string>) =>
    prefillWithSources(s.db, "rice", undefined, { branch, values });
  expect(rice().values).toEqual({ rawUsedKg: "10" });
  expect(rice().sources.rawUsedKg.expected).toBe(true);
  s.run("branch", "rice", { rawUsedKg: "4", riceKg: "8" });
  expect(rice().values).toEqual({ rawUsedKg: "6", riceKg: "12" });
  expect(rice({ rawUsedKg: "5" }).values.riceKg).toBe("10");
  expect(rice().sources.riceKg.expected).toBe(true);

  const carry = prefillWithSources(s.db, "riceCarry", undefined, { branch });
  expect(carry.values).toEqual({ leftoverKg: "8" });
  expect(carry.sources.leftoverKg.expected).toBe(true);
});

test("the day's closer carries per branch", () => {
  const s = chillDay();
  s.run(
    "branch",
    "materials",
    Object.fromEntries(materials.map((_, i) => [`material${i}`, "10"])),
  );
  s.run("branch", "riceCarry", {
    leftoverKg: "0",
    reheat: "เก็บไว้อุ่นวันถัดไป",
  });
  s.run("branch", "closeDay", { confirm: "ผู้ดูแล" });
  expect(
    prefillValues(s.db, "closeDay", undefined, { branch: "ศาลาแดง" }),
  ).toEqual({ confirm: "ผู้ดูแล" });
  expect(
    prefillValues(s.db, "closeDay", undefined, { branch: "มีนบุรี" }),
  ).toEqual({});
});
