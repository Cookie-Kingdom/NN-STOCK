import { describe, expect, test } from "vitest";
import { entries, mutate, packingListBoxes } from "@/lib/store";
import { confirm, purchase, setup } from "./fixtures";

const list = { invoiceNo: "INV-1", product: "เนื้อวัว" };

/** Setup with the meat invoice already out, which is what a Packing List needs. */
function invoiced() {
  const s = setup();
  purchase(s, "40");
  confirm(s, "40");
  return s;
}

describe("packingList", () => {
  test("drops blank rows and totals the ones that were filled", () => {
    const s = invoiced();
    s.run(
      "foodiva",
      "packingList",
      { ...list, boxes: "14.5\n\n  \n15.5\n" },
      s.db.lots[0].id,
    );
    const saved = entries(s.db, "packingList", s.db.lots[0].id).at(-1)!;
    expect(packingListBoxes(saved.values.boxes)).toEqual([14.5, 15.5]);
    expect(saved.values.boxCount).toBe("2");
    expect(saved.values.slicedNetKg).toBe("30");
  });

  test("Inv. Weight gives the sliced loss", () => {
    const s = invoiced();
    s.run(
      "foodiva",
      "packingList",
      { ...list, boxes: "10\n20", invWeightKg: "33" },
      s.db.lots[0].id,
    );
    expect(
      entries(s.db, "packingList", s.db.lots[0].id).at(-1)!.values.slicedLostKg,
    ).toBe("3");
  });

  test("refuses an empty list, a bad weight and an over-weight total", () => {
    const s = invoiced();
    const lotId = s.db.lots[0].id;
    const save = (values: Record<string, string>) =>
      mutate(
        s.db,
        "foodiva",
        "packingList",
        values,
        lotId,
        s.db.entries[0].date,
      );
    expect(() => save({ ...list, boxes: "" })).toThrow(/อย่างน้อย 1 กล่อง/);
    expect(() => save({ ...list, boxes: "-2" })).toThrow(/มากกว่าศูนย์/);
    expect(() => save({ ...list, boxes: "10\n20", invWeightKg: "25" })).toThrow(
      /เกิน Inv. Weight/,
    );
  });

  test("needs the meat invoice first, and only Foodiva may save it", () => {
    const s = setup();
    purchase(s, "40");
    const lotId = s.db.lots[0].id;
    const date = s.db.entries[0].date;
    expect(() =>
      mutate(
        s.db,
        "foodiva",
        "packingList",
        { ...list, boxes: "10" },
        lotId,
        date,
      ),
    ).toThrow("ต้องออก Invoice เนื้อก่อนทำ Packing List");
    expect(() =>
      mutate(
        s.db,
        "owner",
        "packingList",
        { ...list, boxes: "10" },
        lotId,
        date,
      ),
    ).toThrow("บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้");
  });
});
