import { expect, test } from "vitest";
import { defaults, forms } from "@/lib/forms";
import { materials, ownerMaterialStock, titles } from "@/lib/store";
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
  s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5", bags: "2" });
  s.run("branch", "receive", { kg: "5", bags: "2", allocation: last(s).id });
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
