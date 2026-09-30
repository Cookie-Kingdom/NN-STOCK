import { describe, expect, test } from "vitest";
import { check, entries, mutate } from "@/lib/store";
import { dispatch, expectWarning, readyToDispatch, setup } from "./fixtures";

const list = {
  invoiceNo: "INV-1",
  product: "เนื้อวัว",
  attachment: "packing.pdf",
  slicedNetKg: "30",
  slicedLostKg: "30",
};

/** A shipment with its outbound transport document, which is what a Packing List needs. */
function dispatched() {
  const s = setup();
  readyToDispatch(s, "40");
  dispatch(s);
  return s;
}

describe("packingList", () => {
  test("SHP-02 saves the typed totals and an optional box count; no box rows", () => {
    const s = dispatched();
    s.run("owner", "packingList", { ...list, boxCount: "2" });
    const saved = entries(s.db, "packingList", s.db.lots.at(-1)!.id).at(-1)!;
    expect(saved.values.slicedNetKg).toBe("30");
    expect(saved.values.boxCount).toBe("2");
    expect(saved.values.boxes).toBeUndefined();
    // A box count that is not whole only warns.
    expectWarning(
      s.check("owner", "packingList", { ...list, boxCount: "2.5" }),
      "จำนวนกล่องรับเข้าต้องเป็นจำนวนเต็ม",
    );
  });

  test("GEN-02 empty invoice, product, file and total save, listed as not filled in", () => {
    const s = dispatched();
    s.run("owner", "packingList", { slicedLostKg: "0" });
    const saved = entries(s.db, "packingList", s.db.lots.at(-1)!.id).at(-1)!;
    expect(saved.values.missing?.split(",").sort()).toEqual(
      ["attachment", "invoiceNo", "product", "slicedNetKg"].sort(),
    );
  });

  test("Sliced Weight Lost is stored as Foodiva typed it, not derived from Inv. Weight", () => {
    const s = dispatched();
    s.run("owner", "packingList", {
      ...list,
      boxes: "10\n20",
      invWeightKg: "33",
      slicedLostKg: "29.5",
    });
    expect(
      entries(s.db, "packingList", s.db.lots.at(-1)!.id).at(-1)!.values
        .slicedLostKg,
    ).toBe("29.5");
  });

  test("refuses a typed bad weight; an over-weight total only warns", () => {
    const s = dispatched();
    const lotId = s.db.lots.at(-1)!.id;
    const save = (values: Record<string, string>) =>
      mutate(s.db, "owner", "packingList", values, lotId, s.db.entries[0].date);
    expect(() => save({ ...list, slicedNetKg: "-2" })).toThrow(/มากกว่าศูนย์/);
    // Zero is a normal list — nothing was lost — but a negative loss is not.
    expect(() => save({ ...list, slicedLostKg: "0" })).not.toThrow();
    expect(() => save({ ...list, slicedLostKg: "-1" })).toThrow(
      /Sliced Weight Lost/,
    );
    // Over Inv. Weight is only a warning: the list still saves.
    expectWarning(
      check(() => save({ ...list, invWeightKg: "25" })),
      /เกิน Inv. Weight/,
    );
  });

  test("SHP-02 saves without a transport document, never goes on a purchase PO, and only Foodiva (or the Owner for them) may save it", () => {
    const s = setup();
    readyToDispatch(s, "40");
    const date = s.db.entries[0].date;
    const save = (role: "owner" | "branch", lotId: string) =>
      mutate(s.db, role, "packingList", list, lotId, date);
    const shipment = s.db.lots.at(-1)!.id;
    // After the smoke PO the list still saves; it is only said (SHP-02).
    expectWarning(
      check(() => save("owner", shipment)),
      "Owner ออก PO รมควันของชุดนี้แล้ว",
    );
    expect(() => save("owner", s.db.lots[0].id)).toThrow(
      "รายการนี้ต้องทำกับการส่ง ไม่ใช่ PO ซื้อ",
    );
    expect(save("owner", shipment).entries.at(-1)!.role).toBe("foodiva");
    expect(() => save("branch", shipment)).toThrow(
      "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้",
    );
  });
});
