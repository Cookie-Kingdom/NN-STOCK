import { expect, test } from "vitest";
import {
  defaults,
  forms,
  standardIngredients,
  timeOptions,
  uploadedFiles,
} from "@/lib/forms";
import { materials, mutate, ownerMaterialStock, titles } from "@/lib/store";
import { last, ready, setup } from "./fixtures";

const day = "2026-09-09";

// QA round 2, BUG-2: what MaterialPurchaseForm.submit runs for 7 ticked lines.
test("a material purchase with every material ticked lands each one in Owner stock", () => {
  const s = setup();
  for (const material of materials)
    s.run("owner", "materialReceive", {
      purchaseDate: day,
      material,
      quantity: "500",
      unitPrice: "1",
      supplier: "ร้านวัสดุ QA",
      reference: "",
    });
  expect(s.db.entries.filter((e) => e.kind === "materialReceive")).toHaveLength(
    materials.length,
  );
  for (const material of materials)
    expect(ownerMaterialStock(s.db, material)).toBe(500);
  expect(last(s).values).toMatchObject({ totalCost: "500" });
});

// QA round 2, BUG-3: the sale form's refusal must carry a reason for FormError.
test("a sale over the ready stock is refused with a message", () => {
  const s = ready();
  s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5" });
  s.run("branch", "receive", { kg: "5", allocation: last(s).id });
  s.run("branch", "thaw", { kg: "0.5", bags: "1" });
  expect(() =>
    s.run("branch", "sale", {
      boxes: "6",
      addons: "0",
      chiliAddons: "0",
      soldKg: "0.6",
      wasteKg: "0",
      riceWasteKg: "0",
      expense: "0",
      lineMan: "0",
    }),
  ).toThrow("น้ำหนักขายและ Waste เกินเนื้อพร้อมขาย");
});

test("defaults fill dates, the first select option and zero-allowed numbers", () => {
  expect(defaults("dispatch", day)).toMatchObject({
    pickupDate: day,
    trip: "เที่ยวเดียว",
    origin: "กรุงเทพฯ",
    destination: "เชียงใหม่",
    pickupTime: "",
    dispatchKg: "",
    note: "",
  });
  expect(defaults("return", day)).toMatchObject({
    returnDate: day,
    origin: "เชียงใหม่",
    destination: "กรุงเทพฯ",
  });
  expect(defaults("sale", day)).toMatchObject({
    boxes: "0",
    chiliRemark: "",
    reason: "",
  });
  expect(defaults("unknown", day)).toEqual({});
});

test("every form is a titled entry kind with unique keys and selectable options", () => {
  for (const [kind, fields] of Object.entries(forms)) {
    expect(titles, kind).toHaveProperty(kind);
    const keys = fields.map((field) => field.key);
    expect(new Set(keys).size, kind).toBe(keys.length);
    for (const field of fields.filter((item) => item.type === "select"))
      expect(field.options?.length, `${kind}.${field.key}`).toBeGreaterThan(0);
  }
});

test("every time field picks from the half-hour grid that mutate accepts", () => {
  const slots = timeOptions();
  expect(slots).toHaveLength(48);
  expect([slots.at(0), slots.at(1), slots.at(-1)]).toEqual([
    "00:00",
    "00:30",
    "23:30",
  ]);
  // The same shape mutate() insists on for arrival / time / closeTime / pickupTime.
  for (const slot of slots) expect(slot).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  // A time an older entry already holds must survive reopening its form.
  expect(timeOptions("08:15")).toHaveLength(49);
  expect(timeOptions("08:15").slice(16, 19)).toEqual([
    "08:00",
    "08:15",
    "08:30",
  ]);
  const timeFields = Object.entries(forms).flatMap(([kind, fields]) =>
    fields.filter((f) => f.type === "time").map((f) => `${kind}.${f.key}`),
  );
  expect(timeFields).toEqual(
    expect.arrayContaining([
      "dispatch.pickupTime",
      "cmReceive.arrival",
      "return.returnTime",
      "foodivaReturnReceive.receivedTime",
      "closeDay.time",
      "config.closeTime",
    ]),
  );
  // No `time` field may keep a free-text default: the grid is the only source.
  for (const [kind, fields] of Object.entries(forms))
    for (const field of fields.filter((f) => f.type === "time"))
      expect(defaults(kind, day)[field.key], `${kind}.${field.key}`).toBe("");
});

// Every form now runs the save's own mutate() on each keystroke to show what is
// wrong before ยืนยัน. That is only safe while a run leaves its input alone.
test("a dry run of mutate changes neither the database nor the values given to it", () => {
  const s = ready();
  const lotId = s.db.lots.at(-1)!.id;
  const before = JSON.stringify(s.db);
  const values = { branch: "ศาลาแดง", kg: "9999" };
  expect(() =>
    mutate(s.db, "owner", "allocate", values, lotId, day),
  ).toThrowError();
  mutate(s.db, "owner", "allocate", { ...values, kg: "1" }, lotId, day);
  expect(JSON.stringify(s.db)).toBe(before);
  expect(values).toEqual({ branch: "ศาลาแดง", kg: "9999" });
});

test("payment slips: optional multi-file field on both payments, stored as JSON storage keys", () => {
  for (const kind of ["invoicePayment", "meatPayment"])
    expect(forms[kind].find((f) => f.key === "slips")).toMatchObject({
      type: "files",
      optional: true,
    });
  const slips = [
    { name: "a.jpg", storageKey: "k1" },
    { name: "b.pdf", storageKey: "k2" },
  ];
  expect(uploadedFiles(JSON.stringify(slips))).toEqual(slips);
  expect(uploadedFiles(undefined)).toEqual([]);
  expect(uploadedFiles("[]")).toEqual([]);
  expect(uploadedFiles("not json")).toEqual([]);
  expect(uploadedFiles('[{"name":"a.jpg"},null]')).toEqual([]);
});

// B2: raw sticky rice moved to the branches; the Owner purchase form stops offering it.
test("Owner general purchase no longer lists raw sticky rice", () => {
  expect(standardIngredients.some((item) => item.includes("ข้าว"))).toBe(false);
});

test("the rice purchase asks for its source every time, with nothing preselected", () => {
  expect(forms.ricePurchase[0]).toMatchObject({
    key: "riceSource",
    type: "select",
  });
  expect(defaults("ricePurchase", day).riceSource).toBe("");
});
