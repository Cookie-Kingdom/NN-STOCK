import { expect, test } from "vitest";
import { defaults, forms } from "@/lib/forms";
import { titles } from "@/lib/store";

const day = "2026-09-09";

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
