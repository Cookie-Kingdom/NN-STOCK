import { describe, expect, test } from "vitest";
import { editFields } from "@/lib/forms";
import {
  editBlock,
  entries,
  lotCost,
  missingKeys,
  mutate,
  n,
  poRemainingKg,
  produced,
  type Entry,
  type EntryKind,
  type Values,
} from "@/lib/store";
import { editableKinds, entryKinds } from "@/lib/store/model";
import {
  closed,
  confirm,
  day,
  expectWarning,
  invoice,
  last,
  purchase,
  purchaseInfo,
  ready,
  setup,
  smokeOrder,
  smoked,
  type Setup,
} from "./fixtures";

/** The Owner's direct edit of `target` (EDT-01): the Log's "แก้ไข". */
const edit = (
  s: Setup,
  target: Entry,
  values: Values,
  reason = "แก้ตามเอกสาร",
) =>
  s.run("owner", "entryEdit", {
    targetId: target.id,
    values: JSON.stringify(values),
    reason,
  });
const first = (s: Setup, kind: EntryKind) => entries(s.db, kind)[0];

describe("EDT-01 every recorded kind can be edited", () => {
  test("only corrections, bookkeeping, settings and the material count are left out", () => {
    expect(entryKinds.filter((kind) => !editableKinds.includes(kind))).toEqual([
      "chefEdit",
      "materials",
      "config",
      "void",
      "entryEdit",
      "editRequest",
      "editDecision",
      "link",
      "steakTransfer",
    ]);
  });

  test("each editable kind has fields to edit", () => {
    for (const kind of editableKinds)
      expect(editFields(kind).length, kind).toBeGreaterThan(0);
  });

  test("a purchase PO saved with empty fields is completed later, and its lot follows", () => {
    const s = setup();
    s.run("owner", "purchase", {
      ...purchaseInfo,
      supplier: "",
      phone: "",
      orderedKg: "100",
      price: "250",
    });
    const po = last(s);
    expect(missingKeys(po.values)).toEqual(["supplier", "phone"]);
    expect(editBlock(s.db, po, "owner")).toBe("");

    edit(s, po, { supplier: "Foodiva", orderedKg: "120", price: "260" });
    const lot = s.db.lots.find((l) => l.id === po.lotId)!;
    // One PO still: the edit makes no second lot, and the cache holds the new figures.
    expect(s.db.lots).toHaveLength(1);
    expect(lot.values).toMatchObject({
      supplier: "Foodiva",
      orderedKg: "120",
      price: "260",
    });
    expect(missingKeys(first(s, "purchase").values)).toEqual(["phone"]);
    expect(poRemainingKg(s.db, lot.id)).toBe(120);

    // Undoing the edit puts the lot back.
    s.run("owner", "void", { targetId: last(s).id, reason: "แก้ผิด" });
    expect(s.db.lots[0].values).toMatchObject({
      supplier: "",
      orderedKg: "100",
      price: "250",
    });
  });

  test("a purchase PO cut below what smoke POs drew from it only warns", () => {
    const s = setup();
    purchase(s, "100");
    const po = last(s);
    smokeOrder(s, [[po.lotId, "80"]], "80", "");
    expectWarning(
      s.check("owner", "entryEdit", {
        targetId: po.id,
        values: JSON.stringify({ orderedKg: "50" }),
        reason: "x",
      }),
      /ยอดพร้อมส่ง .*จะติดลบ/,
    );
  });

  test("a negative number is still refused in an edit", () => {
    const s = setup();
    purchase(s, "100");
    expect(() => edit(s, last(s), { orderedKg: "-1" })).toThrow(
      "เป็นตัวเลขมากกว่าศูนย์",
    );
  });

  test("the price edit reaches the batch's meat cost", () => {
    const s = ready();
    const po = first(s, "purchase");
    const batch = s.db.lots.find((l) => l.kind === "shipment")!;
    const before = lotCost(s.db, batch).meat;
    edit(s, po, { price: "500" });
    expect(before).toBeGreaterThan(0);
    expect(lotCost(s.db, batch).meat).toBeCloseTo(before * 2);
  });
});

describe("EDT-17 batch entries: numbers stay, the cache follows the newest", () => {
  test("a transport document keeps its number and fee; a changed trip is priced again", () => {
    const s = smoked();
    const dispatch = first(s, "dispatch");
    const lot = s.db.lots.find((l) => l.id === dispatch.lotId)!;
    s.db.config.roundFee = "9999";
    edit(s, dispatch, { plate: "70-1234" });
    const kept = first(s, "dispatch").values;
    expect(kept.transferNumber).toBe(dispatch.values.transferNumber);
    expect(kept.outboundCost).toBe(dispatch.values.outboundCost);
    expect(s.db.lots.find((l) => l.id === lot.id)!.values.plate).toBe(
      "70-1234",
    );
    edit(s, dispatch, { trip: "เที่ยวเดียว" });
    expect(first(s, "dispatch").values.outboundCost).toBe(
      s.db.config.outboundFee,
    );
  });

  test("an older smoke round is corrected without overwriting the latest round on the lot", () => {
    const s = smoked();
    const [round1, round2] = entries(s.db, "smoke");
    edit(s, round1, { inputKg: "20", wasteKg: "4", packs: "8\n8" });
    const fixed = entries(s.db, "smoke")[0].values;
    expect(fixed.subLot).toBe(round1.values.subLot);
    expect(fixed.postSmokeKg).toBe("16.00");
    expect(produced(s.db, round1.lotId)).toBeCloseTo(16 + 21);
    const lot = s.db.lots.find((l) => l.id === round1.lotId)!;
    expect(lot.values.inputKg).toBe(round2.values.inputKg);
  });

  test("the weigh-in total is edited after ปิด Lot", () => {
    const s = closed();
    const receive = first(s, "cmReceive");
    edit(s, receive, { receivedKg: "49.5" });
    expect(first(s, "cmReceive").values.receivedKg).toBe("49.5");
    expect(
      n(s.db.lots.find((l) => l.id === receive.lotId)!.values, "receivedKg"),
    ).toBe(49.5);
  });

  test("a Packing List edit works Sliced Weight Lost out again", () => {
    const s = setup();
    purchase(s, "100");
    const po = last(s);
    smokeOrder(s, [[po.lotId, "100"]], "100", "");
    s.run("owner", "packingList", {
      invoiceNo: "INV-1",
      product: "เนื้อวัว",
      attachment: "packing.pdf",
      invWeightKg: "100",
      slicedNetKg: "95",
      slicedLostKg: "5",
    });
    edit(s, last(s), { slicedNetKg: "92.5" });
    expect(first(s, "packingList").values).toMatchObject({
      slicedNetKg: "92.5",
      slicedLostKg: "7.5",
      attachment: "packing.pdf",
    });
  });
});

describe("EDT-03 money documents", () => {
  test("a paid smoking invoice is edited with a warning, not refused", () => {
    const s = closed();
    const bill = invoice(s);
    s.run("owner", "invoiceReview", {
      decision: "รับยอด",
      reviewedBy: "Owner",
    });
    s.run("owner", "invoicePayment", {
      paymentDate: day,
      paidBy: "Owner",
      paidAmount: bill.values.netPayable,
    });
    expect(editBlock(s.db, bill, "owner")).toBe("");
    expectWarning(
      s.check("owner", "entryEdit", {
        targetId: bill.id,
        values: JSON.stringify({ invoiceNumber: "CH-2" }),
        reason: "เลขผิด",
      }),
      "Invoice นี้ชำระแล้ว",
    );
    edit(s, bill, { invoiceNumber: "CH-2" });
    expect(first(s, "smokingInvoice").values.invoiceNumber).toBe("CH-2");

    // The payment and the review themselves are editable too.
    const payment = first(s, "invoicePayment");
    edit(s, payment, { paidBy: "ฝ่ายบัญชี" });
    expect(first(s, "invoicePayment").values.paidBy).toBe("ฝ่ายบัญชี");
    const review = first(s, "invoiceReview");
    edit(s, review, { reviewedBy: "ผู้จัดการ" });
    expect(first(s, "invoiceReview").values).toMatchObject({
      reviewedBy: "ผู้จัดการ",
      reviewedAt: review.values.reviewedAt,
    });
  });

  test("a meat payment is edited without tripping the paid-twice rule", () => {
    const s = setup();
    purchase(s, "100");
    confirm(s, "100");
    s.run("owner", "meatPayment", {
      paymentDate: day,
      paidBy: "Owner",
      paidAmount: "1",
    });
    edit(s, last(s), { paidAmount: "25000" });
    expect(first(s, "meatPayment").values.paidAmount).toBe("25000");
    // A second payment is still refused.
    expect(() =>
      s.run("owner", "meatPayment", {
        paymentDate: day,
        paidBy: "Owner",
        paidAmount: "1",
      }),
    ).toThrow("ชำระ Invoice เนื้อใบนี้แล้ว");
  });
});

describe("branch entries", () => {
  test("a branch asks to correct its day-close; another branch's entry stays out of reach", () => {
    const s = setup();
    s.run("branch", "closeDay", { confirm: "ผู้ดูแล" });
    const close = last(s);
    s.run("branch", "editRequest", {
      targetId: close.id,
      values: JSON.stringify({ confirm: "ผู้ดูแลสาขา" }),
      reason: "ชื่อผิด",
    });
    expect(last(s).values["to.confirm"]).toBe("ผู้ดูแลสาขา");
    expect(() =>
      mutate(
        s.db,
        "branch",
        "editRequest",
        { targetId: close.id, values: "{}", reason: "x" },
        "",
        day,
        "มีนบุรี",
      ),
    ).toThrow("เฉพาะรายการของบัญชีนี้");
  });

  test("the date an entry is filed under is not an edit", () => {
    const s = setup();
    s.run("owner", "materialReceive", {
      purchaseDate: day,
      material: "กล่องพิมพ์ลาย",
      quantity: "10",
      unitPrice: "1",
      supplier: "ร้านวัสดุ",
    });
    expect(() => edit(s, last(s), { purchaseDate: "2026-09-01" })).toThrow(
      "ยกเลิกแล้วบันทึกใหม่",
    );
  });
});

describe("an edit changes only what was edited", () => {
  const fresh: EntryKind[] = [
    "purchase",
    "foodivaConfirm",
    "smokeOrder",
    "dispatch",
    "packingList",
    "smokeOrderAccept",
    "cmReceive",
    "prepare",
    "smoke",
    "closeLot",
    "return",
    "foodivaReturnReceive",
    "central",
  ];

  test("an edit that proposes nothing leaves every value and the lot cache as they were", () => {
    for (const kind of fresh) {
      const s = ready();
      const before = structuredClone(s.db);
      for (const target of entries(before, kind)) edit(s, target, {});
      for (const target of entries(before, kind)) {
        const after = entries(s.db, kind).find((e) => e.id === target.id)!;
        expect({ ...after.values, missing: "" }, kind).toEqual({
          ...target.values,
          missing: "",
        });
      }
      expect(
        s.db.lots.map((l) => l.values),
        kind,
      ).toEqual(before.lots.map((l) => l.values));
    }
  });

  test("a trip changed on the transport document prices the return leg again", () => {
    const s = ready();
    const batch = () => s.db.lots.find((l) => l.kind === "shipment")!;
    // fixtures send "ไปกลับ": one round fee, the return leg free.
    expect(lotCost(s.db, batch()).freight).toBe(n(s.db.config, "roundFee"));
    const dispatch = first(s, "dispatch");
    edit(s, dispatch, { trip: "เที่ยวเดียว" });
    expect(lotCost(s.db, batch()).freight).toBe(
      n(s.db.config, "outboundFee") + n(s.db.config, "returnFee"),
    );
    // A later edit of another step does not bring the old fee back.
    edit(s, first(s, "cmReceive"), { receivedKg: "49" });
    edit(s, first(s, "return"), { plate: "1กข-999" });
    expect(lotCost(s.db, batch()).freight).toBe(
      n(s.db.config, "outboundFee") + n(s.db.config, "returnFee"),
    );
    edit(s, dispatch, { trip: "ไปกลับ" });
    expect(lotCost(s.db, batch()).freight).toBe(n(s.db.config, "roundFee"));
  });

  test("the transport document's edit keeps what the return truck put on the batch", () => {
    const s = ready();
    const lot = () => s.db.lots.find((l) => l.kind === "shipment")!;
    const kept = { ...lot().values };
    edit(s, first(s, "dispatch"), { driverName: "สมชาย", note: "รถมาช้า" });
    // The return truck's plate, places and number are still the cache's; only what the
    // transport document alone holds has changed.
    for (const key of ["plate", "origin", "destination", "transferNumber"])
      expect(lot().values[key], key).toBe(kept[key]);
    const added = last(s);
    s.run("owner", "void", { targetId: added.id, reason: "แก้ผิด" });
    expect(lot().values).toEqual(kept);
  });

  test("an older unlock is still edited after the day was closed and unlocked again", () => {
    const s = setup();
    for (const round of [1, 2]) {
      s.run("branch", "closeDay", { confirm: `ผู้ดูแล ${round}` });
      s.run("owner", "unlock", { branch: "ศาลาแดง", reason: `รอบ ${round}` });
    }
    const [older] = entries(s.db, "unlock");
    edit(s, older, { reason: "ปลดล็อกตามคำขอสาขา" });
    expect(entries(s.db, "unlock")[0].values.reason).toBe("ปลดล็อกตามคำขอสาขา");
  });

  test("the Owner approves a branch's request on a newly editable kind", () => {
    const s = setup();
    s.run("branch", "closeDay", { confirm: "ผู้ดูแล" });
    const close = last(s);
    s.run("branch", "editRequest", {
      targetId: close.id,
      values: JSON.stringify({ confirm: "ผู้ดูแลสาขา" }),
      reason: "ชื่อผิด",
    });
    s.run("owner", "editDecision", {
      requestId: last(s).id,
      decision: "อนุมัติ",
    });
    expect(first(s, "closeDay").values.confirm).toBe("ผู้ดูแลสาขา");
  });

  test("the fields the edit shows cover what each hand-listed kind's rules ask for", () => {
    const keys = (kind: EntryKind) => editFields(kind).map((f) => f.key);
    expect(keys("generalPurchase")).toEqual(
      expect.arrayContaining([
        "purchaseCategory",
        "item",
        "unit",
        "quantity",
        "unitPrice",
        "supplier",
      ]),
    );
    expect(keys("materialConfirm")).toEqual(
      expect.arrayContaining(["material", "receivedQuantity", "receiver"]),
    );
    expect(keys("cmReceive")).toEqual(
      expect.arrayContaining(["arrival", "receivedKg"]),
    );
    expect(keys("packingList")).toEqual(
      expect.arrayContaining(["invoiceNo", "product", "slicedNetKg"]),
    );
  });
});
