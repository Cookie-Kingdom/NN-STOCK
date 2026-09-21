import { describe, expect, it } from "vitest";
import {
  receivedDraft,
  receivedValue,
} from "@/components/organisms/chef/receivedBoxes";
import {
  entries,
  latestPackingList,
  lotCost,
  produced,
  producedBags,
  visibleDatabase,
  type Values,
} from "@/lib/store";
import {
  closed,
  day,
  dispatch,
  packingList,
  readyToDispatch,
  received,
  setup,
  smoked,
  smokeOrder,
} from "./fixtures";

/** Stage 2: 50 kg as 25 + 25 kg กล่องรับเข้า, smoke PO accepted, waiting for the yellow cells. */
function trucked() {
  const s = setup();
  readyToDispatch(s, "50");
  dispatch(s);
  packingList(s, "25\n25");
  smokeOrder(s);
  s.run("cm", "smokeOrderAccept", { acceptedBy: "Chef House" });
  return s;
}

describe("Chef House yellow cells", () => {
  it("drafts one blank cell per กล่องรับเข้า and keeps a blank as a blank line", () => {
    const list = latestPackingList(trucked().db, trucked().db.lots.at(-1)!.id);
    expect(receivedDraft(list)).toEqual([undefined, undefined]);
    expect(receivedDraft(list, "24.5\n")).toEqual([24.5, undefined]);
    expect(receivedValue([24.5, undefined])).toBe("24.5\n");
  });

  it("refuses a skipped box but saves a total off the Packing List", () => {
    const s = trucked();
    expect(() =>
      s.run("cm", "cmReceive", {
        arrival: "08:00",
        receivedBoxes: receivedValue([24.5, undefined]),
      }),
    ).toThrow("กรอกน้ำหนักจริงทุกกล่องรับเข้า");
    s.run("cm", "cmReceive", {
      arrival: "08:00",
      receivedBoxes: receivedValue([24.5, 27]),
    });
    const lot = s.db.lots.at(-1)!;
    expect(lot.stage).toBe(3);
    expect(lot.values.receivedKg).toBe("51.5");
    expect(lotCost(s.db, lot).meat).toBeCloseTo(51.5 * 250);
  });

  it("chefEdit refuses the yellow cells: they are weighed once at cmReceive (A5)", () => {
    const s = smoked();
    const lot = s.db.lots.at(-1)!;
    const receive = entries(s.db, "cmReceive", lot.id).at(-1)!;
    const list = latestPackingList(s.db, lot.id);
    expect(receivedDraft(list, receive.values.receivedBoxes)).toEqual([
      24.5, 24.5,
    ]);
    const batches = entries(s.db, "smoke", lot.id).map((e) => ({
      id: e.id,
      smokeDate: e.values.smokeDate,
      inputKg: e.values.inputKg,
      wasteKg: e.values.wasteKg,
      packs: e.values.packs,
    }));
    const edit = (values: Values) =>
      s.run("cm", "chefEdit", {
        arrival: "09:00",
        preSmokeKg: "48",
        batches: JSON.stringify(batches),
        ...values,
      });
    expect(() => edit({ receivedBoxes: receivedValue([30, 25]) })).toThrow(
      "น้ำหนักรับจริง (ช่องเหลือง) บันทึกครั้งเดียวตอนยืนยันรับเนื้อ แก้ไขไม่ได้",
    );
    expect(() => edit({ receivedKg: "55" })).toThrow(/ช่องเหลือง/);
    // The other fields still save; the received weight and cost stay as weighed in.
    edit({});
    const edited = s.db.lots.at(-1)!;
    expect(edited.values.arrival).toBe("09:00");
    expect(edited.values.receivedKg).toBe("49");
    expect(
      entries(s.db, "cmReceive", lot.id).at(-1)!.values.receivedBoxes,
    ).toBe(receive.values.receivedBoxes);
    expect(lotCost(s.db, edited).meat).toBeCloseTo(49 * 250);
  });

  it("closing yields the กล่องรมควัน count and kg for the next step", () => {
    const s = closed();
    const id = s.db.lots.at(-1)!.id;
    expect(producedBags(s.db, id)).toBe(360);
    expect(produced(s.db, id)).toBeCloseTo(36);
  });

  it("names the post-smoke unit กล่องรมควัน in errors", () => {
    const s = setup();
    received(s, "50", "25\n25");
    s.run("cm", "prepare", { preSmokeKg: "48" });
    expect(() =>
      s.run("cm", "smoke", {
        smokeDate: day,
        inputKg: "1",
        wasteKg: "0",
        packs: "",
      }),
    ).toThrow("กล่องรมควัน");
  });

  it("Chef House's database has no purchase PO number or meat price", () => {
    const text = JSON.stringify(visibleDatabase(smoked().db, "cm"));
    expect(text).not.toContain("PO-");
    expect(text).not.toContain('"price"');
  });
});
