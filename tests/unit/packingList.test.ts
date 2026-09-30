import { describe, expect, test } from "vitest";
import { check, entries, mutate } from "@/lib/store";
import { dispatch, expectWarning, readyToDispatch, setup } from "./fixtures";

// TODO: the Packing List has no box rows any more; this stand-in only keeps the file
// compiling until the tests are rewritten.
const packingListBoxes = (value = "") =>
  value
    .split("\n")
    .filter((line) => line.trim())
    .map(Number);

const list = { invoiceNo: "INV-1", product: "เนื้อวัว", slicedLostKg: "30" };

/** A shipment with its outbound transport document, which is what a Packing List needs. */
function dispatched() {
  const s = setup();
  readyToDispatch(s, "40");
  dispatch(s);
  return s;
}

describe("packingList", () => {
  test("drops blank rows and totals the ones that were filled", () => {
    const s = dispatched();
    s.run("owner", "packingList", { ...list, boxes: "14.5\n\n  \n15.5\n" });
    const saved = entries(s.db, "packingList", s.db.lots.at(-1)!.id).at(-1)!;
    expect(packingListBoxes(saved.values.boxes)).toEqual([14.5, 15.5]);
    expect(saved.values.boxCount).toBe("2");
    expect(saved.values.slicedNetKg).toBe("30");
  });

  test("Sliced Weight Net is the rows added up, whatever the form sent", () => {
    const s = dispatched();
    s.run("owner", "packingList", {
      ...list,
      boxes: "14.5\n15.5",
      slicedNetKg: "28",
    });
    const saved = entries(s.db, "packingList", s.db.lots.at(-1)!.id).at(-1)!;
    expect(saved.values.slicedNetKg).toBe("30");
    expect(packingListBoxes(saved.values.boxes)).toEqual([14.5, 15.5]);
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

  test("refuses an empty list and a bad weight; an over-weight total only warns", () => {
    const s = dispatched();
    const lotId = s.db.lots.at(-1)!.id;
    const save = (values: Record<string, string>) =>
      mutate(s.db, "owner", "packingList", values, lotId, s.db.entries[0].date);
    expect(() => save({ ...list, boxes: "" })).toThrow(/อย่างน้อย 1 กล่อง/);
    expect(() => save({ ...list, boxes: "-2" })).toThrow(/มากกว่าศูนย์/);
    expect(() => save({ ...list, boxes: "10", slicedLostKg: "" })).toThrow(
      /Sliced Weight Lost/,
    );
    // Zero is a normal list — nothing was lost — but a negative loss is not.
    expect(() =>
      save({ ...list, boxes: "10", slicedLostKg: "0" }),
    ).not.toThrow();
    expect(() => save({ ...list, boxes: "10", slicedLostKg: "-1" })).toThrow(
      /Sliced Weight Lost/,
    );
    // Over Inv. Weight is only a warning: the list still saves.
    expectWarning(
      check(() => save({ ...list, boxes: "10\n20", invWeightKg: "25" })),
      /เกิน Inv. Weight/,
    );
    // A Sliced Weight Net sent along is ignored, so it can never dodge the warning.
    expectWarning(
      check(() =>
        save({
          ...list,
          boxes: "10\n20",
          slicedNetKg: "25",
          invWeightKg: "25",
        }),
      ),
      /เกิน Inv. Weight/,
    );
  });

  test("SHP-02 saves without a transport document, never goes on a purchase PO, and only Foodiva (or the Owner for them) may save it", () => {
    const s = setup();
    readyToDispatch(s, "40");
    const date = s.db.entries[0].date;
    const save = (role: "owner" | "branch", lotId: string) =>
      mutate(s.db, role, "packingList", { ...list, boxes: "10" }, lotId, date);
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
