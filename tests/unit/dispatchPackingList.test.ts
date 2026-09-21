import { describe, expect, it } from "vitest";
import { nextTimeSlot } from "@/lib/forms";
import { dispatchWithPackingList } from "@/lib/store";
import { day, readyToDispatch, send, setup } from "./fixtures";

describe("dispatchWithPackingList", () => {
  it("saves the transport document and its Packing List together, document first", () => {
    const s = setup();
    readyToDispatch(s, "50");
    const lotId = s.db.lots.at(-1)!.id;
    const next = dispatchWithPackingList(
      s.db,
      lotId,
      send,
      { invoiceNo: "INV-1", product: "เนื้อวัว", boxes: "25\n25" },
      day,
    );
    expect(
      next.entries.slice(-2).map((e) => [e.kind, e.role, e.lotId]),
    ).toEqual([
      ["dispatch", "foodiva", lotId],
      ["packingList", "foodiva", lotId],
    ]);
    expect(next.lots.at(-1)!.stage).toBe(2);
    expect(next.entries.at(-1)!.values.slicedNetKg).toBe("50");
  });

  it("saves neither when the Packing List is refused", () => {
    const s = setup();
    readyToDispatch(s, "50");
    expect(() =>
      dispatchWithPackingList(
        s.db,
        s.db.lots.at(-1)!.id,
        send,
        { invoiceNo: "INV-1", product: "เนื้อวัว", boxes: "" },
        day,
      ),
    ).toThrow("กรอกน้ำหนักอย่างน้อย 1 กล่องรับเข้า");
    expect(s.db.lots.at(-1)!.stage).toBe(1);
  });
});

describe("nextTimeSlot", () => {
  // Bangkok is UTC+7.
  it.each([
    ["2026-09-21T01:10:00Z", "08:30"],
    ["2026-09-21T01:30:00Z", "09:00"],
    ["2026-09-21T00:00:00Z", "07:30"],
    ["2026-09-21T16:45:00Z", "00:00"],
  ])("%s → %s", (now, slot) => {
    expect(nextTimeSlot(new Date(now))).toBe(slot);
  });
});
