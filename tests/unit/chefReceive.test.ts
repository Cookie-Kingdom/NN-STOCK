import { describe, expect, it } from "vitest";
import {
  check,
  entries,
  lotCost,
  lotProgress,
  mutate,
  produced,
  producedBags,
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
} from "./fixtures";

/** Stage 2: 50 kg on a Packing List of two กล่องรับเข้า, smoke PO accepted, waiting for Chef
 *  House to weigh in the total. */
function trucked() {
  const s = setup();
  readyToDispatch(s, "50");
  dispatch(s);
  packingList(s, "25\n25");

  s.run("owner", "smokeOrderAccept", { acceptedBy: "Chef House" });
  return s;
}

describe("Chef House received total (CHF-02)", () => {
  it("the Owner's weigh-in (ChefReceiveForm's mutate) is Chef House's, typed by the Owner", () => {
    const s = trucked();
    const lotId = s.db.lots.at(-1)!.id;
    const input = { arrival: "08:00", receivedKg: "49" };
    const next = mutate(s.db, "owner", "cmReceive", input, lotId, day);
    expect(next.entries.at(-1)).toMatchObject({
      kind: "cmReceive",
      role: "cm",
      actor: "owner",
    });
  });

  it("CHF-03 weighs the meat in and prepares before the smoke PO is accepted", () => {
    const s = setup();
    readyToDispatch(s, "50");
    dispatch(s);
    packingList(s, "25\n25");
    // The truck is at the door: no PO acceptance needed to weigh the meat in or start.
    s.run("owner", "cmReceive", { arrival: "08:00", receivedKg: "49" });
    const lotId = s.db.lots.at(-1)!.id;
    expect(lotProgress(s.db, lotId).has("cmReceive")).toBe(true);
    s.run("owner", "prepare", { preSmokeKg: "48" });
    s.run("owner", "smokeOrderAccept", { acceptedBy: "Chef House" });
    expect([...lotProgress(s.db, lotId)]).toEqual(
      expect.arrayContaining(["prepare", "smokeOrderAccept"]),
    );
  });

  it("saves a total off the Packing List with a warning; stock and cost run on it", () => {
    const s = trucked();
    const lotId = s.db.lots.at(-1)!.id;
    const result = check(() =>
      mutate(
        s.db,
        "owner",
        "cmReceive",
        { arrival: "08:00", receivedKg: "51.5" },
        lotId,
        day,
      ),
    );
    expect(result.error).toBe("");
    expect(result.warnings).toContain("น้ำหนักรับรวมไม่ตรงกับ Packing List");
    s.run("owner", "cmReceive", { arrival: "08:00", receivedKg: "51.5" });
    const lot = s.db.lots.at(-1)!;
    expect(lotProgress(s.db, lot.id).has("cmReceive")).toBe(true);
    expect(lot.values.receivedKg).toBe("51.5");
    expect(lotCost(s.db, lot).meat).toBeCloseTo(51.5 * 250);
  });

  it("an empty received total saves, marked as not filled in (GEN-02)", () => {
    const s = trucked();
    s.run("owner", "cmReceive", { arrival: "08:00", receivedKg: "" });
    const receive = entries(s.db, "cmReceive", s.db.lots.at(-1)!.id).at(-1)!;
    expect(receive.values.missing?.split(",")).toContain("receivedKg");
    expect(() =>
      s.run("owner", "cmReceive", { arrival: "08:00", receivedKg: "-1" }),
    ).toThrow("น้ำหนักรับรวม");
  });

  it("CHF-04 chefEdit corrects the received total; left out, the saved one stands", () => {
    const s = smoked();
    const lot = s.db.lots.at(-1)!;
    const batches = entries(s.db, "smoke", lot.id).map((e) => ({
      id: e.id,
      smokeDate: e.values.smokeDate,
      inputKg: e.values.inputKg,
      wasteKg: e.values.wasteKg,
      packs: e.values.packs,
    }));
    const edit = (values: Values) =>
      s.run("owner", "chefEdit", {
        arrival: "09:00",
        preSmokeKg: "48",
        batches: JSON.stringify(batches),
        ...values,
      });
    edit({});
    expect(s.db.lots.at(-1)!.values.arrival).toBe("09:00");
    expect(s.db.lots.at(-1)!.values.receivedKg).toBe("49");
    edit({ receivedKg: "50" });
    const edited = s.db.lots.at(-1)!;
    expect(edited.values.receivedKg).toBe("50");
    expect(lotCost(s.db, edited).meat).toBeCloseTo(50 * 250);
  });

  it("GEN-02 chefEdit saves empty round fields as missing; a typed bad one is refused", () => {
    const s = smoked();
    const lot = s.db.lots.at(-1)!;
    const rounds = entries(s.db, "smoke", lot.id).map((e) => ({
      id: e.id,
      smokeDate: e.values.smokeDate,
      inputKg: e.values.inputKg,
      wasteKg: e.values.wasteKg,
      packs: e.values.packs,
    }));
    const edit = (first: Values, values: Values = {}) =>
      s.run("owner", "chefEdit", {
        arrival: "09:00",
        preSmokeKg: "48",
        batches: JSON.stringify([{ ...rounds[0], ...first }, rounds[1]]),
        ...values,
      });
    expect(() => edit({ inputKg: "-1" })).toThrow("น้ำหนักเข้าเตา");
    expect(() => edit({}, { preSmokeKg: "abc" })).toThrow("น้ำหนักก่อนสโมค");
    edit({ smokeDate: "", inputKg: "", wasteKg: "" }, { preSmokeKg: "" });
    expect(
      entries(s.db, "chefEdit", lot.id).at(-1)!.values.missing?.split(","),
    ).toEqual(["preSmokeKg", "smokeDate", "inputKg", "wasteKg"]);
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
    s.run("owner", "prepare", { preSmokeKg: "48" });
    expect(() =>
      s.run("owner", "smoke", {
        smokeDate: day,
        inputKg: "1",
        wasteKg: "0",
        packs: "0",
      }),
    ).toThrow("กล่องรมควัน");
  });
});
