import { describe, expect, test } from "vitest";
import {
  allocationOutstanding,
  averageYield,
  balance,
  branchMaterialStock,
  branchMeatDay,
  branches,
  centralStock,
  chiliAllocated,
  chiliStock,
  closeDayChecklist,
  closeDayWithInfluencers,
  cookedRiceStock,
  entries,
  isClosed,
  issuedRawRiceStock,
  lotCost,
  materialPar,
  materials,
  mutate,
  ownerChiliStock,
  ownerMaterialStock,
  ownerWasteOutstanding,
  pendingReceiveKg,
  poRemainingKg,
  packWeights,
  packWeightWarning,
  processLoss,
  produced,
  producedBags,
  rawAtFoodiva,
  pendingSmokeKg,
  preSmokeTrimKg,
  rawAtSmoker,
  rawRiceStock,
  readyForChefHouse,
  requiredRiceKinds,
  revenue,
  riceSources,
  seed,
  sevenDayRoleplay,
  smokeServiceRate,
  smokingInvoiceRejection,
  smokingInvoiceStatus,
  validPackWeights,
  visibleEntries,
  type Database,
  type Entry,
  type Lot,
  type Role,
  type Values,
} from "@/lib/store";
import {
  closed,
  confirm,
  day,
  dispatch,
  invoice,
  last,
  packingList,
  packs,
  purchase,
  chillDay,
  ready,
  readyToDispatch,
  received,
  returned,
  request,
  send,
  setup,
  smoked,
} from "./fixtures";

const entry = (fields: Partial<Entry> & Pick<Entry, "kind">): Entry => ({
  id: crypto.randomUUID(),
  role: "branch",
  lotId: "",
  branch: "ศาลาแดง",
  date: day,
  at: "2000-01-01T10:00:00.000Z",
  values: {},
  ...fields,
});
const withEntries = (...list: Entry[]): Database => ({
  ...structuredClone(seed),
  entries: list,
});

describe("derived values from the entry log", () => {
  test("entries filters by lot, branch and date and skips voided entries", () => {
    const voided = entry({ kind: "thaw", lotId: "L1" });
    const kept = entry({
      kind: "thaw",
      lotId: "L2",
      branch: "มีนบุรี",
      date: "2026-09-10",
    });
    const db = withEntries(
      voided,
      kept,
      entry({ kind: "void", role: "owner", values: { targetId: voided.id } }),
    );
    expect(entries(db, "thaw")).toEqual([kept]);
    expect(entries(db, "thaw", "L2", "มีนบุรี", "2026-09-10")).toEqual([kept]);
    expect(entries(db, "thaw", "L2", "ศาลาแดง")).toEqual([]);
  });

  test("branch meat balance splits frozen and ready stock", () => {
    const db = withEntries(
      entry({ kind: "receive", lotId: "L1", values: { kg: "10" } }),
      entry({ kind: "thaw", lotId: "L1", values: { kg: "4" } }),
      entry({
        kind: "sale",
        lotId: "L1",
        values: { soldKg: "1", wasteKg: "0.5" },
      }),
    );
    expect(balance(db, "L1", "ศาลาแดง")).toEqual({
      received: 10,
      frozen: 6,
      ready: 2.5,
    });
    expect(balance(db, "L1", "มีนบุรี")).toEqual({
      received: 0,
      frozen: 0,
      ready: 0,
    });
  });

  test("rice stock moves from purchase to issue to cooked rice to sales", () => {
    const db = withEntries(
      entry({ kind: "ricePurchase", values: { rawRiceKg: "10" } }),
      entry({ kind: "riceIssue", values: { rawRiceIssuedKg: "4" } }),
      entry({ kind: "rice", values: { rawUsedKg: "3", riceKg: "7" } }),
      entry({ kind: "sale", values: { riceServings: "10", riceWasteKg: "1" } }),
    );
    expect(rawRiceStock(db, "ศาลาแดง")).toBe(6);
    expect(issuedRawRiceStock(db, "ศาลาแดง")).toBe(1);
    expect(cookedRiceStock(db, "ศาลาแดง")).toBe(4);
  });

  test("chili is bought by the owner, allocated to branches and sold", () => {
    const db = withEntries(
      entry({
        kind: "generalPurchase",
        role: "owner",
        values: { item: "น้ำพริกหลอด", quantity: "50" },
      }),
      entry({
        kind: "generalPurchase",
        role: "owner",
        values: { item: "อื่น ๆ", quantity: "99" },
      }),
      entry({
        kind: "chiliAllocate",
        role: "owner",
        values: { chiliTubes: "20" },
      }),
      entry({ kind: "sale", date: "2026-09-10", values: { chiliSold: "3" } }),
    );
    expect(ownerChiliStock(db)).toBe(30);
    expect(chiliStock(db, "ศาลาแดง")).toBe(17);
    expect(chiliStock(db, "ศาลาแดง", day)).toBe(20);
    expect(chiliAllocated(db, "ศาลาแดง", "2026-09-08")).toBe(0);
  });

  test("a day stays closed until an unlock newer than the last close", () => {
    const close = entry({ kind: "closeDay", at: "2000-01-01T10:00:00.000Z" });
    const unlock = (at: string) => entry({ kind: "unlock", role: "owner", at });
    expect(isClosed(withEntries(close), "ศาลาแดง", day)).toBe(true);
    expect(isClosed(withEntries(close), "มีนบุรี", day)).toBe(false);
    expect(isClosed(withEntries(close), "ศาลาแดง", "2026-09-10")).toBe(false);
    expect(
      isClosed(
        withEntries(close, unlock("2000-01-01T09:00:00.000Z")),
        "ศาลาแดง",
        day,
      ),
    ).toBe(true);
    expect(
      isClosed(
        withEntries(close, unlock("2000-01-01T11:00:00.000Z")),
        "ศาลาแดง",
        day,
      ),
    ).toBe(false);
  });

  test("lot cost adds meat, smoking and freight; per kg needs central stock", () => {
    const lot: Lot = {
      id: "L1",
      poId: "SH-1",
      kind: "shipment",
      stage: 8,
      config: {},
      values: {
        lines: JSON.stringify([{ lotId: "P1", kg: "10" }]),
        outboundCost: "2000",
        returnCost: "0",
      },
    };
    const po: Lot = {
      id: "P1",
      poId: "PO-1",
      stage: 1,
      config: {},
      values: { price: "250" },
    };
    const db = {
      ...withEntries(
        entry({
          kind: "smokeOrder",
          role: "owner",
          lotId: "L1",
          values: { estimatedCost: "2200" },
        }),
      ),
      lots: [po, lot],
    };
    expect(lotCost(db, lot)).toEqual({
      meat: 2500,
      smoke: 2200,
      freight: 2000,
      total: 6700,
      perKg: null,
    });
    expect(
      lotCost(db, { ...lot, values: { ...lot.values, centralKg: "10" } }).perKg,
    ).toBe(670);
  });

  test("visibleEntries hides other roles, other branches and cost fields", () => {
    const sala = entry({ kind: "sale", values: { meatCost: "5", boxes: "1" } });
    const minburi = entry({ kind: "sale", branch: "มีนบุรี" });
    const smoke = entry({
      kind: "smoke",
      role: "cm",
      lotId: "S1",
      values: { wasteCost: "1", packs: "1" },
    });
    const db = {
      ...withEntries(sala, minburi, smoke),
      lots: [
        {
          id: "S1",
          poId: "SH-1",
          kind: "shipment" as const,
          stage: 5,
          config: {},
          values: {},
        },
      ],
    };
    expect(visibleEntries(db, "owner")).toEqual(db.entries);
    expect(visibleEntries(db, "branch", "ศาลาแดง")).toEqual([
      { ...sala, values: { boxes: "1" } },
    ]);
    expect(visibleEntries(db, "cm")).toEqual([
      { ...smoke, values: { packs: "1" } },
    ]);
    expect(visibleEntries(db, "foodiva")).toEqual([]);
    expect(visibleEntries(db, "branch")).toEqual([]);
  });

  test("revenue sums sales and material par falls back to branch-suffixed settings", () => {
    const db = withEntries(
      entry({ kind: "sale", values: { revenue: "100" } }),
      entry({ kind: "sale", branch: "มีนบุรี", values: { revenue: "50" } }),
    );
    expect(revenue(db)).toBe(150);
    expect(materialPar(db, "ศาลาแดง", 0)).toBe(0);
    expect(materialPar(setup().db, "ศาลาแดง", 0)).toBe(100);
  });

  test("pack weights parse newline or comma input and only valid weights count as bags", () => {
    expect(packWeights("1.5\n2, 3")).toEqual([1.5, 2, 3]);
    expect(validPackWeights("1\nabc\n0\n2")).toEqual([1, 2]);
    expect(validPackWeights()).toEqual([]);
  });

  test("smoking rate drops at 1,000 and 1,500 kg", () => {
    expect(smokeServiceRate(999)).toBe(220);
    expect(smokeServiceRate(1000)).toBe(200);
    expect(smokeServiceRate(1499)).toBe(200);
    expect(smokeServiceRate(1500)).toBe(180);
  });
});

describe("mutate guards", () => {
  test("invalid role and out-of-order writes rejected without mutation", () => {
    const s = setup();
    expect(() =>
      s.run("cm", "purchase", { supplier: "x", orderedKg: "10", price: "1" }),
    ).toThrow(/ไม่มีสิทธิ์/);
    expect(s.db.lots).toHaveLength(0);
    expect(() =>
      s.run("owner", "allocate", { branch: "มีนบุรี", kg: "1" }),
    ).toThrow(/สต๊อกกลาง/);
  });

  test("rejects a malformed date or time", () => {
    expect(() =>
      mutate(
        seed,
        "owner",
        "expense",
        { category: "ค่าเช่า", amount: "1", detail: "x" },
        "",
        "9/9/2026",
      ),
    ).toThrow(/เลือกวันที่/);
    expect(() =>
      mutate(
        seed,
        "branch",
        "closeDay",
        { time: "25:00", confirm: "x" },
        "",
        day,
        "ศาลาแดง",
      ),
    ).toThrow(/HH:mm/);
  });

  test("purchase numbers lots and POs by date and count and snapshots config", () => {
    const s = setup();
    purchase(s, "40");
    purchase(s, "10");
    expect(s.db.lots.map((lot) => [lot.id, lot.poId, lot.stage])).toEqual([
      ["F260909-001", "PO-2026-0001", 1],
      ["F260909-002", "PO-2026-0002", 1],
    ]);
    expect(s.db.lots[0].config).toEqual(s.db.config);
  });

  test("a closed day blocks branch writes until the owner unlocks it", () => {
    const closed = withEntries(entry({ kind: "closeDay" }));
    const rice = {
      riceSource: riceSources[0],
      supplier: "x",
      rawRiceKg: "1",
      rawRiceCost: "1",
    };
    expect(() =>
      mutate(closed, "branch", "ricePurchase", rice, "", day, "ศาลาแดง"),
    ).toThrow(/ปิดยอดแล้ว/);
    expect(() =>
      mutate(
        seed,
        "owner",
        "unlock",
        { branch: "ศาลาแดง", reason: "x" },
        "",
        day,
      ),
    ).toThrow(/ยังไม่ได้ปิด/);
    const reopened = mutate(
      closed,
      "owner",
      "unlock",
      { branch: "ศาลาแดง", reason: "แก้ยอด" },
      "",
      day,
    );
    expect(isClosed(reopened, "ศาลาแดง", day)).toBe(false);
    expect(() =>
      mutate(reopened, "branch", "ricePurchase", rice, "", day, "ศาลาแดง"),
    ).not.toThrow();
  });

  test("branch writes, day locks and history follow the signed-in branch, not config.branch", () => {
    const db = structuredClone(seed);
    expect(db.config.branch).toBe("ศาลาแดง");
    const cookedRice = {
      riceSource: riceSources[1],
      supplier: "x",
      cookedRiceKg: "30",
      cookedRiceCost: "1350",
    };
    const rawRice = {
      riceSource: riceSources[0],
      supplier: "x",
      rawRiceKg: "1",
      rawRiceCost: "1",
    };
    expect(() =>
      mutate(db, "branch", "ricePurchase", cookedRice, "", day),
    ).toThrow(/ไม่พบสาขา/);
    const next = mutate(
      db,
      "branch",
      "ricePurchase",
      cookedRice,
      "",
      day,
      "มีนบุรี",
    );
    expect(next.entries[0].branch).toBe("มีนบุรี");
    expect(visibleEntries(next, "branch", "มีนบุรี")).toHaveLength(1);
    expect(visibleEntries(next, "branch", "ศาลาแดง")).toEqual([]);
    const minburiClosed = withEntries(
      entry({ kind: "closeDay", branch: "มีนบุรี" }),
    );
    expect(() =>
      mutate(
        minburiClosed,
        "branch",
        "ricePurchase",
        cookedRice,
        "",
        day,
        "มีนบุรี",
      ),
    ).toThrow(/ปิดยอดแล้ว/);
    expect(() =>
      mutate(
        minburiClosed,
        "branch",
        "ricePurchase",
        rawRice,
        "",
        day,
        "ศาลาแดง",
      ),
    ).not.toThrow();
  });

  test("void reverses an allowed entry once and needs a reason", () => {
    const s = setup();
    expect(() =>
      s.run("owner", "chiliAllocate", { branch: "ศาลาแดง", chiliTubes: "1" }),
    ).toThrow(/ไม่พอ/);
    s.run("owner", "generalPurchase", {
      purchaseDate: day,
      item: "น้ำพริกหลอด",
      purchaseCategory: "วัตถุดิบ",
      quantity: "50",
      unitPrice: "6",
      supplier: "x",
    });
    expect(last(s).values.totalCost).toBe("300");
    s.run("owner", "chiliAllocate", { branch: "ศาลาแดง", chiliTubes: "20" });
    const allocation = last(s);
    expect(ownerChiliStock(s.db)).toBe(30);
    expect(chiliStock(s.db, "ศาลาแดง")).toBe(20);
    expect(() => s.run("owner", "void", { targetId: allocation.id })).toThrow(
      /เหตุผล/,
    );
    s.run("owner", "void", { targetId: allocation.id, reason: "ส่งผิด" });
    expect(last(s).values).toMatchObject({
      targetKind: "chiliAllocate",
      targetBranch: "ศาลาแดง",
    });
    expect(ownerChiliStock(s.db)).toBe(50);
    expect(chiliStock(s.db, "ศาลาแดง")).toBe(0);
    expect(() =>
      s.run("owner", "void", { targetId: allocation.id, reason: "x" }),
    ).toThrow(/ถูกยกเลิกแล้ว/);
    purchase(s, "1");
    expect(() =>
      s.run("owner", "void", { targetId: last(s).id, reason: "x" }),
    ).toThrow(/ยกเลิกไม่ได้/);
  });

  test("config merges validated settings and forces included rice price to zero", () => {
    const next = mutate(
      seed,
      "owner",
      "config",
      { ...seed.config, boxPrice: "400", ricePrice: "99" },
      "",
      day,
    );
    expect(next.config).toMatchObject({ boxPrice: "400", ricePrice: "0" });
    expect(seed.config.boxPrice).toBe("350");
    expect(() =>
      mutate(
        seed,
        "owner",
        "config",
        { ...seed.config, tolerance: "101" },
        "",
        day,
      ),
    ).toThrow(/ไม่เกิน 100/);
    expect(() =>
      mutate(seed, "owner", "config", { ...seed.config, packKg: "0" }, "", day),
    ).toThrow(/มากกว่าศูนย์/);
  });
});

describe("lot workflow", () => {
  test("Foodiva cannot confirm more than the PO or split weights that do not add up", () => {
    const s = setup();
    purchase(s, "40");
    const values = (
      confirmedKg: string,
      ready: string,
      reserved: string,
    ): Values => ({
      invoiceNo: "INV-1",
      invoiceDate: day,
      attachment: "inv.pdf",
      confirmedBy: "Foodiva",
      confirmedKg,
      readyForChiangMaiKg: ready,
      reservedForOwnerKg: reserved,
      invoiceAmount: "1",
    });
    expect(() =>
      s.run("foodiva", "foodivaConfirm", values("41", "41", "0")),
    ).toThrow(/เกินยอด PO/);
    expect(() =>
      s.run("foodiva", "foodivaConfirm", values("40", "30", "5")),
    ).toThrow(/รวมเท่ากับ/);
  });

  test("smoke PO waits for the Packing List, takes the kg entered (no cap) and prices the service", () => {
    const s = setup();
    readyToDispatch(s, "30");
    const order = (rawKg = "32") =>
      s.run("owner", "smokeOrder", {
        requestedSmokeDate: day,
        smoker: "Chef House",
        rawKg,
      });
    expect(() => order()).toThrow(/รอ Foodiva ทำ Packing List/);
    dispatch(s);
    packingList(s, "15\n15");
    expect(() => order("0")).toThrow(/น้ำหนัก PO รมควัน/);
    // A6: pre-filled from the 30 kg Packing List but the Owner may order more.
    order();
    expect(last(s).values).toMatchObject({
      rawKg: "32",
      serviceRate: "220",
      estimatedCost: "7040",
      orderNumber: "SO-2026-0001",
      status: "Sent",
    });
    expect(() => order()).toThrow(/ออก PO รมควันของการส่งนี้แล้ว/);
    expect(() => packingList(s, "30")).toThrow(/แก้ไขไม่ได้/);
    expect(() =>
      s.run("cm", "smokingInvoice", {
        invoiceNumber: "CH-1",
        invoiceDate: day,
        attachment: "x",
      }),
    ).toThrow(/ปิดรอบ/);
  });

  test("Chef House bills its own amount and the Owner pays exactly that (A7)", () => {
    const s = closed();
    const bill = (netPayable: string, attachment = "ch.pdf") =>
      s.run("cm", "smokingInvoice", {
        invoiceNumber: "CH-9",
        invoiceDate: day,
        attachment,
        netPayable,
      });
    expect(() => bill("0")).toThrow(/ยอดเรียกเก็บค่ารมควัน/);
    expect(() => bill("10500", "")).toThrow(/Invoice ที่แนบ/);
    bill("10500");
    const sent = last(s);
    // The 50 kg smoke PO at ฿220 still shows as the reference quantity and amount.
    expect(sent.values).toMatchObject({
      serviceQuantity: "50",
      amountBeforeVat: "11000",
      netPayable: "10500",
    });
    s.run("owner", "invoiceReview", {
      invoiceId: sent.id,
      decision: "รับยอด",
      reviewedBy: "Owner",
    });
    const pay = (paidAmount: string) =>
      s.run("owner", "invoicePayment", {
        invoiceId: sent.id,
        paymentDate: day,
        paidBy: "Owner",
        paidAmount,
      });
    expect(() => pay("11000")).toThrow(/เท่ากับยอดสุทธิ/);
    pay("10500");
    expect(smokingInvoiceStatus(s.db, sent)).toBe("ชำระแล้ว");
  });

  test("smoking invoice goes from review to payment and cannot be paid twice", () => {
    const s = closed();
    const smokingInvoice = invoice(s);
    expect(smokingInvoice.values).toMatchObject({
      serviceQuantity: "50",
      serviceRate: "220",
      amountBeforeVat: "11000",
      netPayable: "11000",
      status: "Submitted",
    });
    const status = () => smokingInvoiceStatus(s.db, smokingInvoice);
    const review = (decision: string) =>
      s.run("owner", "invoiceReview", {
        invoiceId: smokingInvoice.id,
        decision,
        reviewedBy: "Owner",
      });
    const pay = (paidAmount: string) =>
      s.run("owner", "invoicePayment", {
        invoiceId: smokingInvoice.id,
        paymentDate: day,
        paidBy: "Owner",
        paidAmount,
      });
    expect(status()).toBe("รอตรวจยอด");
    review("ส่งกลับแก้ไข");
    expect(status()).toBe("ส่งกลับแก้ไข");
    expect(() => pay("11000")).toThrow(/ต้องรับยอด/);
    review("รับยอด");
    expect(status()).toBe("รอชำระ");
    expect(() => pay("10000")).toThrow(/เท่ากับยอดสุทธิ/);
    pay("11000");
    expect(status()).toBe("ชำระแล้ว");
    expect(() => review("รับยอด")).toThrow(/ชำระแล้ว/);
  });

  test("BUG-H: Chef House sees the Owner's reason for sending an invoice back, only while it is sent back", () => {
    const s = closed();
    const smokingInvoice = invoice(s);
    expect(smokingInvoiceRejection(s.db, smokingInvoice)).toBeUndefined();
    s.run("owner", "invoiceReview", {
      invoiceId: smokingInvoice.id,
      decision: "ส่งกลับแก้ไข",
      reviewedBy: "Owner",
      comment: "ยอดคลาดเคลื่อน",
    });
    expect(smokingInvoiceRejection(s.db, smokingInvoice)?.values.comment).toBe(
      "ยอดคลาดเคลื่อน",
    );
    // The review shows in Chef House history next to the Packing List and smoke PO it works
    // from; the purchase PO, the Request and the transport documents stay hidden.
    const chef = visibleEntries(s.db, "cm");
    expect(chef.filter((e) => e.role !== "cm").map((e) => e.kind)).toEqual([
      "packingList",
      "smokeOrder",
      "invoiceReview",
    ]);
    s.run("owner", "invoiceReview", {
      invoiceId: smokingInvoice.id,
      decision: "รับยอด",
      reviewedBy: "Owner",
    });
    expect(smokingInvoiceRejection(s.db, smokingInvoice)).toBeUndefined();
  });

  test("raw meat at Foodiva shrinks with owner waste pickups and legacy Steak transfers", () => {
    const s = setup();
    purchase(s, "40");
    confirm(s, "40", "30");
    const lot = () => s.db.lots[0];
    const id = lot().id;
    expect(rawAtFoodiva(s.db, lot())).toBe(40);
    expect(readyForChefHouse(s.db, id)).toBe(30);
    const pickup = (receivedKg: string) =>
      s.run("owner", "ownerWasteReceive", {
        receivedDate: "2026-09-10",
        receivedKg,
        receiver: "Owner",
      });
    expect(() => pickup("11")).toThrow(/เกินยอด/);
    pickup("4");
    expect(last(s).date).toBe("2026-09-10");
    expect(ownerWasteOutstanding(s.db, id)).toBe(6);
    // A8: the Owner's pickup leaves the PO's kg left to send (ready for Chiang Mai) alone.
    expect(poRemainingKg(s.db, id)).toBe(30);
    expect(rawAtFoodiva(s.db, lot())).toBe(36);
    // Legacy "steakTransfer" entries (no UI creates them now) still leave Foodiva.
    s.db.entries.push({
      ...last(s),
      id: "legacy-steak",
      kind: "steakTransfer",
      values: { quantityKg: "5" },
    });
    expect(rawAtFoodiva(s.db, lot())).toBe(31);
    // A Request leaves the beef at Foodiva until its truck goes; the shipment holds none itself.
    request(s, [[id, "10"]]);
    expect(rawAtFoodiva(s.db, lot())).toBe(31);
    dispatch(s);
    expect(rawAtFoodiva(s.db, lot())).toBe(21);
    expect(rawAtFoodiva(s.db, s.db.lots.at(-1)!)).toBe(0);
  });

  test("only Foodiva trucks a Request, and it carries the requested kg", () => {
    const t = setup();
    readyToDispatch(t, "40");
    expect(() => t.run("owner", "dispatch", send)).toThrow(/ไม่มีสิทธิ์/);
    expect(() => t.run("foodiva", "dispatch", send, t.db.lots[0].id)).toThrow(
      /ไม่ใช่ PO ซื้อ/,
    );
    t.run("foodiva", "dispatch", {
      ...send,
      trip: "เที่ยวเดียว",
      dispatchKg: "999",
    });
    const shipment = t.db.lots.at(-1)!;
    expect(shipment.stage).toBe(2);
    expect(shipment.values.dispatchKg).toBe("40");
    expect(shipment.values.outboundCost).toBe("1200");
    expect(last(t).values.transferNumber).toBe("TR-2026-0001");
    expect(t.db.lots[0].stage).toBe(1);
  });

  test("smoke batches validate bag weights and close the stage when the input is used up", () => {
    const s = setup();
    received(s, "50", "50", "49");
    s.run("cm", "prepare", { preSmokeKg: "48" });
    const lot = () => s.db.lots.at(-1)!;
    const id = lot().id;
    const smoke = (inputKg: string, wasteKg: string, bags: string) =>
      s.run("cm", "smoke", { smokeDate: day, inputKg, wasteKg, packs: bags });
    expect(() => smoke("0.1", "0", "0.1\nabc")).toThrow(/มากกว่า 0/);
    expect(() => smoke("10", "0", packs(50))).toThrow(/เท่ากับน้ำหนักเข้าเตา/);
    smoke("20", "5", packs(150));
    expect(lot().stage).toBe(4);
    expect(last(s).values).toMatchObject({
      postSmokeKg: "15.00",
      packCount: "150",
      subLot: "SB-2026-0001",
    });
    // 49 received − 48 prepared = 1 kg trim, which is loss rather than stock waiting at the smoker.
    expect(preSmokeTrimKg(s.db, lot())).toBe(1);
    expect(rawAtSmoker(s.db, lot())).toBe(28);
    expect(pendingSmokeKg(s.db, lot())).toBe(28);
    smoke("28", "7", packs(210));
    expect(lot().stage).toBe(5);
    expect(produced(s.db, id)).toBe(36);
    expect(producedBags(s.db, id)).toBe(360);
    expect(processLoss(s.db, id)).toBe(12);
    expect(averageYield(s.db)).toBe(75);
    expect(rawAtSmoker(s.db, lot())).toBe(0);
    expect(pendingSmokeKg(s.db, lot())).toBe(0);
  });

  test("a smoke batch saved before the postSmokeKg rename still counts its bags", () => {
    const s = setup();
    received(s, "50");
    s.run("cm", "prepare", { preSmokeKg: "50" });
    s.run("cm", "smoke", {
      smokeDate: day,
      inputKg: "50",
      wasteKg: "5",
      packs: packs(450),
    });
    const lot = s.db.lots.at(-1)!;
    const id = lot.id;
    delete last(s).values.postSmokeKg;
    delete lot.values.preSmokeKg;
    expect(produced(s.db, id)).toBeCloseTo(45);
    expect(processLoss(s.db, id)).toBeCloseTo(5);
    expect(averageYield(s.db)).toBeCloseTo(90);
    expect(pendingSmokeKg(s.db, lot)).toBe(0);
  });

  test("excess pre-smoke, over-smoke and incomplete close blocked", () => {
    const s = setup();
    received(s, "10");
    expect(() => s.run("cm", "prepare", { preSmokeKg: "11" })).toThrow(/เกิน/);
    s.run("cm", "prepare", { preSmokeKg: "10" });
    expect(() => s.run("cm", "closeLot", { confirm: "x" })).toThrow(/ขั้นตอน/);
    expect(() =>
      s.run("cm", "smoke", {
        inputKg: "11",
        wasteKg: "6",
        smokeDate: day,
        packs: packs(50),
      }),
    ).toThrow(/เกิน/);
  });

  test("chef edit before close validates in mutate, never touches the old database and is logged", () => {
    const s = smoked();
    const id = s.db.lots.at(-1)!.id;
    const smokes = s.db.entries.filter((item) => item.kind === "smoke");
    const draft = (item: Entry, change: Values = {}) => ({
      id: item.id,
      smokeDate: day,
      inputKg: item.values.inputKg,
      wasteKg: item.values.wasteKg,
      packs: item.values.packs,
      ...change,
    });
    const edit = (values: Values, drafts: ReturnType<typeof draft>[]) =>
      s.run(
        "cm",
        "chefEdit",
        {
          arrival: "08:00",
          preSmokeKg: "48",
          ...values,
          batches: JSON.stringify(drafts),
        },
        id,
      );
    expect(() => s.run("owner", "chefEdit", {}, id)).toThrow(/ไม่มีสิทธิ์/);
    expect(() =>
      edit({}, [draft(smokes[0], { wasteKg: "4" }), draft(smokes[1])]),
    ).toThrow(/เท่ากับน้ำหนักเข้าเตา/);
    expect(() =>
      edit(
        { preSmokeKg: "47" },
        smokes.map((item) => draft(item)),
      ),
    ).toThrow(/น้ำหนักก่อนสโมค/);
    expect(() => edit({}, [draft(smokes[0])])).toThrow(/ไม่พบข้อมูล Lot/);
    const before = s.db;
    edit({}, [
      draft(smokes[0], { wasteKg: "4", packs: packs(160) }),
      draft(smokes[1]),
    ]);
    expect(
      before.entries.find((item) => item.id === smokes[0].id)!.values.wasteKg,
    ).toBe("5");
    // save_app_state refuses any change to existing entries.
    expect(s.db.entries.slice(0, before.entries.length)).toEqual(
      before.entries,
    );
    expect(entries(s.db, "smoke", id)[0].values.wasteKg).toBe("4");
    expect(produced(s.db, id)).toBe(37);
    expect(last(s).kind).toBe("chefEdit");
    expect(s.db.lots.at(-1)!.stage).toBe(5);
    s.run("cm", "closeLot", { confirm: "x" }, id);
    expect(() =>
      edit(
        {},
        smokes.map((item) => draft(item)),
      ),
    ).toThrow(/ก่อนยืนยันปิด Lot/);
  });

  test("allocating by kg: 500 + 200 of 700 kg, received in parts, over-allocation refused", () => {
    const s = returned();
    s.run("owner", "central", { centralKg: "700", reason: "ทดสอบ" });
    const id = s.db.lots.at(-1)!.id;
    s.run("owner", "allocate", {
      branch: "ศาลาแดง",
      kg: "500",
      deliveryDate: day,
    });
    const sala = last(s);
    s.run("owner", "allocate", {
      branch: "มีนบุรี",
      kg: "150",
      deliveryDate: day,
    });
    expect(centralStock(s.db, id)).toBe(50);
    expect(() =>
      s.run("owner", "allocate", { branch: "มีนบุรี", kg: "50.01" }),
    ).toThrow(/สต๊อกกลางไม่พอ/);
    s.run("owner", "allocate", { branch: "มีนบุรี", kg: "50" });
    expect(centralStock(s.db, id)).toBe(0);
    s.run("branch", "receive", {
      kg: "300",
      allocation: sala.id,
      reason: "ทยอยรับ",
    });
    expect(allocationOutstanding(s.db, sala)).toBe(200);
    s.run("branch", "receive", { kg: "200", allocation: sala.id });
    expect(allocationOutstanding(s.db, sala)).toBe(0);
    expect(pendingReceiveKg(s.db, id, "ศาลาแดง")).toBe(0);
    expect(() =>
      s.run("branch", "receive", { kg: "1", allocation: sala.id, reason: "x" }),
    ).toThrow(/รับเกินยอดค้างรับ/);
  });

  test("a receive marked complete closes the allocation on a shortfall, with a reason", () => {
    const s = returned();
    s.run("owner", "central", { centralKg: "700", reason: "ทดสอบ" });
    const id = s.db.lots.at(-1)!.id;
    s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "500" });
    const sala = last(s);
    expect(() =>
      s.run("branch", "receive", {
        kg: "499.5",
        allocation: sala.id,
        complete: "1",
      }),
    ).toThrow(/เหตุผลส่วนต่าง/);
    s.run("branch", "receive", {
      kg: "499.5",
      allocation: sala.id,
      complete: "1",
      reason: "น้ำหนักหายระหว่างขนส่ง",
    });
    expect(allocationOutstanding(s.db, sala)).toBe(0);
    expect(pendingReceiveKg(s.db, id, "ศาลาแดง")).toBe(0);
    expect(balance(s.db, id, "ศาลาแดง").received).toBe(499.5);
  });

  test("over-allocation, over-thaw and cross-branch receive rejected", () => {
    const s = ready();
    expect(() =>
      s.run("owner", "allocate", { branch: "มีนบุรี", kg: "36" }),
    ).toThrow(/ไม่พอ/);
    s.run("owner", "allocate", { branch: "มีนบุรี", kg: "5" });
    expect(() =>
      s.run("branch", "receive", {
        kg: "5",
        allocation: last(s).id,
      }),
    ).toThrow(/ไม่ได้จัดสรร/);
    s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5" });
    s.run("branch", "receive", { kg: "5", allocation: last(s).id });
    expect(() => s.run("branch", "thaw", { kg: "6" })).toThrow(/ไม่พอ/);
  });
});

describe("branch supplies", () => {
  test("materials move from owner stock to a branch only after the branch confirms", () => {
    const material = materials[0];
    expect(() =>
      mutate(
        seed,
        "owner",
        "materialTransfer",
        { material, branch: "ศาลาแดง", quantity: "1", receiver: "x" },
        "",
        day,
      ),
    ).toThrow(/ตั้งจำนวนฐาน/);
    const s = setup();
    s.run("owner", "materialReceive", {
      purchaseDate: "2026-09-08",
      material,
      quantity: "10",
      unitPrice: "2",
      supplier: "x",
    });
    expect(last(s)).toMatchObject({
      date: "2026-09-08",
      values: { totalCost: "20" },
    });
    expect(ownerMaterialStock(s.db, material)).toBe(10);
    const transfer = (quantity: string) =>
      s.run("owner", "materialTransfer", {
        material,
        branch: "ศาลาแดง",
        quantity,
        receiver: "x",
      });
    expect(() => transfer("11")).toThrow(/ไม่พอ/);
    transfer("6");
    const transferId = last(s).id;
    expect(ownerMaterialStock(s.db, material)).toBe(4);
    expect(branchMaterialStock(s.db, "ศาลาแดง", 0)).toBe(0);
    const receive = (values: Values) =>
      s.run("branch", "materialConfirm", {
        transferId,
        receivedQuantity: "5",
        receiver: "x",
        ...values,
      });
    expect(() => receive({})).toThrow(/เหตุผลส่วนต่าง/);
    receive({ reason: "ขาด 1" });
    expect(branchMaterialStock(s.db, "ศาลาแดง", 0)).toBe(5);
    expect(() => receive({ reason: "ซ้ำ" })).toThrow(/ยืนยันรับรายการนี้แล้ว/);
  });

  test("a wrong material count can be saved over, and every round stays in the log", () => {
    const s = setup();
    s.run("owner", "materialReceive", {
      purchaseDate: day,
      material: materials[0],
      quantity: "100",
      unitPrice: "1",
      supplier: "x",
    });
    s.run("owner", "materialTransfer", {
      material: materials[0],
      branch: "ศาลาแดง",
      quantity: "100",
      receiver: "x",
    });
    s.run("branch", "materialConfirm", {
      transferId: last(s).id,
      receivedQuantity: "100",
      receiver: "x",
    });
    const sheet = (used: string, extra: Values = {}): Values => ({
      ...Object.fromEntries(
        materials.flatMap((_, i) => [
          ["opening" + i, i === 0 ? "100" : "0"],
          ["used" + i, i === 0 ? used : "0"],
          ["material" + i, i === 0 ? String(100 - Number(used)) : "0"],
        ]),
      ),
      ...extra,
    });
    s.run("branch", "materials", sheet("0")); // the accidental empty save
    expect(() => s.run("branch", "materials", sheet("40"))).toThrow(/เหตุผล/);
    s.run("branch", "materials", sheet("40", { correctionReason: "กรอกผิด" }));
    expect(last(s).values.revision).toBe("2");
    expect(entries(s.db, "materials", undefined, "ศาลาแดง", day)).toHaveLength(
      2,
    );
    // Only the newest sheet of the day counts, so the fix does not deduct twice.
    expect(branchMaterialStock(s.db, "ศาลาแดง", 0, "2026-09-10")).toBe(60);
  });

  // B2: every rice purchase picks self-cook or bought-cooked, at either branch.
  test.each(["ศาลาแดง", "มีนบุรี"])(
    "%s self-cooks: raw 10 kg in, cooked 14 kg out saves",
    (branch) => {
      const s = setup(branch);
      expect(() =>
        s.run("branch", "ricePurchase", {
          supplier: "x",
          rawRiceKg: "10",
          rawRiceCost: "500",
        }),
      ).toThrow(/ที่มาของข้าว/);
      s.run("branch", "ricePurchase", {
        riceSource: riceSources[0],
        supplier: "x",
        rawRiceKg: "10",
        rawRiceCost: "500",
        // Typed before the choice switched: the self-cook round ignores it.
        cookedRiceKg: "5",
      });
      expect(last(s).values).toMatchObject({
        totalCost: "500",
        cookedRiceKg: "0",
      });
      s.run("branch", "riceIssue", { rawRiceIssuedKg: "10", receiver: "x" });
      s.run("branch", "rice", { rawUsedKg: "10", riceKg: "14" });
      expect(rawRiceStock(s.db, branch)).toBe(0);
      expect(cookedRiceStock(s.db, branch)).toBe(14);
      expect(requiredRiceKinds(s.db, branch, day)).toEqual([
        "rice",
        "riceCarry",
      ]);
    },
  );

  test.each(["ศาลาแดง", "มีนบุรี"])(
    "%s buys cooked rice: no raw weight, no par floor",
    (branch) => {
      const s = setup(branch);
      expect(() =>
        s.run("branch", "ricePurchase", {
          riceSource: riceSources[1],
          supplier: "x",
          rawRiceKg: "10",
          rawRiceCost: "500",
        }),
      ).toThrow(/ข้าวเหนียวสุก/);
      // Below cookedRicePar (30 kg): a hint in the form, not a block.
      s.run("branch", "ricePurchase", {
        riceSource: riceSources[1],
        supplier: "ครัวข้าวเหนียว",
        cookedRiceKg: "12",
        cookedRiceCost: "540",
      });
      expect(last(s).values).toMatchObject({
        rawRiceKg: "0",
        totalCost: "540",
      });
      expect(cookedRiceStock(s.db, branch)).toBe(12);
      expect(requiredRiceKinds(s.db, branch, day)).toEqual(["riceCarry"]);
      s.run("branch", "riceCarry", {
        leftoverKg: "12",
        reheat: "เก็บไว้อุ่นวันถัดไป",
      });
      expect(last(s).values.reheat).toBe("เก็บไว้อุ่นวันถัดไป");
    },
  );

  test("closeDay asks for the rice records that match what the branch did", () => {
    const closeWith = (db: Database) =>
      mutate(
        db,
        "branch",
        "closeDay",
        { time: "22:00", confirm: "x" },
        "",
        day,
        "มีนบุรี",
      );
    const withDay = (...kinds: string[]) =>
      withEntries(
        ...["sale", "materials", ...kinds].map((kind) =>
          entry({
            kind,
            branch: "มีนบุรี",
            values: kind === "riceIssue" ? { rawRiceIssuedKg: "2" } : {},
          }),
        ),
      );
    expect(() => closeWith(withDay())).toThrow(
      /ยังไม่ยืนยันข้าวเหนียวสุกคงเหลือ/,
    );
    expect(() => closeWith(withDay("riceCarry"))).not.toThrow();
    expect(() => closeWith(withDay("riceIssue", "riceCarry"))).toThrow(
      /ยังไม่บันทึกข้าวช่วงเช้า/,
    );
    expect(() =>
      closeWith(withDay("riceIssue", "rice", "riceCarry")),
    ).not.toThrow();
  });

  test("closeDayChecklist is the rule mutate closes by", () => {
    const s = ready();
    s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5" });
    s.run("branch", "receive", { kg: "5", allocation: last(s).id });
    s.run("branch", "thaw", { kg: "5" });
    const missing = () =>
      closeDayChecklist(s.db, "ศาลาแดง", day).filter(
        (item) => item.required && !item.done,
      );
    expect(missing().map((item) => item.key)).toEqual([
      "sale",
      "materials",
      "riceCarry",
    ]);
    // Blocked with the checklist's own message for its first missing item.
    expect(() => s.run("branch", "closeDay", { confirm: "x" })).toThrow(
      missing()[0].message,
    );
    expect(missing()[0].message).toMatch(/รายการขาย/);
    // The chill line is information only, never a blocker.
    expect(
      closeDayChecklist(s.db, "ศาลาแดง", day).find((i) => i.key === "chill"),
    ).toMatchObject({ required: false, done: true });
    // Giveaways are entered inside the close itself, so they are no longer a line here.
    expect(
      closeDayChecklist(s.db, "ศาลาแดง", day).map((i) => i.key),
    ).not.toContain("influencerBox");
    s.run("branch", "sale", {
      boxes: "0",
      addons: "40",
      chiliAddons: "0",
      soldKg: "4",
      wasteKg: "0",
      riceWasteKg: "0",
      expense: "0",
      lineMan: "12800",
    });
    s.run(
      "branch",
      "materials",
      Object.fromEntries(materials.map((_, i) => [`material${i}`, "10"])),
    );
    expect(() => s.run("branch", "closeDay", { confirm: "x" })).toThrow(
      missing()[0].message,
    );
    s.run("branch", "riceCarry", { leftoverKg: "0", reheat: "ไม่นำกลับมาใช้" });
    expect(missing()).toEqual([]);
    // No close-time rule any more (FB-14): 09:00 closes like 22:00 did.
    s.run("branch", "closeDay", { time: "09:00", confirm: "x" });
    expect(isClosed(s.db, "ศาลาแดง", day)).toBe(true);
    // A closed day refuses every branch entry, and a second close.
    for (const kind of ["riceCarry", "closeDay"])
      expect(() =>
        s.run("branch", kind, {
          leftoverKg: "0",
          reheat: "ไม่นำกลับมาใช้",
          confirm: "x",
        }),
      ).toThrow(/ปิดยอดแล้ว/);
  });

  test("sales deviation validation", () => {
    const s = ready();
    s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5" });
    s.run("branch", "receive", { kg: "5", allocation: last(s).id });
    s.run("branch", "thaw", { kg: "5" });
    expect(() =>
      s.run("branch", "sale", {
        boxes: "10",
        addons: "0",
        chiliAddons: "0",
        soldKg: "6",
        wasteKg: "0",
        riceWasteKg: "0",
        expense: "0",
        lineMan: "3500",
      }),
    ).toThrow(/เกินเนื้อที่ละลายแล้ว/);
  });
});

/** ศาลาแดง on `day`: 5 kg thawed, 10 kg cooked rice, 5 chili tubes — everything an
 *  influencer giveaway draws on. */
function giveawayReady() {
  const s = ready();
  s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5" });
  s.run("branch", "receive", { kg: "5", allocation: last(s).id });
  s.run("branch", "thaw", { kg: "5" });
  s.run("branch", "ricePurchase", {
    riceSource: riceSources[0],
    supplier: "ตลาดศาลาแดง",
    rawRiceKg: "10",
    rawRiceCost: "500",
  });
  s.run("branch", "riceIssue", { rawRiceIssuedKg: "4", receiver: "ผู้ดูแล" });
  s.run("branch", "rice", { rawUsedKg: "4", riceKg: "10" });
  s.run("owner", "generalPurchase", {
    purchaseDate: day,
    item: "น้ำพริกหลอด",
    purchaseCategory: "วัตถุดิบ",
    quantity: "10",
    unitPrice: "6",
    supplier: "ผู้ผลิตน้ำพริก",
  });
  s.run("owner", "chiliAllocate", { branch: "ศาลาแดง", chiliTubes: "5" });
  return s;
}

const box = {
  influencer: "@nong",
  boxes: "2",
  chiliAddons: "1",
  shippingFee: "60",
};

test("an influencer box leaves the shelf and costs meat plus postage", () => {
  const s = giveawayReady();
  const id = s.db.lots.at(-1)!.id;
  expect(() =>
    s.run("branch", "influencerBox", { ...box, influencer: "" }),
  ).toThrow(/อินฟลูเอนเซอร์/);
  expect(() =>
    s.run("branch", "influencerBox", { ...box, boxes: "50" }),
  ).toThrow(/เกินเนื้อที่ละลายแล้ว/);
  expect(() =>
    s.run("branch", "influencerBox", { ...box, chiliAddons: "6" }),
  ).toThrow(/น้ำพริก/);
  // The kg is derived from the box count, so whatever the form sends is overwritten.
  s.run("branch", "influencerBox", { ...box, soldKg: "9", addons: "7" });
  expect(last(s).values.soldKg).toBe(String(2 * Number(seed.config.packKg)));
  expect(last(s).values.addons).toBe("0");
  expect(balance(s.db, id, "ศาลาแดง").ready).toBeCloseTo(4.797, 3);
  expect(cookedRiceStock(s.db, "ศาลาแดง")).toBeCloseTo(9.6, 3);
  expect(chiliStock(s.db, "ศาลาแดง")).toBe(4);
  expect(Number(last(s).values.meatCost)).toBeGreaterThan(0);
  // Owner-only: the branch log never shows what the giveaway cost.
  expect(
    visibleEntries(s.db, "branch", "ศาลาแดง").at(-1)!.values.meatCost,
  ).toBeUndefined();
});

/** giveawayReady, plus the sale, materials and rice the close insists on. */
function closeReady() {
  const s = giveawayReady();
  // 45 boxes sold: 1 kg of meat and 9 of the 10 kg of cooked rice are gone, so a
  // giveaway added at the close is short of rice before it is short of meat.
  s.run("branch", "sale", {
    boxes: "45",
    addons: "0",
    chiliAddons: "0",
    soldKg: "1",
    wasteKg: "0",
    riceWasteKg: "0",
    expense: "0",
    lineMan: "9450",
  });
  s.run(
    "branch",
    "materials",
    Object.fromEntries(materials.map((_, i) => [`material${i}`, "10"])),
  );
  s.run("branch", "riceCarry", {
    leftoverKg: String(cookedRiceStock(s.db, "ศาลาแดง")),
    reheat: "เก็บไว้อุ่นวันถัดไป",
  });
  return s;
}

const giveaway = (lotId: string, values: Values) => ({ lotId, values });

describe("closing the day with influencer giveaways", () => {
  test("two giveaways are written first, then the close", () => {
    const s = closeReady();
    const id = s.db.lots.at(-1)!.id;
    const before = s.db.entries.length;
    const db = closeDayWithInfluencers(
      s.db,
      "ศาลาแดง",
      day,
      [
        giveaway(id, { ...box, influencer: "@a" }),
        giveaway(id, { ...box, influencer: "@b", boxes: "1" }),
      ],
      { confirm: "ผู้ดูแล" },
    );
    expect(db.entries.slice(before).map((e) => e.kind)).toEqual([
      "influencerBox",
      "influencerBox",
      "closeDay",
    ]);
    expect(
      entries(db, "influencerBox", undefined, "ศาลาแดง", day).map(
        (e) => e.values.influencer,
      ),
    ).toEqual(["@a", "@b"]);
    // Each giveaway's kg follows its own box count.
    expect(
      entries(db, "influencerBox", undefined, "ศาลาแดง", day).map(
        (e) => e.values.soldKg,
      ),
    ).toEqual([
      String(2 * Number(seed.config.packKg)),
      String(1 * Number(seed.config.packKg)),
    ]);
    expect(isClosed(db, "ศาลาแดง", day)).toBe(true);
  });

  test("an invalid giveaway leaves the day open and writes nothing", () => {
    const s = closeReady();
    const id = s.db.lots.at(-1)!.id;
    const before = s.db.entries.length;
    for (const [bad, reason] of [
      [{ ...box, boxes: "60" }, /เกินเนื้อที่ละลายแล้ว/], // more meat than is thawed
      [{ ...box, boxes: "4" }, /ข้าวเหนียวไม่พอ/], // meat is enough, cooked rice is not
      [{ ...box, chiliAddons: "9" }, /น้ำพริก/], // more chili than was allocated
    ] as [Values, RegExp][]) {
      const save = () =>
        closeDayWithInfluencers(
          s.db,
          "ศาลาแดง",
          day,
          [giveaway(id, box), giveaway(id, bad)],
          { confirm: "ผู้ดูแล" },
        );
      // The message says which block was refused, and why.
      expect(save).toThrow(/อินฟลูเอนเซอร์ที่ 2 \(@nong\)/);
      expect(save).toThrow(reason);
    }
    expect(s.db.entries.length).toBe(before);
    expect(entries(s.db, "influencerBox", undefined, "ศาลาแดง", day)).toEqual(
      [],
    );
    expect(isClosed(s.db, "ศาลาแดง", day)).toBe(false);
  });

  test("no giveaway: the save is the plain closeDay it always was", () => {
    const s = closeReady();
    const plain = closeDayWithInfluencers(s.db, "ศาลาแดง", day, [], {
      confirm: "ผู้ดูแล",
    });
    const direct = mutate(
      s.db,
      "branch",
      "closeDay",
      { confirm: "ผู้ดูแล" },
      "",
      day,
      "ศาลาแดง",
    );
    const tail = (db: Database) => {
      const { id, at, ...rest } = db.entries.at(-1)!;
      return { count: db.entries.length, ...rest, id: !!id, at: !!at };
    };
    expect(tail(plain)).toEqual(tail(direct));
    expect(isClosed(plain, "ศาลาแดง", day)).toBe(true);
  });
});

test("full loop: partial smoke, central, two branches, partial receipt, sale and lock", () => {
  const s = ready();
  const id = s.db.lots.at(-1)!.id;
  expect(produced(s.db, id)).toBe(36);
  expect(s.db.lots.at(-1)!.stage).toBe(8);
  expect(lotCost(s.db, s.db.lots.at(-1)!).freight).toBe(2000);
  s.run("owner", "allocate", {
    branch: "ศาลาแดง",
    kg: "10",
    deliveryDate: day,
  });
  const allocation = last(s).id;
  s.run("owner", "allocate", {
    branch: "มีนบุรี",
    kg: "5",
    deliveryDate: day,
  });
  expect(centralStock(s.db, id)).toBe(20);
  s.run("branch", "receive", {
    kg: "4",
    allocation,
    reason: "ทยอยรับ",
  });
  s.run("branch", "receive", { kg: "6", allocation });
  s.run("branch", "thaw", { kg: "4.2" });
  s.run("branch", "ricePurchase", {
    riceSource: riceSources[0],
    supplier: "ตลาดศาลาแดง",
    rawRiceKg: "10",
    rawRiceCost: "500",
  });
  s.run("owner", "generalPurchase", {
    purchaseDate: day,
    item: "น้ำพริกหลอด",
    purchaseCategory: "วัตถุดิบ",
    quantity: "50",
    unitPrice: "6",
    supplier: "ผู้ผลิตน้ำพริก",
  });
  s.run("owner", "chiliAllocate", { branch: "ศาลาแดง", chiliTubes: "50" });
  s.run("branch", "riceIssue", { rawRiceIssuedKg: "4", receiver: "ผู้ดูแล" });
  s.run("branch", "rice", { rawUsedKg: "4", riceKg: "10" });
  expect(rawRiceStock(s.db, "ศาลาแดง")).toBe(6);
  expect(issuedRawRiceStock(s.db, "ศาลาแดง")).toBe(0);
  expect(cookedRiceStock(s.db, "ศาลาแดง")).toBe(10);
  expect(chiliStock(s.db, "ศาลาแดง")).toBe(50);
  s.run("branch", "sale", {
    boxes: "40",
    addons: "0",
    chiliAddons: "2",
    soldKg: "4",
    wasteKg: ".2",
    riceWasteKg: "0",
    expense: "10",
    payer: "ผู้ดูแล",
    lineMan: "14060",
    reason: "เนื้อเหลือปิดวัน",
  });
  expect(chiliStock(s.db, "ศาลาแดง")).toBe(48);
  expect(Math.abs(balance(s.db, id, "ศาลาแดง").ready)).toBeLessThan(0.001);
  expect(balance(s.db, id, "ศาลาแดง").frozen).toBe(5.8);
  expect(balance(s.db, id, "มีนบุรี").received).toBe(0);
  for (let i = 0; i < 7; i++) {
    s.db.config["material" + i] = "500";
    s.run("owner", "materialReceive", {
      purchaseDate: day,
      material: materials[i],
      quantity: "1000",
      unitPrice: "1",
      supplier: "ผู้ขายวัสดุ",
    });
    s.run("owner", "materialTransfer", {
      material: materials[i],
      branch: "ศาลาแดง",
      quantity: "500",
      receiver: "ผู้ดูแล",
    });
    s.run("branch", "materialConfirm", {
      transferId: last(s).id,
      receivedQuantity: "500",
      receiver: "ผู้ดูแล",
    });
  }
  s.run(
    "branch",
    "materials",
    Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [
        ["opening" + i, "500"],
        ["used" + i, "50"],
        ["material" + i, "450"],
      ]).flat(),
    ),
  );
  expect(last(s).values.material0).toBe("450");
  expect(() =>
    s.run("branch", "closeDay", { time: "22:00", confirm: "ผู้ดูแล" }),
  ).toThrow(/ยังไม่ยืนยันข้าวเหนียวสุกคงเหลือ/);
  s.run("branch", "riceCarry", {
    leftoverKg: String(cookedRiceStock(s.db, "ศาลาแดง")),
    reheat: "เก็บไว้อุ่นวันถัดไป",
  });
  s.run("branch", "closeDay", { time: "22:00", confirm: "ผู้ดูแล" });
  expect(isClosed(s.db, "ศาลาแดง", day)).toBe(true);
  expect(() => s.run("branch", "thaw", { kg: "1" })).toThrow(/ปิดยอด/);
  expect(
    visibleEntries(s.db, "branch", "ศาลาแดง").every(
      (item) => !("meatCost" in item.values),
    ),
  ).toBe(true);
  expect(visibleEntries(s.db, "cm").some((item) => item.kind === "sale")).toBe(
    false,
  );
  expect(JSON.parse(JSON.stringify(s.db))).toEqual(s.db);
});

test("seven-day roleplay replays every role through mutate", () => {
  const db = sevenDayRoleplay(day);
  // One purchase PO (stays at stage 1) and the one shipment built from it.
  expect(db.lots.map((lot) => [lot.kind, lot.stage])).toEqual([
    [undefined, 1],
    ["shipment", 8],
  ]);
  expect(entries(db, "meatPayment")).toHaveLength(1);
  expect(entries(db, "closeDay")).toHaveLength(14);
  for (const branch of branches) expect(isClosed(db, branch, day)).toBe(true);
  expect(db.config.branch).toBe("ศาลาแดง");
});

describe("backdated entries", () => {
  test("a stage step cannot be dated before the lot's latest entry", () => {
    const s = setup();
    readyToDispatch(s, "50");
    expect(() =>
      mutate(
        s.db,
        "foodiva",
        "dispatch",
        send,
        s.db.lots.at(-1)!.id,
        "2026-09-01",
      ),
    ).toThrow(`วันที่ต้องไม่ก่อนขั้นตอนก่อนหน้าของ Lot นี้ (${day})`);
  });

  test("a backdated stage step on or after the previous step still saves", () => {
    const s = setup();
    readyToDispatch(s, "50");
    const backdated = "2026-09-10"; // after `day`, before the real today
    const db = mutate(
      s.db,
      "foodiva",
      "dispatch",
      send,
      s.db.lots.at(-1)!.id,
      backdated,
    );
    expect(db.lots.at(-1)!.stage).toBe(2);
    expect(db.entries.at(-1)!.date).toBe(backdated);
  });

  test("a non-stage entry cannot predate the lot's PO", () => {
    const s = setup();
    purchase(s, "40");
    expect(() =>
      mutate(
        s.db,
        "foodiva",
        "foodivaConfirm",
        {
          invoiceNo: "INV-1",
          invoiceDate: day,
          attachment: "inv.pdf",
          confirmedBy: "Foodiva",
          confirmedKg: "40",
          readyForChiangMaiKg: "40",
          reservedForOwnerKg: "0",
          invoiceAmount: "1",
        },
        s.db.lots[0].id,
        "2026-09-01",
      ),
    ).toThrow(`วันที่ต้องไม่ก่อนวันเปิด PO ของ Lot นี้ (${day})`);
  });
});

describe("chill carryover", () => {
  const nextDay = "2026-09-10";
  const branch = "ศาลาแดง";
  const lotOf = (db: Database) => db.lots.at(-1)!.id;

  test("a day closes with 4.5 kg left, which carries into tomorrow as chill", () => {
    const s = chillDay();
    const id = lotOf(s.db);
    expect(branchMeatDay(s.db, id, branch, day)).toEqual({
      chillIn: 0,
      thawed: 70,
      used: 65.5,
      waste: 0,
      chillOut: 4.5,
      pending: 0,
      received: 70,
      frozen: 0,
      usedTotal: 65.5,
    });
    // The close only needs today's checklist; leftover meat is not an error.
    const checklist = {
      ...s.db,
      entries: [
        ...s.db.entries,
        entry({ kind: "materials", date: day }),
        entry({ kind: "riceCarry", date: day }),
      ],
    };
    const closedDb = mutate(
      checklist,
      "branch",
      "closeDay",
      { time: "22:00", confirm: "ผู้ดูแล" },
      "",
      day,
      branch,
    );
    expect(isClosed(closedDb, branch, day)).toBe(true);
    expect(branchMeatDay(closedDb, id, branch, nextDay)).toMatchObject({
      chillIn: 4.5,
      thawed: 0,
      chillOut: 4.5,
    });
    const used = mutate(
      closedDb,
      "branch",
      "sale",
      {
        boxes: "0",
        addons: "45",
        chiliAddons: "0",
        soldKg: "4.5",
        wasteKg: "0",
        riceWasteKg: "0",
        expense: "0",
        lineMan: "14400",
      },
      id,
      nextDay,
      branch,
    );
    expect(branchMeatDay(used, id, branch, nextDay)).toMatchObject({
      chillIn: 4.5,
      used: 4.5,
      chillOut: 0,
    });
    expect(balance(used, id, branch).ready).toBeCloseTo(0, 6);
  });

  test("stock as of a past date follows the entry log, not today's totals", () => {
    const s = chillDay();
    const id = lotOf(s.db);
    // Day 2: the last 2 kg of central stock allocated, 1.5 kg received, 1 kg thawed.
    const run = (db: Database, role: Role, kind: string, values: Values) =>
      mutate(db, role, kind, values, id, nextDay, branch);
    let db = run(s.db, "owner", "allocate", {
      branch,
      kg: "2",
      deliveryDate: nextDay,
    });
    db = run(db, "branch", "receive", {
      kg: "1.5",
      allocation: db.entries.at(-1)!.id,
    });
    db = run(db, "branch", "thaw", { kg: "1" });
    expect(branchMeatDay(db, id, branch, day)).toMatchObject({
      pending: 0,
      received: 70,
      frozen: 0,
      chillOut: 4.5,
      usedTotal: 65.5,
    });
    const two = branchMeatDay(db, id, branch, nextDay);
    expect(two).toMatchObject({ chillIn: 4.5, thawed: 1, usedTotal: 65.5 });
    expect(two.pending).toBeCloseTo(0.5, 6);
    expect(two.received).toBeCloseTo(71.5, 6);
    expect(two.frozen).toBeCloseTo(0.5, 6);
    expect(two.chillOut).toBeCloseTo(5.5, 6);
    // Today's totals agree with the last day.
    expect(balance(db, id, branch).frozen).toBeCloseTo(two.frozen, 6);
    expect(balance(db, id, branch).ready).toBeCloseTo(two.chillOut, 6);
  });

  test("95 g per pack saves and only warns", () => {
    const s = ready();
    s.run("owner", "allocate", { branch, kg: "5" });
    s.run("branch", "receive", { kg: "5", allocation: last(s).id });
    s.run("branch", "thaw", { kg: "5" });
    const sale = {
      boxes: "0",
      addons: "10",
      chiliAddons: "0",
      soldKg: "0.95",
      wasteKg: "0",
      riceWasteKg: "0",
      expense: "0",
      lineMan: "3200",
    };
    expect(packWeightWarning(sale)).toMatch(/95\.0 กรัม/);
    expect(packWeightWarning({ ...sale, soldKg: "1.01" })).toBe("");
    s.run("branch", "sale", sale);
    expect(last(s).values.soldKg).toBe("0.95");
    expect(balance(s.db, lotOf(s.db), branch).ready).toBeCloseTo(4.05, 6);
  });
});
