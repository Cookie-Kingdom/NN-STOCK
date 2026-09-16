import { describe, expect, test } from "vitest";
import {
  availableBags,
  averageYield,
  balance,
  branchMaterialStock,
  branches,
  centralBagStock,
  centralStock,
  chiliAllocated,
  chiliStock,
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
  packWeights,
  processLoss,
  produced,
  producedBags,
  rawAtFoodiva,
  pendingSmokeKg,
  preSmokeTrimKg,
  rawAtSmoker,
  rawRiceStock,
  readyForChefHouse,
  revenue,
  seed,
  sevenDayRoleplay,
  smokeServiceRate,
  smokingInvoiceStatus,
  steakRawStock,
  validPackWeights,
  visibleEntries,
  type Database,
  type Entry,
  type Lot,
  type Values,
} from "@/lib/store";
import {
  confirm,
  day,
  invoice,
  last,
  packs,
  purchase,
  purchaseInfo,
  ready,
  readyToDispatch,
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
      poId: "PO-1",
      stage: 8,
      config: {},
      values: {
        dispatchKg: "10",
        price: "250",
        outboundCost: "2000",
        returnCost: "0",
      },
    };
    const db = withEntries(
      entry({
        kind: "smokeOrder",
        role: "owner",
        lotId: "L1",
        values: { estimatedCost: "2200" },
      }),
    );
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
      values: { wasteCost: "1", packs: "1" },
    });
    const db = withEntries(sala, minburi, smoke);
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
      s.run("owner", "allocate", { branch: "มีนบุรี", kg: "1", bags: "1" }),
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
    const rice = { supplier: "x", rawRiceKg: "1", rawRiceCost: "1" };
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
      supplier: "x",
      cookedRiceKg: "30",
      cookedRiceCost: "1350",
    };
    const rawRice = { supplier: "x", rawRiceKg: "1", rawRiceCost: "1" };
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

  test("smoke PO waits for Foodiva, is capped at the ready weight and prices the service", () => {
    const s = setup();
    purchase(s, "40");
    const order = (rawKg: string) =>
      s.run("owner", "smokeOrder", {
        requestedSmokeDate: day,
        smoker: "Chef_house",
        rawKg,
      });
    expect(() => order("40")).toThrow(/รอ Foodiva/);
    confirm(s, "40", "30");
    expect(() => order("31")).toThrow(/เกินยอด/);
    order("30");
    expect(last(s).values).toMatchObject({
      serviceRate: "220",
      estimatedCost: "6600",
      orderNumber: "SO-2026-0001",
      status: "Sent",
    });
    expect(() =>
      s.run("cm", "smokingInvoice", {
        invoiceNumber: "CH-1",
        invoiceDate: day,
        attachment: "x",
      }),
    ).toThrow(/ยืนยันรับ PO/);
  });

  test("smoking invoice goes from review to payment and cannot be paid twice", () => {
    const s = setup();
    purchase(s, "40");
    confirm(s, "40");
    const smokingInvoice = invoice(s, "40");
    expect(smokingInvoice.values).toMatchObject({
      serviceRate: "220",
      amountBeforeVat: "8800",
      netPayable: "8800",
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
    expect(() => pay("8800")).toThrow(/ต้องรับยอด/);
    review("รับยอด");
    expect(status()).toBe("รอชำระ");
    expect(() => pay("8000")).toThrow(/เท่ากับยอดสุทธิ/);
    pay("8800");
    expect(status()).toBe("ชำระแล้ว");
    expect(() => review("รับยอด")).toThrow(/ชำระแล้ว/);
  });

  test("raw meat at Foodiva shrinks with owner waste pickups and Steak transfers", () => {
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
    expect(rawAtFoodiva(s.db, lot())).toBe(36);
    const steak = (quantityKg: string) =>
      s.run("owner", "steakTransfer", {
        transferDate: day,
        quantityKg,
        reason: "Steak Production",
      });
    expect(() => steak("37")).toThrow(/ไม่พอ/);
    steak("5");
    expect(last(s).values.transferNumber).toBe("TR-2026-0001");
    expect(steakRawStock(s.db)).toBe(5);
    expect(rawAtFoodiva(s.db, lot())).toBe(31);
    expect(rawAtFoodiva(s.db, { ...lot(), id: `${id}-R1` })).toBe(0);
  });

  test("dispatch waits for a paid smoking invoice and cannot exceed Foodiva's ready weight", () => {
    const s = setup();
    s.run("owner", "purchase", {
      ...purchaseInfo,
      orderedKg: "40",
      price: "10",
    });
    expect(() =>
      s.run("owner", "dispatch", { ...send, dispatchKg: "40" }),
    ).toThrow(/Foodiva/);
    const t = setup();
    readyToDispatch(t, "40");
    expect(() =>
      t.run("owner", "dispatch", { ...send, dispatchKg: "41" }),
    ).toThrow(/เกิน/);
    t.run("owner", "dispatch", {
      ...send,
      trip: "เที่ยวเดียว",
      dispatchKg: "40",
    });
    expect(t.db.lots[0].stage).toBe(2);
    expect(t.db.lots[0].values.outboundCost).toBe("1200");
    expect(last(t).values.transferNumber).toBe("TR-2026-0001");
  });

  test("smoke batches validate bag weights and close the stage when the input is used up", () => {
    const s = setup();
    readyToDispatch(s, "50");
    s.run("owner", "dispatch", { ...send, dispatchKg: "50" });
    s.run("cm", "cmReceive", { receivedKg: "49", arrival: "08:00" });
    s.run("cm", "prepare", { preSmokeKg: "48" });
    const lot = () => s.db.lots[0];
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
    readyToDispatch(s, "50");
    s.run("owner", "dispatch", { ...send, dispatchKg: "50" });
    s.run("cm", "cmReceive", { receivedKg: "50", arrival: "08:00" });
    s.run("cm", "prepare", { preSmokeKg: "50" });
    s.run("cm", "smoke", { smokeDate: day, inputKg: "50", wasteKg: "5", packs: packs(450) });
    const id = s.db.lots[0].id;
    const lot = s.db.lots[0];
    delete last(s).values.postSmokeKg;
    delete lot.values.preSmokeKg;
    expect(produced(s.db, id)).toBeCloseTo(45);
    expect(processLoss(s.db, id)).toBeCloseTo(5);
    expect(averageYield(s.db)).toBeCloseTo(90);
    expect(pendingSmokeKg(s.db, lot)).toBe(0);
  });

  test("excess pre-smoke, over-smoke and incomplete close blocked", () => {
    const s = setup();
    readyToDispatch(s, "10");
    s.run("owner", "dispatch", { ...send, dispatchKg: "10" });
    s.run("cm", "cmReceive", { receivedKg: "10", arrival: "08:00" });
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
    const id = s.db.lots[0].id;
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
          receivedKg: "49",
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
    expect(s.db.lots[0].stage).toBe(5);
    s.run("cm", "closeLot", { confirm: "x" }, id);
    expect(() =>
      edit(
        {},
        smokes.map((item) => draft(item)),
      ),
    ).toThrow(/ก่อนยืนยันปิด Lot/);
  });

  test("allocating by bag id takes those bags out of central stock once", () => {
    const s = ready();
    const id = s.db.lots[0].id;
    const bags = availableBags(s.db, id);
    expect(bags).toHaveLength(360);
    // 360 bags weighed 0.1 at the smoker, 35 kg on the central scale: each bag carries its share.
    const bagKg = 35 / 360;
    expect(bags[0].id).toBe(`${entries(s.db, "smoke", id)[0].id}:1`);
    expect(bags[0].weight).toBeCloseTo(bagKg);
    const bagIds = bags
      .slice(0, 3)
      .map((bag) => bag.id)
      .join(",");
    s.run("owner", "allocate", {
      branch: "ศาลาแดง",
      deliveryDate: day,
      bagIds,
    });
    expect(last(s).values.bags).toBe("3");
    expect(Number(last(s).values.kg)).toBeCloseTo(3 * bagKg);
    expect(centralBagStock(s.db, id)).toBe(357);
    expect(centralStock(s.db, id)).toBeCloseTo(35 - 3 * bagKg);
    expect(() =>
      s.run("owner", "allocate", {
        branch: "มีนบุรี",
        deliveryDate: day,
        bagIds,
      }),
    ).toThrow(/ถูกจัดสรรไปแล้ว/);
    s.run("owner", "allocate", { branch: "มีนบุรี", kg: "1", bags: "5" });
    expect(centralBagStock(s.db, id)).toBe(352);
  });

  test("every bag can be allocated even when central stock weighs less than the bags", () => {
    const s = ready();
    const id = s.db.lots[0].id;
    const bags = availableBags(s.db, id);
    const half = Math.floor(bags.length / 2);
    for (const [branch, chunk] of [
      ["ศาลาแดง", bags.slice(0, half)],
      ["มีนบุรี", bags.slice(half)],
    ] as const) {
      s.run("owner", "allocate", {
        branch,
        deliveryDate: day,
        bagIds: chunk.map((bag) => bag.id).join(","),
      });
    }
    expect(centralBagStock(s.db, id)).toBe(0);
    expect(centralStock(s.db, id)).toBeCloseTo(0);
  });

  test("a bag sent out at its smoker weight leaves the last bag weighing what is left", () => {
    // QA round 2: two 40 kg bags, 79 kg on the central scale, the first bag allocated
    // as 40 kg before pro-rating existed. The last bag is 39 kg (central stock), not 39.5.
    const s = setup();
    readyToDispatch(s, "90");
    s.run("owner", "dispatch", { ...send, dispatchKg: "90" });
    s.run("cm", "cmReceive", { receivedKg: "88", arrival: "08:00" });
    s.run("cm", "prepare", { preSmokeKg: "85" });
    s.run("cm", "smoke", { smokeDate: day, inputKg: "85", wasteKg: "5", packs: "40\n40" });
    s.run("cm", "closeLot", { confirm: "สมชาย" });
    s.run("owner", "return", {
      returnDate: day,
      returnTime: "09:00",
      origin: "Chef_house",
      destination: "Foodiva",
      vehicleType: "รถห้องเย็น",
      plate: "กข123",
      driverName: "คนขับ",
      driverPhone: "0800000000",
      returnKg: "80",
    });
    s.run("foodiva", "foodivaReturnReceive", {
      receivedDate: day,
      receivedTime: "10:00",
      receivedKg: "79",
      receivedBags: "2",
    });
    s.run("owner", "central", { centralKg: "79" });
    const id = s.db.lots[0].id;
    s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "40", bags: "1" });
    expect(centralStock(s.db, id)).toBe(39);
    const [bag] = availableBags(s.db, id);
    expect(bag.weight).toBeCloseTo(39);
    s.run("owner", "allocate", { branch: "มีนบุรี", deliveryDate: day, bagIds: bag.id });
    expect(Number(last(s).values.kg)).toBeCloseTo(39);
    expect(centralStock(s.db, id)).toBeCloseTo(0);
    expect(centralBagStock(s.db, id)).toBe(0);
  });

  test("over-allocation, over-thaw and cross-branch receive rejected", () => {
    const s = ready();
    expect(() =>
      s.run("owner", "allocate", { branch: "มีนบุรี", kg: "36", bags: "2" }),
    ).toThrow(/ไม่พอ/);
    s.run("owner", "allocate", { branch: "มีนบุรี", kg: "5", bags: "2" });
    expect(() =>
      s.run("branch", "receive", {
        kg: "5",
        bags: "2",
        allocation: last(s).id,
      }),
    ).toThrow(/ไม่ได้จัดสรร/);
    s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5", bags: "2" });
    s.run("branch", "receive", { kg: "5", bags: "2", allocation: last(s).id });
    expect(() => s.run("branch", "thaw", { kg: "6", bags: "2" })).toThrow(
      /ไม่พอ/,
    );
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
    expect(entries(s.db, "materials", undefined, "ศาลาแดง", day)).toHaveLength(2);
    // Only the newest sheet of the day counts, so the fix does not deduct twice.
    expect(branchMaterialStock(s.db, "ศาลาแดง", 0, "2026-09-10")).toBe(60);
  });

  test("Sala Daeng buys and issues raw rice; Min Buri cannot", () => {
    const sala = setup();
    expect(() =>
      sala.run("branch", "riceIssue", { rawRiceIssuedKg: "1", receiver: "x" }),
    ).toThrow(/ไม่พอ/);
    sala.run("branch", "ricePurchase", {
      supplier: "x",
      rawRiceKg: "10",
      rawRiceCost: "500",
    });
    expect(last(sala).values).toMatchObject({
      totalCost: "500",
      cookedRiceKg: "0",
    });
    const minburi = setup("มีนบุรี");
    expect(() =>
      minburi.run("branch", "riceIssue", {
        rawRiceIssuedKg: "1",
        receiver: "x",
      }),
    ).toThrow(/ไม่ต้องเบิก/);
    expect(() =>
      minburi.run("branch", "rice", { rawUsedKg: "1", riceKg: "1" }),
    ).toThrow(/ศาลาแดง/);
  });

  test("Min Buri buys cooked rice to a 30 kg floor and records carry-over", () => {
    const s = setup("มีนบุรี");
    expect(() =>
      s.run("branch", "ricePurchase", {
        supplier: "ครัวข้าวเหนียว",
        cookedRiceKg: "29",
        cookedRiceCost: "1305",
      }),
    ).toThrow(/30 กก/);
    s.run("branch", "ricePurchase", {
      supplier: "ครัวข้าวเหนียว",
      cookedRiceKg: "32",
      cookedRiceCost: "1440",
    });
    expect(cookedRiceStock(s.db, "มีนบุรี")).toBe(32);
    s.run("branch", "riceCarry", {
      leftoverKg: "32",
      reheat: "เก็บไว้อุ่นวันถัดไป",
    });
    expect(last(s).values.reheat).toBe("เก็บไว้อุ่นวันถัดไป");
  });

  test("day close time gate and sales deviation validation", () => {
    const s = ready();
    s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5", bags: "2" });
    s.run("branch", "receive", { kg: "5", bags: "2", allocation: last(s).id });
    s.run("branch", "thaw", { kg: "5", bags: "2" });
    expect(() =>
      s.run("branch", "closeDay", { time: "21:59", confirm: "x" }),
    ).toThrow(/22:00/);
    expect(() =>
      s.run("branch", "closeDay", { time: "22:00", confirm: "x" }),
    ).toThrow(/รายการขาย/);
    expect(() =>
      s.run("branch", "sale", {
        boxes: "10",
        addons: "0",
        chiliAddons: "0",
        soldKg: "2",
        wasteKg: "0",
        riceWasteKg: "0",
        expense: "0",
        lineMan: "3500",
      }),
    ).toThrow(/100–103 กรัม/);
  });
});

test("an influencer box leaves the shelf and costs meat plus postage", () => {
  const s = ready();
  const id = s.db.lots[0].id;
  s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5", bags: "2" });
  s.run("branch", "receive", { kg: "5", bags: "2", allocation: last(s).id });
  s.run("branch", "thaw", { kg: "5", bags: "2" });
  s.run("branch", "ricePurchase", {
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
  const box = {
    influencer: "@nong",
    boxes: "2",
    addons: "0",
    chiliAddons: "1",
    soldKg: "0.202",
    shippingFee: "60",
  };
  expect(() =>
    s.run("branch", "influencerBox", { ...box, influencer: "" }),
  ).toThrow(/อินฟลูเอนเซอร์/);
  expect(() =>
    s.run("branch", "influencerBox", { ...box, soldKg: "9" }),
  ).toThrow(/100–103 กรัม/);
  expect(() =>
    s.run("branch", "influencerBox", {
      ...box,
      chiliAddons: "6",
      soldKg: "0.202",
    }),
  ).toThrow(/น้ำพริก/);
  s.run("branch", "influencerBox", box);
  expect(balance(s.db, id, "ศาลาแดง").ready).toBeCloseTo(4.798, 3);
  expect(cookedRiceStock(s.db, "ศาลาแดง")).toBeCloseTo(9.6, 3);
  expect(chiliStock(s.db, "ศาลาแดง")).toBe(4);
  expect(Number(last(s).values.meatCost)).toBeGreaterThan(0);
  // Owner-only: the branch log never shows what the giveaway cost.
  expect(
    visibleEntries(s.db, "branch", "ศาลาแดง").at(-1)!.values.meatCost,
  ).toBeUndefined();
});

test("full loop: partial smoke, central, two branches, partial receipt, sale and lock", () => {
  const s = ready();
  const id = s.db.lots[0].id;
  expect(produced(s.db, id)).toBe(36);
  expect(s.db.lots[0].stage).toBe(8);
  expect(lotCost(s.db, s.db.lots[0]).freight).toBe(2000);
  s.run("owner", "allocate", {
    branch: "ศาลาแดง",
    kg: "10",
    bags: "5",
    deliveryDate: day,
  });
  const allocation = last(s).id;
  s.run("owner", "allocate", {
    branch: "มีนบุรี",
    kg: "5",
    bags: "2",
    deliveryDate: day,
  });
  expect(centralStock(s.db, id)).toBe(20);
  s.run("branch", "receive", {
    kg: "4",
    bags: "2",
    allocation,
    reason: "ทยอยรับ",
  });
  s.run("branch", "receive", { kg: "6", bags: "3", allocation });
  s.run("branch", "thaw", { kg: "4.2", bags: "2" });
  s.run("branch", "ricePurchase", {
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
  s.run("branch", "closeDay", { time: "22:00", confirm: "ผู้ดูแล" });
  expect(isClosed(s.db, "ศาลาแดง", day)).toBe(true);
  expect(() => s.run("branch", "thaw", { kg: "1", bags: "1" })).toThrow(
    /ปิดยอด/,
  );
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
  expect(db.lots).toHaveLength(1);
  expect(db.lots[0].stage).toBe(8);
  expect(entries(db, "closeDay")).toHaveLength(14);
  for (const branch of branches) expect(isClosed(db, branch, day)).toBe(true);
  expect(db.config.branch).toBe("ศาลาแดง");
});
