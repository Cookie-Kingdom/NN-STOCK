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
  cookedRiceStock,
  entries,
  entryBy,
  isClosed,
  issuedRawRiceStock,
  lotCost,
  poMatched,
  materialPar,
  materials,
  mutate,
  ownerChiliStock,
  ownerPendingInvoices,
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
  saleWithInfluencers,
  seed,
  smokeServiceRate,
  smokingInvoiceRejection,
  smokingInvoiceStatus,
  validPackWeights,
  visibleEntries,
  type Database,
  type Entry,
  type Lot,
  type ActingRole,
  type Values,
  type EntryKind,
  check,
  lotProgress,
  saleCost,
  batchKinds,
} from "@/lib/store";
import { sevenDayRoleplay } from "@/lib/store/demo";
import {
  expectWarning,
  closed,
  confirm,
  day,
  dispatch,
  invoice,
  last,
  legacyAllocate,
  legacyReceive,
  packingList,
  packs,
  purchase,
  chillDay,
  ready,
  readyToDispatch,
  received,
  returned,
  send,
  setup,
  smoked,
  smokeOrder,
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
    // Cooked rice is per day (B2): that day's stock, nothing carried to the next.
    expect(cookedRiceStock(db, "ศาลาแดง", day)).toBe(4);
    expect(cookedRiceStock(db, "ศาลาแดง", "2026-09-10")).toBe(0);
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

  test("a day stays closed until an unlock later in the log than the last close", () => {
    const close = entry({ kind: "closeDay", at: "2000-01-01T10:00:00.000Z" });
    // Device clocks differ, so `at` does not decide: an unlock stamped earlier still counts.
    const unlock = entry({
      kind: "unlock",
      role: "owner",
      at: "2000-01-01T09:00:00.000Z",
    });
    expect(isClosed(withEntries(close), "ศาลาแดง", day)).toBe(true);
    expect(isClosed(withEntries(close), "มีนบุรี", day)).toBe(false);
    expect(isClosed(withEntries(close), "ศาลาแดง", "2026-09-10")).toBe(false);
    expect(isClosed(withEntries(unlock, close), "ศาลาแดง", day)).toBe(true);
    expect(isClosed(withEntries(close, unlock), "ศาลาแดง", day)).toBe(false);
  });

  test("DASH-03 lot cost adds meat, smoking and freight; per kg needs central stock", () => {
    const lot: Lot = {
      id: "L1",
      poId: "SH-1",
      kind: "shipment",
      config: {},
      values: { outboundCost: "2000", returnCost: "0" },
    };
    const po: Lot = {
      id: "P1",
      poId: "PO-1",
      config: {},
      values: { price: "250" },
    };
    // The meat comes from the smoke PO's lines (the lot cache is only a copy of them).
    const order = entry({
      kind: "smokeOrder",
      role: "owner",
      lotId: "L1",
      values: {
        estimatedCost: "2200",
        lines: JSON.stringify([{ lotId: "P1", kg: "10" }]),
      },
    });
    const db = { ...withEntries(order), lots: [po, lot] };
    expect(lotCost(db, lot)).toEqual({
      meat: 2500,
      meatMatched: true,
      smoke: 2200,
      smokingCostSource: "estimate",
      freight: 2000,
      total: 6700,
      perKg: 0,
    });
    expect(
      lotCost(db, { ...lot, values: { ...lot.values, centralKg: "10" } }).perKg,
    ).toBe(670);
    expect(poMatched(db, "L1")).toBe(true);
  });

  test("RET-07 a batch whose smoke PO names no purchase PO is unmatched: its cost leaves the meat out", () => {
    const lot: Lot = {
      id: "L1",
      poId: "SH-1",
      kind: "shipment",
      config: {},
      values: { outboundCost: "2000", returnCost: "0", centralKg: "10" },
    };
    const order = entry({
      kind: "smokeOrder",
      role: "owner",
      lotId: "L1",
      values: { estimatedCost: "2200", lines: "[]" },
    });
    const db = { ...withEntries(order), lots: [lot] };
    expect(poMatched(db, "L1")).toBe(false);
    expect(lotCost(db, lot)).toMatchObject({
      meat: 0,
      meatMatched: false,
      total: 4200,
      perKg: 420,
    });
    // No batch at all is not matched either.
    expect(poMatched(db, "nope")).toBe(false);
  });

  test("D8 the smoking fee is the latest live invoice, else the PO estimate, else nothing", () => {
    const lot: Lot = {
      id: "L1",
      poId: "SH-1",
      kind: "shipment",
      config: {},
      values: {},
    };
    const order = entry({
      kind: "smokeOrder",
      role: "owner",
      lotId: "L1",
      values: { estimatedCost: "2200" },
    });
    const bill = (netPayable: string) =>
      entry({
        kind: "smokingInvoice",
        role: "cm",
        lotId: "L1",
        values: { netPayable },
      });
    const none = { ...withEntries(), lots: [lot] };
    expect(lotCost(none, lot)).toMatchObject({
      smoke: 0,
      smokingCostSource: "none",
    });
    const estimate = { ...withEntries(order), lots: [lot] };
    expect(lotCost(estimate, lot)).toMatchObject({
      smoke: 2200,
      smokingCostSource: "estimate",
    });
    const invoiced = {
      ...withEntries(order, bill("2400"), bill("2500")),
      lots: [lot],
    };
    expect(lotCost(invoiced, lot)).toMatchObject({
      smoke: 2500,
      smokingCostSource: "invoice",
    });
    // Without a smoke PO the invoice still counts.
    expect(
      lotCost({ ...withEntries(bill("2400")), lots: [lot] }, lot).smoke,
    ).toBe(2400);
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
    const db = withEntries(sala, minburi, smoke);
    expect(visibleEntries(db, "owner")).toEqual(db.entries);
    expect(visibleEntries(db, "branch", "ศาลาแดง")).toEqual([
      { ...sala, values: { boxes: "1" } },
    ]);
    const meatPayment = entry({
      kind: "meatPayment",
      role: "owner",
      values: { paidAmount: "100", slips: "[]" },
    });
    expect(
      visibleEntries(withEntries(meatPayment), "branch", "ศาลาแดง"),
    ).toEqual([]);
    expect(visibleEntries(db, "branch")).toEqual([]);
    // What the Owner sent the branch is shown (read-only in its history), not other branches'.
    const allocate = entry({ kind: "allocate", role: "owner", lotId: "S1" });
    const transfer = entry({
      kind: "materialTransfer",
      role: "owner",
      branch: "มีนบุรี",
      values: { price: "5", quantity: "1" },
    });
    const sent = withEntries(allocate, transfer);
    expect(visibleEntries(sent, "branch", "ศาลาแดง")).toEqual([allocate]);
    expect(visibleEntries(sent, "branch", "มีนบุรี")).toEqual([
      { ...transfer, values: { quantity: "1" } },
    ]);
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
  test("PRIN-03 a wrong role is refused without mutation; a thaw over stock only warns", () => {
    const s = setup();
    expect(() =>
      s.run("branch", "purchase", {
        supplier: "x",
        orderedKg: "10",
        price: "1",
      }),
    ).toThrow(/ไม่มีสิทธิ์/);
    expect(s.db.lots).toHaveLength(0);
    expectWarning(
      s.check("branch", "thaw", { kg: "1" }, ""),
      /สต๊อกแช่แข็งไม่พอ/,
    );
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
    expect(s.db.lots.map((lot) => [lot.id, lot.poId])).toEqual([
      ["F260909-001", "PO-2026-0001"],
      ["F260909-002", "PO-2026-0002"],
    ]);
    // Everything but the legacy inline logo, which documents read from the current config.
    const { logoData, ...snapshot } = s.db.config;
    expect(logoData).toBe("");
    expect(s.db.lots[0].config).toEqual(snapshot);
  });

  test("a closed day warns on branch writes until the owner unlocks it (GEN-03)", () => {
    const closed = withEntries(entry({ kind: "closeDay" }));
    const rice = {
      riceSource: riceSources[0],
      supplier: "x",
      rawRiceKg: "1",
      rawRiceCost: "1",
    };
    // GEN-03: a closed day still records; the entry is only warned about.
    expectWarning(
      check(() =>
        mutate(closed, "branch", "ricePurchase", rice, "", day, "ศาลาแดง"),
      ),
      /ปิดยอดแล้ว/,
    );
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
    expect(
      check(() =>
        mutate(reopened, "branch", "ricePurchase", rice, "", day, "ศาลาแดง"),
      ).warnings.join(" "),
    ).not.toMatch(/ปิดยอดแล้ว/);
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
    const closedWarning = (values: Values, branch: string) =>
      check(() =>
        mutate(
          minburiClosed,
          "branch",
          "ricePurchase",
          values,
          "",
          day,
          branch,
        ),
      ).warnings.some((w) => /ปิดยอดแล้ว/.test(w));
    expect(closedWarning(cookedRice, "มีนบุรี")).toBe(true);
    expect(closedWarning(rawRice, "ศาลาแดง")).toBe(false);
  });

  test("void reverses an allowed entry once and needs a reason", () => {
    const s = setup();
    expectWarning(
      s.check("owner", "chiliAllocate", { branch: "ศาลาแดง", chiliTubes: "1" }),
      /ไม่พอ/,
    );
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
    // Without a reason the void saves, marked as not filled in (GEN-02).
    let missing: string | undefined;
    s.dry(() => {
      s.run("owner", "void", { targetId: allocation.id });
      missing = last(s).values.missing;
    });
    expect(missing).toBe("reason");
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

  test("config merges validated settings; old stored keys pass through unchecked", () => {
    expect(seed.config).not.toHaveProperty("tolerance");
    expect(seed.config).not.toHaveProperty("closeTime");
    expect(seed.config).not.toHaveProperty("ricePrice");
    // A v9 payload saved before the dead keys went still saves.
    const old = { ...seed, config: { ...seed.config, tolerance: "20" } };
    const next = mutate(
      old,
      "owner",
      "config",
      { ...old.config, boxPrice: "400", closeTime: "22:00" },
      "",
      day,
    );
    expect(next.config).toMatchObject({ boxPrice: "400", tolerance: "20" });
    expect(seed.config.boxPrice).toBe("350");
    expect(() =>
      mutate(
        seed,
        "owner",
        "config",
        { ...seed.config, packKg: "-1" },
        "",
        day,
      ),
    ).toThrow(/มากกว่าศูนย์/);
  });
});

describe("lot workflow", () => {
  test("Foodiva may invoice over the PO; a split that does not add up only warns", () => {
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
      s.run("owner", "foodivaConfirm", values("41", "41", "0")),
    ).not.toThrow();
    expectWarning(
      s.check("owner", "foodivaConfirm", values("40", "30", "5")),
      /รวมเท่ากับ/,
    );
  });

  test("SMK-04 smoke PO needs no Packing List, takes the kg entered (no cap) and prices the service", () => {
    const s = setup();
    purchase(s, "30");
    confirm(s, "30");
    dispatch(s, "");
    const order = (rawKg?: string) =>
      s.run("owner", "smokeOrder", {
        requestedSmokeDate: day,
        smoker: "Chef House",
        ...(rawKg === undefined ? {} : { rawKg }),
      });
    // No Packing List yet and no kg typed: it saves, marked as not filled in (GEN-02).
    let missing: string | undefined;
    s.dry(() => {
      order();
      missing = last(s).values.missing;
    });
    expect(missing).toBe("rawKg");
    packingList(s, "15\n15");
    expectWarning(
      s.dry(() => order("0")),
      /น้ำหนัก PO รมควัน/,
    );
    // Pre-filled from the 30 kg Packing List but the Owner may order more.
    order("32");
    expect(last(s).values).toMatchObject({
      rawKg: "32",
      serviceRate: "220",
      estimatedCost: "7040",
      orderNumber: "SO-2026-0001",
      status: "Sent",
    });
    // GEN-06: a second smoke PO is said; the newest counts.
    expectWarning(
      s.dry(() => order("32")),
      /ออก PO รมควันของการส่งนี้แล้ว/,
    );
    // SHP-02: a later Packing List still saves and is said.
    expectWarning(
      s.dry(() => packingList(s, "30")),
      /ออก PO รมควันของชุดนี้แล้ว/,
    );
    // SVC-01: Chef House bills before the run is closed.
    s.run("owner", "smokingInvoice", {
      invoiceNumber: "CH-1",
      invoiceDate: day,
      attachment: "x",
    });
    expect(last(s).values.serviceQuantity).toBe("32");
  });

  test("Chef House bills its own amount and the Owner pays exactly that (A7)", () => {
    const s = closed();
    const bill = (netPayable: string, attachment = "ch.pdf") =>
      s.run("owner", "smokingInvoice", {
        invoiceNumber: "CH-9",
        invoiceDate: day,
        attachment,
        netPayable,
      });
    expectWarning(
      s.dry(() => bill("0")),
      /ยอดเรียกเก็บค่ารมควัน/,
    );
    let missing: string | undefined;
    s.dry(() => {
      bill("10500", "");
      missing = last(s).values.missing;
    });
    expect(missing).toBe("attachment");
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
    expectWarning(
      s.dry(() => pay("11000")),
      /เท่ากับยอดสุทธิ/,
    );
    pay("10500");
    expect(smokingInvoiceStatus(s.db, sent)).toBe("ชำระแล้ว");
  });

  test("GEN-06 smoking invoice goes from review to payment and cannot be paid twice", () => {
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
    // SVC-03: paying before the amount is accepted is said, not refused.
    expectWarning(
      s.dry(() => pay("11000")),
      /ยังไม่ได้รับยอด/,
    );
    review("รับยอด");
    expect(status()).toBe("รอชำระ");
    expectWarning(
      s.dry(() => pay("10000")),
      /เท่ากับยอดสุทธิ/,
    );
    pay("11000");
    expect(status()).toBe("ชำระแล้ว");
    expect(() => pay("11000")).toThrow(/ชำระ Invoice ใบนี้แล้ว/);
    expect(() => review("รับยอด")).toThrow(/ชำระแล้ว/);
  });

  test("SVC-01 a batch paid before its invoice counts as paid once the invoice arrives", () => {
    const s = closed();
    const pay = () =>
      s.run("owner", "invoicePayment", {
        paymentDate: day,
        paidBy: "Owner",
        paidAmount: "11000",
      });
    expectWarning(
      s.dry(() => pay()),
      /ยังไม่มี Invoice/,
    );
    pay();
    // Only one payment per batch, invoice or not (GEN-06).
    expect(() => pay()).toThrow(/ชำระค่ารมควันของชุดนี้แล้ว/);
    const smokingInvoice = invoice(s);
    expect(smokingInvoiceStatus(s.db, smokingInvoice)).toBe("ชำระแล้ว");
    const pending = ownerPendingInvoices(s.db);
    expect(pending.toReview).toEqual([]);
    expect(pending.toPay).toEqual([]);
    expect(() =>
      s.run("owner", "invoicePayment", {
        invoiceId: smokingInvoice.id,
        paymentDate: day,
        paidBy: "Owner",
        paidAmount: "11000",
      }),
    ).toThrow(/ชำระ Invoice ใบนี้แล้ว/);
  });

  test("SVC-01 invoice then payment still goes through review and clears pending", () => {
    const s = closed();
    const smokingInvoice = invoice(s);
    expect(ownerPendingInvoices(s.db).toReview).toEqual([smokingInvoice]);
    s.run("owner", "invoiceReview", {
      invoiceId: smokingInvoice.id,
      decision: "รับยอด",
      reviewedBy: "Owner",
    });
    expect(ownerPendingInvoices(s.db).toPay).toEqual([smokingInvoice]);
    s.run("owner", "invoicePayment", {
      invoiceId: smokingInvoice.id,
      paymentDate: day,
      paidBy: "Owner",
      paidAmount: "11000",
    });
    expect(smokingInvoiceStatus(s.db, smokingInvoice)).toBe("ชำระแล้ว");
    expect(ownerPendingInvoices(s.db).total).toBe(
      ownerPendingInvoices(s.db).unpaidMeatLots.length,
    );
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
    s.run("owner", "invoiceReview", {
      invoiceId: smokingInvoice.id,
      decision: "รับยอด",
      reviewedBy: "Owner",
    });
    expect(smokingInvoiceRejection(s.db, smokingInvoice)).toBeUndefined();
  });

  test("raw meat at Foodiva is the ready-for-Chef-House kg less trucks and legacy Steak transfers", () => {
    const s = setup();
    purchase(s, "40");
    const lot = () => s.db.lots[0];
    // Before the invoice, the ordered kg.
    expect(rawAtFoodiva(s.db, lot())).toBe(40);
    confirm(s, "40", "30");
    const id = lot().id;
    // One figure everywhere: the 10 kg kept for the Owner is apart (ownerWasteOutstanding).
    expect(rawAtFoodiva(s.db, lot())).toBe(30);
    expect(readyForChefHouse(s.db, id)).toBe(30);
    const pickup = (receivedKg: string) =>
      s.run("owner", "ownerWasteReceive", {
        receivedDate: "2026-09-10",
        receivedKg,
        receiver: "Owner",
      });
    expectWarning(
      s.dry(() => pickup("11")),
      /เกินยอด/,
    );
    pickup("4");
    expect(last(s).date).toBe("2026-09-10");
    expect(ownerWasteOutstanding(s.db, id)).toBe(6);
    // A8: the Owner's pickup leaves the PO's kg left to send (ready for Chiang Mai) alone.
    expect(poRemainingKg(s.db, id)).toBe(30);
    expect(rawAtFoodiva(s.db, lot())).toBe(30);
    // Legacy "steakTransfer" entries (no UI creates them now) still leave Foodiva.
    s.db.entries.push({
      ...last(s),
      id: "legacy-steak",
      kind: "steakTransfer",
      values: { quantityKg: "5" },
    });
    expect(rawAtFoodiva(s.db, lot())).toBe(25);
    // PO-05: a smoke PO leaves the beef at Foodiva until its truck goes; the batch holds none itself.
    smokeOrder(s, [[id, "10"]], "10", "");
    expect(rawAtFoodiva(s.db, lot())).toBe(25);
    dispatch(s);
    expect(rawAtFoodiva(s.db, lot())).toBe(15);
    expect(rawAtFoodiva(s.db, s.db.lots.at(-1)!)).toBe(0);
  });

  test("SHP-01 Foodiva, or the Owner for them, trucks a batch, and it carries the kg typed (the PO's when blank)", () => {
    const t = setup();
    readyToDispatch(t, "40");
    expect(() => t.run("branch", "dispatch", send)).toThrow(/ไม่มีสิทธิ์/);
    const byOwner = mutate(t.db, "owner", "dispatch", send, "", day);
    expect(byOwner.entries.at(-1)).toMatchObject({
      kind: "dispatch",
      role: "foodiva",
      actor: "owner",
    });
    expect(entryBy(byOwner.entries.at(-1)!)).toBe("Owner · แทน Foodiva");
    expect(() => t.run("owner", "dispatch", send, t.db.lots[0].id)).toThrow(
      /ไม่ใช่ PO ซื้อ/,
    );
    expect(t.check("owner", "dispatch", send).error).toBe("");
    t.run("owner", "dispatch", {
      ...send,
      trip: "เที่ยวเดียว",
      dispatchKg: "39",
    });
    const shipment = t.db.lots.at(-1)!;
    expect(lotProgress(t.db, shipment.id).has("dispatch")).toBe(true);
    expect(shipment.values.dispatchKg).toBe("39");
    expect(shipment.values.outboundCost).toBe("1200");
    expect(last(t).values.transferNumber).toBe("TR-2026-0001");
  });

  test("smoke batches validate bag weights and finish when the input is used up", () => {
    const s = setup();
    received(s, "50", "50", "49");
    s.run("owner", "prepare", { preSmokeKg: "48" });
    const lot = () => s.db.lots.at(-1)!;
    const id = lot().id;
    const smoke = (inputKg: string, wasteKg: string, bags: string) =>
      s.run("owner", "smoke", {
        smokeDate: day,
        inputKg,
        wasteKg,
        packs: bags,
      });
    expect(() => smoke("0.1", "0", "0.1\nabc")).toThrow(/มากกว่า 0/);
    expectWarning(
      s.dry(() => smoke("10", "0", packs(50))),
      /เท่ากับน้ำหนักเข้าเตา/,
    );
    smoke("20", "5", packs(150));
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
    s.run("owner", "prepare", { preSmokeKg: "50" });
    s.run("owner", "smoke", {
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

  test("CHF-03 excess pre-smoke and over-smoke warn; closing before smoking only warns", () => {
    const s = setup();
    received(s, "10");
    expectWarning(s.check("owner", "prepare", { preSmokeKg: "11" }), /เกิน/);
    s.run("owner", "prepare", { preSmokeKg: "10" });
    expectWarning(
      s.check("owner", "closeLot", { confirm: "x" }),
      /ยังไม่มีผลผลิต/,
    );
    expectWarning(
      s.check("owner", "smoke", {
        inputKg: "11",
        wasteKg: "6",
        smokeDate: day,
        packs: packs(50),
      }),
      /เกิน/,
    );
    // Smoking more than was waiting still finishes production.
    s.run("owner", "smoke", {
      inputKg: "11",
      wasteKg: "6",
      smokeDate: day,
      packs: packs(50),
    });
    expect(pendingSmokeKg(s.db, s.db.lots.at(-1)!)).toBe(0);
    // CHF-05: another round after ปิด Lot is recorded and said.
    s.run("owner", "closeLot", { confirm: "x" });
    expectWarning(
      s.check("owner", "smoke", {
        inputKg: "1",
        wasteKg: "0",
        smokeDate: day,
        packs: packs(10),
      }),
      /ปิด Lot แล้ว/,
    );
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
        "owner",
        "chefEdit",
        {
          arrival: "08:00",
          preSmokeKg: "48",
          ...values,
          batches: JSON.stringify(drafts),
        },
        id,
      );
    expect(() => s.run("branch", "chefEdit", {}, id)).toThrow(/ไม่มีสิทธิ์/);
    expectWarning(
      s.dry(() =>
        edit({}, [draft(smokes[0], { wasteKg: "4" }), draft(smokes[1])]),
      ),
      /เท่ากับน้ำหนักเข้าเตา/,
    );
    expectWarning(
      s.dry(() =>
        edit(
          { preSmokeKg: "47" },
          smokes.map((item) => draft(item)),
        ),
      ),
      /น้ำหนักก่อนสโมค/,
    );
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
    s.run("owner", "closeLot", { confirm: "x" }, id);
    // CHF-04: a correction after the run is closed still saves; it is said.
    expectWarning(
      s.dry(() =>
        edit(
          {},
          smokes.map((item) => draft(item)),
        ),
      ),
      /ปิด Lot แล้ว/,
    );
  });

  test("old allocations (DM-08): 500 + 200 of 700 kg, received in parts, count until filled", () => {
    const s = returned();
    s.run("owner", "central", { centralKg: "700", reason: "ทดสอบ" });
    const id = s.db.lots.at(-1)!.id;
    // Old data from before allocation was retired (BR-01): its math still counts.
    const sala = legacyAllocate(s, {
      branch: "ศาลาแดง",
      kg: "500",
      deliveryDate: day,
    });
    legacyAllocate(s, { branch: "มีนบุรี", kg: "150", deliveryDate: day });
    expect(centralStock(s.db, id)).toBe(50);
    legacyAllocate(s, { branch: "มีนบุรี", kg: "50" });
    expect(centralStock(s.db, id)).toBe(0);
    legacyReceive(s, "300", sala.id, { reason: "ทยอยรับ" });
    expect(allocationOutstanding(s.db, sala)).toBe(200);
    legacyReceive(s, "200", sala.id);
    expect(allocationOutstanding(s.db, sala)).toBe(0);
    expect(pendingReceiveKg(s.db, id, "ศาลาแดง")).toBe(0);
  });

  test("an old allocation's exact kg past 0.01 is filled by the same receive (COR-15)", () => {
    const s = ready();
    const sala = legacyAllocate(s, { branch: "ศาลาแดง", kg: "10.004" });
    expect(allocationOutstanding(s.db, sala)).toBe(10);
    legacyReceive(s, "10.004", sala.id);
    expect(allocationOutstanding(s.db, sala)).toBe(0);
  });

  test("an old receive marked complete closes its allocation on a shortfall", () => {
    const s = returned();
    s.run("owner", "central", { centralKg: "700", reason: "ทดสอบ" });
    const id = s.db.lots.at(-1)!.id;
    const sala = legacyAllocate(s, { branch: "ศาลาแดง", kg: "500" });
    legacyReceive(s, "499.5", sala.id, {
      complete: "1",
      reason: "น้ำหนักหายระหว่างขนส่ง",
    });
    expect(allocationOutstanding(s.db, sala)).toBe(0);
    expect(pendingReceiveKg(s.db, id, "ศาลาแดง")).toBe(0);
    expect(balance(s.db, id, "ศาลาแดง").received).toBe(499.5);
  });

  test("BR-01/BR-02 a branch receives straight on the batch; over central and over-thaw warn; a new allocation is refused", () => {
    const s = ready();
    expect(
      s.check("owner", "allocate", { branch: "มีนบุรี", kg: "5" }).error,
    ).toBe("รายการชนิดนี้เลิกใช้แล้ว");
    expectWarning(s.check("branch", "receive", { kg: "36" }), /สต๊อกกลางไม่พอ/);
    s.run("branch", "receive", { kg: "5", allocation: "anything" });
    // A new receive never carries an allocation.
    expect(last(s).values.allocation).toBeUndefined();
    expectWarning(s.check("branch", "thaw", { kg: "6" }), /ไม่พอ/);
  });
});

describe("branch supplies", () => {
  test("materials move from owner stock to a branch only after the branch confirms", () => {
    const material = materials[0];
    // MAT-01: a transfer before the branch's par is set saves; it is said.
    expectWarning(
      check(() =>
        mutate(
          seed,
          "owner",
          "materialTransfer",
          { material, branch: "ศาลาแดง", quantity: "1", receiver: "x" },
          "",
          day,
        ),
      ),
      /ตั้งจำนวนฐาน/,
    );
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
    expectWarning(
      s.dry(() => transfer("11")),
      /ไม่พอ/,
    );
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
    expectWarning(
      s.dry(() => receive({})),
      /เหตุผลส่วนต่าง/,
    );
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
    // A second round without its reason saves, marked as not filled in (GEN-02).
    let missing: string | undefined;
    s.dry(() => {
      s.run("branch", "materials", sheet("40"));
      missing = last(s).values.missing;
    });
    expect(missing).toBe("correctionReason");
    s.run("branch", "materials", sheet("40", { correctionReason: "กรอกผิด" }));
    expect(last(s).values.revision).toBe("2");
    expect(entries(s.db, "materials", undefined, "ศาลาแดง", day)).toHaveLength(
      2,
    );
    // Only the newest sheet of the day counts, so the fix does not deduct twice.
    expect(branchMaterialStock(s.db, "ศาลาแดง", 0, "2026-09-10")).toBe(60);
  });

  // B2: Saladaeng picks self-cook or bought-cooked on every purchase.
  test("ศาลาแดง self-cooks: raw 10 kg in, cooked 14 kg out saves", () => {
    const branch = "ศาลาแดง";
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
    expect(cookedRiceStock(s.db, branch, day)).toBe(14);
    expect(requiredRiceKinds(s.db, branch, day)).toEqual(["rice", "riceCarry"]);
  });

  test("มีนบุรี can self-cook too (B2): raw in, issued, cooked", () => {
    const branch = "มีนบุรี";
    const s = setup(branch);
    s.run("branch", "ricePurchase", {
      riceSource: riceSources[0],
      supplier: "x",
      rawRiceKg: "10",
      rawRiceCost: "500",
      cookedRiceKg: "12",
    });
    expect(last(s).values).toMatchObject({
      riceSource: riceSources[0],
      cookedRiceKg: "0",
      totalCost: "500",
    });
    s.run("branch", "riceIssue", { rawRiceIssuedKg: "10", receiver: "x" });
    s.run("branch", "rice", { rawUsedKg: "10", riceKg: "14" });
    expect(rawRiceStock(s.db, branch)).toBe(0);
    expect(cookedRiceStock(s.db, branch, day)).toBe(14);
    expect(requiredRiceKinds(s.db, branch, day)).toEqual(["rice", "riceCarry"]);
  });

  test.each(["ศาลาแดง", "มีนบุรี"])(
    "%s buys cooked rice: no raw weight, no par floor",
    (branch) => {
      const s = setup(branch);
      // Raw weights on a bought-cooked round are zeroed; the cooked ones are left empty.
      let missing: string | undefined;
      s.dry(() => {
        s.run("branch", "ricePurchase", {
          riceSource: riceSources[1],
          supplier: "x",
          rawRiceKg: "10",
          rawRiceCost: "500",
        });
        missing = last(s).values.missing;
      });
      expect(missing).toBe("cookedRiceKg,cookedRiceCost");
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
      expect(cookedRiceStock(s.db, branch, day)).toBe(12);
      expect(requiredRiceKinds(s.db, branch, day)).toEqual(["riceCarry"]);
      // B2: cooked rice never carries over; the day-end leftover is all waste.
      s.run("branch", "riceCarry", { leftoverKg: "5" });
      expect(cookedRiceStock(s.db, branch, day)).toBe(7);
      expect(cookedRiceStock(s.db, branch, "2026-09-10")).toBe(0);
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
    const withDay = (...kinds: EntryKind[]) =>
      withEntries(
        ...(["sale", "materials", ...kinds] as EntryKind[]).map((kind) =>
          entry({
            kind,
            branch: "มีนบุรี",
            values: kind === "riceIssue" ? { rawRiceIssuedKg: "2" } : {},
          }),
        ),
      );
    // RUL-90: an unfinished checklist no longer blocks; it is said and listed in `missing`.
    const close = (db: Database) => {
      const result = check(() => closeWith(db));
      expect(result.error).toBe("");
      return {
        warnings: result.warnings.join(" "),
        missing: closeWith(db).entries.at(-1)!.values.missing,
      };
    };
    expect(close(withDay())).toMatchObject({
      warnings: expect.stringMatching(/ยังไม่ยืนยันข้าวเหนียวสุกคงเหลือ/),
      missing: "riceCarry",
    });
    expect(close(withDay("riceCarry")).missing).toBeUndefined();
    expect(close(withDay("riceIssue", "riceCarry"))).toMatchObject({
      warnings: expect.stringMatching(/ยังไม่บันทึกข้าวช่วงเช้า/),
      missing: "rice",
    });
    expect(
      close(withDay("riceIssue", "rice", "riceCarry")).missing,
    ).toBeUndefined();
  });

  test("closeDayChecklist is the rule mutate closes by", () => {
    const s = ready();
    s.run("branch", "receive", { kg: "5" });
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
    // Said with the checklist's own message for each missing item; it no longer blocks.
    expectWarning(
      s.check("branch", "closeDay", { confirm: "x" }),
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
    expectWarning(
      s.check("branch", "closeDay", { confirm: "x" }),
      missing()[0].message,
    );
    s.run("branch", "riceCarry", { leftoverKg: "0" });
    expect(missing()).toEqual([]);
    // No close-time rule any more (FB-14): 09:00 closes like 22:00 did.
    s.run("branch", "closeDay", { time: "09:00", confirm: "x" });
    expect(isClosed(s.db, "ศาลาแดง", day)).toBe(true);
    // A closed day still records (GEN-03): every branch entry, a second close too, is said.
    for (const kind of ["riceCarry", "closeDay"] as const)
      expectWarning(
        s.check("branch", kind, { leftoverKg: "0", confirm: "x" }),
        /ปิดยอดแล้ว/,
      );
  });

  test("sales deviation validation", () => {
    const s = ready();
    s.run("branch", "receive", { kg: "5" });
    s.run("branch", "thaw", { kg: "5" });
    expectWarning(
      s.check("branch", "sale", {
        boxes: "10",
        chiliAddons: "0",
        soldKg: "6",
        wasteKg: "0",
        riceWasteKg: "0",
        expense: "0",
        lineMan: "3500",
      }),
      /เกินเนื้อที่ละลายแล้ว/,
    );
    // A bad number is named by its Thai field label, never its value key.
    expect(s.check("branch", "sale", { boxes: "-1" }).error).toBe(
      "กรอกจำนวนกล่องมาตรฐานเป็นตัวเลขตั้งแต่ศูนย์",
    );
  });
});

/** ศาลาแดง on `day`: 5 kg thawed, 10 kg cooked rice, 5 chili tubes — everything an
 *  influencer giveaway draws on. */
function giveawayReady() {
  const s = ready();
  s.run("branch", "receive", { kg: "5" });

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
  // Without a name the giveaway saves, marked as not filled in (GEN-02).
  let missing: string | undefined;
  s.dry(() => {
    s.run("branch", "influencerBox", { ...box, influencer: "" });
    missing = last(s).values.missing;
  });
  expect(missing).toBe("influencer");
  expectWarning(
    s.check("branch", "influencerBox", { ...box, boxes: "50" }),
    /เกินเนื้อที่ละลายแล้ว/,
  );
  expectWarning(
    s.check("branch", "influencerBox", { ...box, chiliAddons: "6" }),
    /น้ำพริก/,
  );
  // The kg is derived from the box count, so whatever the form sends is overwritten.
  s.run("branch", "influencerBox", { ...box, soldKg: "9" });
  expect(last(s).values.soldKg).toBe(String(2 * Number(seed.config.packKg)));
  expect(balance(s.db, id, "ศาลาแดง").ready).toBeCloseTo(4.797, 3);
  expect(cookedRiceStock(s.db, "ศาลาแดง", day)).toBeCloseTo(9.6, 3);
  expect(chiliStock(s.db, "ศาลาแดง")).toBe(4);
  // BR-05: the meat cost is read, not stored.
  expect(last(s).values.meatCost).toBeUndefined();
  expect(saleCost(s.db, last(s)).meatCost).toBeGreaterThan(0);
  // Owner-only: the branch log never shows what the giveaway cost.
  expect(
    visibleEntries(s.db, "branch", "ศาลาแดง").at(-1)!.values.meatCost,
  ).toBeUndefined();
});

/** The day's sale as the form sends it: small enough to leave room for giveaways. */
const saleValues = {
  boxes: "10",
  chiliAddons: "1",
  soldKg: "1",
  wasteKg: "0",
  riceWasteKg: "0",
  expense: "0",
  lineMan: "3500",
};

describe("recording the day's sale with influencer giveaways", () => {
  test("two giveaways are written first, then the sale", () => {
    const s = giveawayReady();
    const id = s.db.lots.at(-1)!.id;
    const before = s.db.entries.length;
    const db = saleWithInfluencers(
      s.db,
      "ศาลาแดง",
      day,
      id,
      [
        { ...box, influencer: "@a" },
        { ...box, influencer: "@b", boxes: "1" },
      ],
      saleValues,
    );
    expect(db.entries.slice(before).map((e) => e.kind)).toEqual([
      "influencerBox",
      "influencerBox",
      "sale",
    ]);
    expect(
      entries(db, "influencerBox", undefined, "ศาลาแดง", day).map(
        (e) => e.values.influencer,
      ),
    ).toEqual(["@a", "@b"]);
    // Each giveaway's kg follows its own box count, and both hang on the sale's lot.
    expect(
      entries(db, "influencerBox", undefined, "ศาลาแดง", day).map((e) => [
        e.lotId,
        e.values.soldKg,
      ]),
    ).toEqual([
      [id, String(2 * Number(seed.config.packKg))],
      [id, String(1 * Number(seed.config.packKg))],
    ]);
    // The sale is last, so its end-of-day chili count is measured on the shelf the
    // giveaways have already left: 5 allocated − 2 given away − 1 sold.
    expect(
      entries(db, "sale", undefined, "ศาลาแดง", day).at(-1)!.values,
    ).toMatchObject({ chiliExpected: "2" });
    expect(chiliStock(db, "ศาลาแดง")).toBe(2);
  });

  test("an invalid giveaway writes nothing at all — not even the sale; one over stock only warns", () => {
    const s = giveawayReady();
    const id = s.db.lots.at(-1)!.id;
    // A first sale of the day eats 9 of the 10 kg of cooked rice, so a giveaway can
    // now run out of rice before it runs out of meat.
    s.run("branch", "sale", {
      ...saleValues,
      boxes: "45",
      chiliAddons: "0",
      lineMan: "9450",
    });
    const before = s.db.entries.length;
    for (const [bad, reason] of [
      [{ ...box, boxes: "60" }, /เกินเนื้อที่ละลายแล้ว/], // more meat than is thawed
      [{ ...box, boxes: "4" }, /ข้าวเหนียวไม่พอ/], // meat is enough, cooked rice is not
      [{ ...box, chiliAddons: "9" }, /น้ำพริก/], // more chili than was allocated
    ] as [Values, RegExp][]) {
      const save = () =>
        saleWithInfluencers(s.db, "ศาลาแดง", day, id, [box, bad], {
          ...saleValues,
          boxes: "1",
          soldKg: "0.1",
        });
      // The warning says which block it is about, and why.
      expectWarning(check(save), /อินฟลูเอนเซอร์ที่ 2 \(@nong\)/);
      expectWarning(check(save), reason);
    }
    // A refusal still stops the whole save and names the block.
    const refused = () =>
      saleWithInfluencers(
        s.db,
        "ศาลาแดง",
        day,
        id,
        [box, { ...box, boxes: "-1" }],
        { ...saleValues, boxes: "1", soldKg: "0.1" },
      );
    expect(refused).toThrow(/อินฟลูเอนเซอร์ที่ 2 \(@nong\) · กรอก/);

    expect(s.db.entries.length).toBe(before);
    expect(entries(s.db, "influencerBox", undefined, "ศาลาแดง", day)).toEqual(
      [],
    );
    expect(entries(s.db, "sale", undefined, "ศาลาแดง", day)).toHaveLength(1);
  });

  test("no giveaway: the save is the plain sale it always was", () => {
    const s = giveawayReady();
    const id = s.db.lots.at(-1)!.id;
    const plain = saleWithInfluencers(s.db, "ศาลาแดง", day, id, [], saleValues);
    const direct = mutate(
      s.db,
      "branch",
      "sale",
      saleValues,
      id,
      day,
      "ศาลาแดง",
    );
    const tail = (db: Database) => {
      const { id: entryId, at, ...rest } = db.entries.at(-1)!;
      return { count: db.entries.length, ...rest, id: !!entryId, at: !!at };
    };
    expect(tail(plain)).toEqual(tail(direct));
  });
});

test("full loop: partial smoke, central, branch receives in parts, sale and close", () => {
  const s = ready();
  const id = s.db.lots.at(-1)!.id;
  expect(produced(s.db, id)).toBe(36);
  expect(lotProgress(s.db, id).has("central")).toBe(true);
  expect(lotCost(s.db, s.db.lots.at(-1)!).freight).toBe(2000);
  // BR-01: the branch records what it received straight on the batch, in parts.
  s.run("branch", "receive", { kg: "4" });
  s.run("branch", "receive", { kg: "6" });
  expect(centralStock(s.db, id)).toBe(25);
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
  expect(cookedRiceStock(s.db, "ศาลาแดง", day)).toBe(10);
  expect(chiliStock(s.db, "ศาลาแดง")).toBe(50);
  s.run("branch", "sale", {
    boxes: "40",
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
  for (let i = 0; i < materials.length; i++) {
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
      Array.from({ length: materials.length }, (_, i) => [
        ["opening" + i, "500"],
        ["used" + i, "50"],
        ["material" + i, "450"],
      ]).flat(),
    ),
  );
  expect(last(s).values.material0).toBe("450");
  expectWarning(
    s.check("branch", "closeDay", { time: "22:00", confirm: "ผู้ดูแล" }),
    /ยังไม่ยืนยันข้าวเหนียวสุกคงเหลือ/,
  );
  s.run("branch", "riceCarry", {
    leftoverKg: String(cookedRiceStock(s.db, "ศาลาแดง", day)),
  });
  expect(cookedRiceStock(s.db, "ศาลาแดง", day)).toBe(0);
  s.run("branch", "closeDay", { time: "22:00", confirm: "ผู้ดูแล" });
  expect(last(s).values.missing).toBeUndefined();
  expect(isClosed(s.db, "ศาลาแดง", day)).toBe(true);
  expectWarning(s.check("branch", "thaw", { kg: "1" }), /ปิดยอด/);

  expect(
    visibleEntries(s.db, "branch", "ศาลาแดง").every(
      (item) => !("meatCost" in item.values),
    ),
  ).toBe(true);
  expect(JSON.parse(JSON.stringify(s.db))).toEqual(s.db);
});

test("seven-day roleplay replays every role through mutate", () => {
  const db = sevenDayRoleplay(day);
  // One purchase PO and the one batch built from it, in central stock.
  expect(
    db.lots.map((lot) => [lot.kind, lotProgress(db, lot.id).has("central")]),
  ).toEqual([
    [undefined, false],
    ["shipment", true],
  ]);
  expect(entries(db, "meatPayment")).toHaveLength(1);
  expect(entries(db, "closeDay")).toHaveLength(14);
  for (const branch of branches) expect(isClosed(db, branch, day)).toBe(true);
  expect(db.config.branch).toBe("ศาลาแดง");
});

describe("backdated entries", () => {
  test("GEN-04 a batch entry dated before the batch's other entries saves with a warning", () => {
    const s = setup();
    readyToDispatch(s, "50");
    const lotId = s.db.lots.at(-1)!.id;
    const early = check(() =>
      mutate(s.db, "owner", "dispatch", send, lotId, "2026-09-01"),
    );
    expectWarning(early, `วันที่ก่อนรายการอื่นของชุดนี้ (${day})`);
  });

  test("a backdated batch entry on or after the others still saves", () => {
    const s = setup();
    readyToDispatch(s, "50");
    const backdated = "2026-09-10"; // after `day`, before the real today
    const db = mutate(
      s.db,
      "owner",
      "dispatch",
      send,
      s.db.lots.at(-1)!.id,
      backdated,
    );
    expect(lotProgress(db, db.lots.at(-1)!.id).has("dispatch")).toBe(true);
    expect(db.entries.at(-1)!.date).toBe(backdated);
  });

  test("GEN-05 a purchase-PO entry dated before the PO saves with a warning", () => {
    const s = setup();
    purchase(s, "40");
    const early = check(() =>
      mutate(
        s.db,
        "owner",
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
    );
    expectWarning(early, `วันที่ก่อนวันเปิด PO ของ Lot นี้ (${day})`);
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
    // Day 2: 1.5 kg received straight on the batch (BR-01), 1 kg thawed.
    const run = (
      db: Database,
      role: ActingRole,
      kind: EntryKind,
      values: Values,
    ) => mutate(db, role, kind, values, id, nextDay, branch);
    let db = run(s.db, "branch", "receive", { kg: "1.5" });
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
    expect(two.pending).toBe(0);
    expect(two.received).toBeCloseTo(71.5, 6);
    expect(two.frozen).toBeCloseTo(0.5, 6);
    expect(two.chillOut).toBeCloseTo(5.5, 6);
    // Today's totals agree with the last day.
    expect(balance(db, id, branch).frozen).toBeCloseTo(two.frozen, 6);
    expect(balance(db, id, branch).ready).toBeCloseTo(two.chillOut, 6);
  });

  test("95 g per pack saves and only warns", () => {
    const s = ready();
    s.run("branch", "receive", { kg: "5" });
    s.run("branch", "thaw", { kg: "5" });
    const sale = {
      boxes: "10",
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

describe("free ledger (PRD v9)", () => {
  const truck = { ...send, dispatchKg: "50" };
  const list = {
    invoiceNo: "INV-1",
    product: "เนื้อวัว",
    attachment: "packing.pdf",
    slicedNetKg: "50",
    slicedLostKg: "50",
  };
  const bill = {
    invoiceNumber: "CH-1",
    invoiceDate: day,
    attachment: "ch.pdf",
    serviceQuantity: "50",
  };
  const truckBack = {
    returnDate: day,
    returnTime: "09:00",
    origin: "Chef House",
    destination: "Foodiva",
    vehicleType: "รถห้องเย็น",
    plate: "กข123",
    driverName: "คนขับ",
    driverPhone: "0800000000",
    returnKg: "36",
  };
  /** Every batch kind with values that pass on their own, whatever came before. */
  const steps: [ActingRole, EntryKind, Values][] = [
    ["owner", "dispatch", truck],
    ["owner", "packingList", list],
    [
      "owner",
      "smokeOrder",
      { requestedSmokeDate: day, smoker: "Chef House", rawKg: "50" },
    ],
    ["owner", "cmReceive", { arrival: "08:00", receivedKg: "49" }],
    ["owner", "prepare", { preSmokeKg: "48" }],
    [
      "owner",
      "smoke",
      { smokeDate: day, inputKg: "48", wasteKg: "12", packs: packs(360) },
    ],
    ["owner", "closeLot", { confirm: "สมชาย" }],
    ["owner", "smokingInvoice", bill],
    ["owner", "return", truckBack],
    [
      "owner",
      "foodivaReturnReceive",
      {
        receivedDate: day,
        receivedTime: "10:00",
        receivedKg: "36",
        receivedBags: "360",
      },
    ],
    ["owner", "central", { centralKg: "35" }],
  ];

  test("PRIN-01 every batch kind saves in any order on one batch", () => {
    // A fixed shuffle, so a failure is the same failure every run.
    const order = [4, 8, 1, 10, 6, 0, 9, 3, 7, 2, 5];
    const s = setup();
    purchase(s, "50");
    confirm(s, "50");
    let lotId = "";
    for (const index of order) {
      const [role, kind, values] = steps[index];
      if (kind === "cmReceive") {
        // smokeOrderAccept needs a PO to accept (SMK-06): the one refusal that stays.
        expect(() =>
          s.run("owner", "smokeOrderAccept", { acceptedBy: "x" }, lotId),
        ).toThrow(/ยังไม่มี PO รมควัน/);
      }
      s.run(role, kind, values, lotId);
      lotId = s.db.lots.at(-1)!.id;
    }
    s.run("owner", "smokeOrderAccept", { acceptedBy: "Chef House" }, lotId);
    expect(s.db.lots.filter((lot) => lot.kind)).toHaveLength(1);
    expect(centralStock(s.db, lotId)).toBe(35);
  });

  test("M0 the Owner records every Foodiva and Chef House kind on one batch, in any order", () => {
    const order = [9, 7, 3, 5, 1, 2, 4, 10, 0, 6, 8];
    const s = setup();
    purchase(s, "50");
    s.run(
      "owner",
      "foodivaConfirm",
      {
        invoiceNo: "INV-1",
        invoiceDate: day,
        attachment: "inv.pdf",
        confirmedBy: "Foodiva",
        confirmedKg: "50",
        readyForChiangMaiKg: "50",
        reservedForOwnerKg: "0",
        invoiceAmount: "1",
      },
      s.db.lots[0].id,
    );
    let lotId = "";
    const has = (kind: EntryKind) => entries(s.db, kind, lotId).length > 0;
    for (const index of order) {
      const [, kind, values] = steps[index];
      s.run("owner", kind, values, lotId);
      lotId = s.db.lots.at(-1)!.id;
      // The two kinds that need something on the batch first, typed as soon as they can be.
      if (has("smokeOrder") && !has("smokeOrderAccept"))
        s.run("owner", "smokeOrderAccept", { acceptedBy: "Owner" }, lotId);
      if (
        has("cmReceive") &&
        has("prepare") &&
        has("smoke") &&
        !has("closeLot") &&
        !has("chefEdit")
      )
        s.run(
          "owner",
          "chefEdit",
          {
            arrival: "09:00",
            preSmokeKg: "48",
            batches: JSON.stringify(
              entries(s.db, "smoke", lotId).map((e) => ({
                id: e.id,
                smokeDate: e.values.smokeDate,
                inputKg: e.values.inputKg,
                wasteKg: e.values.wasteKg,
                packs: e.values.packs,
              })),
            ),
          },
          lotId,
        );
    }
    expect(s.db.lots.filter((lot) => lot.kind)).toHaveLength(1);
    const partner = s.db.entries.filter((e) => e.role !== "owner");
    expect(partner.map((e) => e.kind).sort()).toEqual(
      [
        "foodivaConfirm",
        "dispatch",
        "packingList",
        "smokeOrderAccept",
        "cmReceive",
        "prepare",
        "smoke",
        "chefEdit",
        "closeLot",
        "smokingInvoice",
        "foodivaReturnReceive",
      ].sort(),
    );
    expect(partner.every((e) => e.actor === "owner")).toBe(true);
    const closeLot = partner.find((e) => e.kind === "closeLot")!;
    expect(closeLot.role).toBe("cm");
    expect(entryBy(closeLot)).toBe("Owner · แทน Chef House");
    // Own kinds carry no actor; the Account Manager's stamp still reads as a hat.
    expect(
      s.db.entries.find((e) => e.kind === "purchase")!.actor,
    ).toBeUndefined();
    expect(entryBy({ ...closeLot, actor: "manager" })).toBe(
      "Account Manager · แทน Chef House",
    );
    expect(entryBy({ role: "owner", actor: "manager" })).toBe(
      "Account Manager",
    );
    expect(centralStock(s.db, lotId)).toBe(35);
  });

  test("SMK-07 lotProgress lists the kinds a batch holds, never the bookkeeping", () => {
    const s = smoked();
    const lotId = s.db.lots.at(-1)!.id;
    expect([...lotProgress(s.db, lotId)].sort()).toEqual(
      [
        "smokeOrder",
        "dispatch",
        "packingList",
        "smokeOrderAccept",
        "cmReceive",
        "prepare",
        "smoke",
      ].sort(),
    );
    expect(lotProgress(s.db, lotId).has("closeLot")).toBe(false);
    expect(
      batchKinds.filter((kind) => !lotProgress(s.db, lotId).has(kind)),
    ).toContain("closeLot");
    // A void takes its target out; the void itself is not progress.
    const t = ready();
    const tLot = t.db.lots.at(-1)!.id;
    const central = entries(t.db, "central", tLot)[0];
    t.run("owner", "void", { targetId: central.id, reason: "x" }, tLot);
    expect(lotProgress(t.db, tLot).has("central")).toBe(false);
    expect(lotProgress(t.db, tLot).has("void")).toBe(false);
  });

  test("SMK-01 a Chef cmReceive before the smoke PO, and the Owner's PO lands on that batch", () => {
    const s = setup();
    purchase(s, "50");
    confirm(s, "50");
    s.run("owner", "cmReceive", { arrival: "08:00", receivedKg: "49" }, "");
    const batch = s.db.lots.at(-1)!;
    expect(batch.kind).toBe("shipment");
    expect(batch.poId).toBe("SH-2026-0001");
    smokeOrder(s, [[s.db.lots[0].id, "50"]], "50", batch.id);
    expect(s.db.lots.filter((lot) => lot.kind)).toHaveLength(1);
    expect(last(s).lotId).toBe(batch.id);
    expect(batch.id).toBe(s.db.lots.at(-1)!.id);
    expect(s.db.lots.at(-1)!.values.requestedKg).toBe("50");
    // Now the accept goes through.
    s.run("owner", "smokeOrderAccept", { acceptedBy: "Chef House" }, batch.id);
    expect(lotProgress(s.db, batch.id).has("smokeOrderAccept")).toBe(true);
  });

  test("DASH-03 a smoke PO drawing on two purchase POs splits the meat cost pro rata", () => {
    const s = setup();
    purchase(s, "100", "200");
    purchase(s, "100", "300");
    const [a, b] = s.db.lots.map((lot) => lot.id);
    confirm(s, "100");
    smokeOrder(
      s,
      [
        [a, "30"],
        [b, "10"],
      ],
      "40",
      "",
    );
    const batch = s.db.lots.at(-1)!;
    // Before Chef House weighs in: the line kg × each PO's price.
    expect(lotCost(s.db, batch).meat).toBe(30 * 200 + 10 * 300);
    dispatch(s);
    packingList(s, "20\n20");
    s.run("owner", "cmReceive", { arrival: "08:00", receivedKg: "38" });

    // Once weighed in: 38 kg split 3:1.
    expect(lotCost(s.db, s.db.lots.at(-1)!).meat).toBeCloseTo(
      28.5 * 200 + 9.5 * 300,
    );
    expect(poRemainingKg(s.db, a)).toBe(70);
    expect(poRemainingKg(s.db, b)).toBe(90);
  });

  test("SMK-03 smoke PO lines refuse an unknown or repeated PO and warn on a missing invoice or too much", () => {
    const s = setup();
    purchase(s, "100");
    const po = s.db.lots[0].id;
    const order = (lines: [string, string][]) =>
      s.check(
        "owner",
        "smokeOrder",
        {
          requestedSmokeDate: day,
          smoker: "Chef House",
          rawKg: "10",
          lines: JSON.stringify(lines.map(([lotId, kg]) => ({ lotId, kg }))),
        },
        "",
      );
    expect(order([["F000000-999", "1"]]).error).toMatch(/ไม่พบ PO ซื้อ/);
    expect(
      order([
        [po, "1"],
        [po, "2"],
      ]).error,
    ).toMatch(/ซ้ำ/);
    // A typed bad kg is refused; zero only warns and an empty kg is saved as missing (GEN-02).
    expect(order([[po, "-1"]]).error).toMatch(/มากกว่าศูนย์/);
    expectWarning(order([[po, "0"]]), /เป็นศูนย์/);
    expect(order([[po, ""]]).error).toBe("");
    let missing: string | undefined;
    s.dry(() => {
      s.run(
        "owner",
        "smokeOrder",
        {
          requestedSmokeDate: day,
          smoker: "Chef House",
          rawKg: "10",
          lines: JSON.stringify([{ lotId: po, kg: "" }]),
        },
        "",
      );
      missing = last(s).values.missing;
    });
    expect(missing).toBe("lines");

    expectWarning(order([[po, "10"]]), /ยังไม่มี Invoice เนื้อ/);
    expectWarning(
      order([[po, "101"]]),
      new RegExp(`เกินยอดคงเหลือของ ${s.db.lots[0].poId}`),
    );
  });

  test("LNK-04 a branch receive with no lot, then a link, moves its balance to that batch", () => {
    const s = ready();
    const batch = s.db.lots.at(-1)!.id;
    s.run("branch", "receive", { kg: "10" }, "");
    const receive = last(s);
    expect(balance(s.db, "", "ศาลาแดง").received).toBe(10);
    expect(balance(s.db, batch, "ศาลาแดง").received).toBe(0);
    expect(centralStock(s.db, batch)).toBe(35);
    // Another branch may not link it; the branch itself and the Owner may (LNK-01).
    expect(() =>
      mutate(
        s.db,
        "branch",
        "link",
        { targetId: receive.id, lotId: batch },
        "",
        day,
        "มีนบุรี",
      ),
    ).toThrow(/ไม่มีสิทธิ์/);
    expect(() =>
      s.run(
        "branch",
        "link",
        { targetId: receive.id, lotId: "S000000-999" },
        "",
      ),
    ).toThrow(/ไม่พบชุดรมควัน/);
    expect(() => s.run("branch", "link", { targetId: receive.id }, "")).toThrow(
      /เลือกชุด/,
    );
    s.run("branch", "link", { targetId: receive.id, lotId: batch }, "");
    expect(balance(s.db, "", "ศาลาแดง").received).toBe(0);
    expect(balance(s.db, batch, "ศาลาแดง").received).toBe(10);
    // RET-04: a receive straight from the batch comes off central stock.
    expect(centralStock(s.db, batch)).toBe(25);
    // BR-05: a sale in the bucket costs nothing until it is linked.
    s.run("branch", "thaw", { kg: "1" }, "");
    s.run("branch", "receive", { kg: "1" }, "");
    expect(saleCost(s.db, last(s))).toMatchObject({
      meatCost: 0,
      unlinked: true,
    });
    // LNK-05: the latest link wins, and voiding it goes back to the one before.
    const move = () =>
      s.run("owner", "link", { targetId: receive.id, lotId: batch }, "");
    move();
    expect(balance(s.db, batch, "ศาลาแดง").received).toBe(10);
    s.run("owner", "void", { targetId: last(s).id, reason: "x" }, "");
    expect(balance(s.db, batch, "ศาลาแดง").received).toBe(10);
    // LNK-03: only branch meat and material receipts link.
    const central = entries(s.db, "central")[0];
    expect(() =>
      s.run("owner", "link", { targetId: central.id, lotId: batch }, ""),
    ).toThrow(/ผูกย้อนหลังไม่ได้/);
  });

  test("MAT-01 a material receipt with no transfer counts at the branch and links to one later", () => {
    const s = setup();
    s.run(
      "branch",
      "materialConfirm",
      { material: materials[0], receivedQuantity: "5", receiver: "นิด" },
      "",
    );
    expect(branchMaterialStock(s.db, "ศาลาแดง", 0)).toBe(5);
    expect(ownerMaterialStock(s.db, materials[0])).toBe(0);
    s.run(
      "owner",
      "materialReceive",
      {
        purchaseDate: day,
        material: materials[0],
        quantity: "20",
        unitPrice: "1",
        supplier: "x",
      },
      "",
    );
    s.run(
      "owner",
      "materialTransfer",
      {
        material: materials[0],
        branch: "ศาลาแดง",
        quantity: "5",
        receiver: "นิด",
      },
      "",
    );
    const transfer = last(s);
    expect(branchMaterialStock(s.db, "ศาลาแดง", 0)).toBe(5);
    const confirm = entries(s.db, "materialConfirm")[0];
    s.run(
      "branch",
      "link",
      { targetId: confirm.id, transferId: transfer.id },
      "",
    );
    expect(entries(s.db, "materialConfirm")[0].values.transferId).toBe(
      transfer.id,
    );
    expect(branchMaterialStock(s.db, "ศาลาแดง", 0)).toBe(5);
    // The transfer is taken: a second receipt on it is refused (GEN-06).
    expect(() =>
      s.run(
        "branch",
        "materialConfirm",
        { transferId: transfer.id, receivedQuantity: "5", receiver: "นิด" },
        "",
      ),
    ).toThrow(/ยืนยันรับรายการนี้แล้ว/);
  });

  test("DASH-07 sales, cost and profit of a fully linked day are what they were before A0", () => {
    const s = chillDay();
    const sales = entries(s.db, "sale");
    const costs = sales.map((sale) => saleCost(s.db, sale));
    expect(sales.reduce((sum, e) => sum + Number(e.values.revenue), 0)).toBe(
      209600,
    );
    expect(costs.reduce((sum, c) => sum + c.meatCost, 0)).toBeCloseTo(
      44121.5278,
      3,
    );
    expect(costs.reduce((sum, c) => sum + c.wasteCost, 0)).toBe(0);
    expect(lotCost(s.db, s.db.lots.at(-1)!)).toMatchObject({
      meat: 24500,
      smoke: 22000,
      smokingCostSource: "estimate",
      freight: 2000,
      total: 48500,
    });
    expect(lotCost(s.db, s.db.lots.at(-1)!).perKg).toBeCloseTo(673.6111, 3);
    // The seven-day roleplay: same meat and freight; its smoking fee is now the invoiced 11,440 (D8).
    const db = sevenDayRoleplay(day);
    expect(
      entries(db, "sale").reduce((sum, e) => sum + Number(e.values.revenue), 0),
    ).toBe(68600);
    expect(lotCost(db, db.lots.at(-1)!)).toMatchObject({
      meat: 12500,
      smoke: 11440,
      smokingCostSource: "invoice",
      freight: 2000,
    });
  });
});
