import { describe, expect, test } from "vitest";
import { today } from "@/lib/format";
import { restoreSaleMoney, stripSaleMoney } from "@/lib/sale-money";
import {
  balance,
  batchKinds,
  branchMaterialStock,
  branches,
  centralStock,
  check,
  chiliStock,
  dateField,
  editBlock,
  editDecisions,
  entries,
  entryEdits,
  isClosed,
  isVoided,
  liveLots,
  lotCost,
  lotProgress,
  materials,
  mutate,
  ownerChiliStock,
  ownerMaterialStock,
  poRemainingKg,
  produced,
  purchaseLots,
  rawRiceStock,
  revenue,
  riceSources,
  shipments,
  smokingInvoiceStatus,
  visibleEntries,
  voidBlock,
  voidableKinds,
  type ActingRole,
  type Database,
  type Entry,
  type EntryKind,
  type Values,
  lotMovableKinds,
  unpack,
} from "@/lib/store";
import { sevenDayRoleplay, thirtyDayRoleplay } from "@/lib/store/demo";
import { editableKinds, entryKinds } from "@/lib/store/model";
import { ownerBranchScenario } from "@/lib/store/scenario";
import {
  chillDay,
  closed,
  confirm,
  day,
  dispatch,
  expectWarning,
  invoice,
  legacyAllocate,
  packingList,
  packs,
  purchase,
  ready,
  readyToDispatch,
  received,
  returned,
  setup,
  smokeOrder,
  smoked,
  type Setup,
} from "./fixtures";

const sala = "ศาลาแดง";
const min = "มีนบุรี";
const earlier = "2026-09-08";

/** `mutate` over a database kept here, so a test can start from any database (fixtures'
 *  `setup` starts from the seed) and act as either branch. `run` returns the entry it saved. */
function from(start: Database, branch = sala) {
  const w = {
    db: start,
    run(
      role: ActingRole,
      kind: EntryKind,
      values: Values = {},
      lotId = "",
      date = day,
      by = branch,
    ) {
      w.db = mutate(w.db, role, kind, values, lotId, date, by);
      return w.db.entries.at(-1)!;
    },
    check(
      role: ActingRole,
      kind: EntryKind,
      values: Values = {},
      lotId = "",
      date = day,
      by = branch,
    ) {
      return check(() => mutate(w.db, role, kind, values, lotId, date, by));
    },
  };
  return w;
}
type World = ReturnType<typeof from>;
/** The Log's "ลบ" (EDT-23). On a delete it is "กู้คืน", on an edit or a link "ย้อนกลับ". */
const del = (
  w: World,
  target: Entry,
  role: ActingRole = "owner",
  by?: string,
) =>
  w.run(
    role,
    "void",
    { targetId: target.id, reason: "บันทึกผิด" },
    "",
    day,
    by,
  );
/** The Log's "แก้ไข" (EDT-22); `move` is `{ toDate }` and/or `{ toLotId }` (EDT-24). */
const edit = (
  w: World,
  target: Entry,
  values: Values = {},
  move: Values = {},
  role: ActingRole = "owner",
  by?: string,
) =>
  w.run(
    role,
    "entryEdit",
    {
      targetId: target.id,
      values: JSON.stringify(values),
      reason: "แก้ตามเอกสาร",
      ...move,
    },
    "",
    day,
    by,
  );
/** Runs a save that the rules may refuse: whether it went through. */
const attempt = (save: () => unknown) => {
  try {
    save();
    return true;
  } catch {
    return false;
  }
};
const live = (db: Database, target: Entry) =>
  entries(db, target.kind).find((e) => e.id === target.id);
const only = (db: Database, kind: EntryKind) => entries(db, kind)[0];
const lotOf = (db: Database, id: string) => db.lots.find((l) => l.id === id)!;
const batchOf = (db: Database) => db.lots.find((l) => l.kind === "shipment")!;
const cache = (db: Database) =>
  Object.fromEntries(db.lots.map((lot) => [lot.id, lot.values]));
/** Every cached value that differs between two databases, as `lot key: before → after`. */
const cacheDiff = (before: Database, after: Database) =>
  before.lots.flatMap((lot) => {
    const now = after.lots.find((l) => l.id === lot.id)?.values ?? {};
    return [...new Set([...Object.keys(lot.values), ...Object.keys(now)])]
      .filter((key) => lot.values[key] !== now[key])
      .map(
        (key) =>
          `${lot.poId} ${key}: ${JSON.stringify(lot.values[key])} → ${JSON.stringify(now[key])}`,
      );
  });
/** The figures the screens read, over the lots still in use: a delete followed by its restore
 *  must leave every one of them where it was. */
const figures = (db: Database) => ({
  lots: Object.fromEntries(
    liveLots(db).map((lot) => [
      lot.id,
      lot.kind
        ? {
            cost: lotCost(db, lot),
            central: centralStock(db, lot.id),
            produced: produced(db, lot.id),
            steps: [...lotProgress(db, lot.id)].sort(),
          }
        : { remaining: poRemainingKg(db, lot.id) },
    ]),
  ),
  branch: Object.fromEntries(
    branches.map((branch) => [
      branch,
      {
        meat: Object.fromEntries(
          [...liveLots(db).map((lot) => lot.id), ""].map((id) => [
            id,
            balance(db, id, branch),
          ]),
        ),
        rawRice: rawRiceStock(db, branch),
        chili: chiliStock(db, branch),
        closed: isClosed(db, branch, day),
      },
    ]),
  ),
  ownerChili: ownerChiliStock(db),
  ownerMaterials: materials.map((m) => ownerMaterialStock(db, m)),
  revenue: revenue(db),
});
/** Live entries standing on a lot that is deleted: there must be none on a purchase PO. */
const onDeletedPo = (db: Database) =>
  entryKinds
    .filter((kind) => !["void", "entryEdit", "link"].includes(kind))
    .flatMap((kind) => entries(db, kind))
    .filter((e) => {
      const lot = db.lots.find((l) => l.id === e.lotId);
      return lot && !lot.kind && lot.values.deleted;
    })
    .map((e) => e.kind);

const cached: EntryKind[] = [
  "purchase",
  "smokeOrder",
  "dispatch",
  "packingList",
  "cmReceive",
  "prepare",
  "smoke",
  "closeLot",
  "return",
  "central",
];
/** Every cached step of `db` edited with nothing proposed, each on its own copy: the
 *  differences the rebuild made to any lot's cache. */
const rebuilt = (db: Database, date = day) =>
  cached.flatMap((kind) =>
    entries(db, kind).flatMap((target) => {
      const after = mutate(
        db,
        "owner",
        "entryEdit",
        { targetId: target.id, values: "{}", reason: "ตรวจ" },
        "",
        date,
      );
      return cacheDiff(db, after).map((line) => `${kind}: ${line}`);
    }),
  );
/** One smoke round as Chef House's correction form sends it (chefEdit `batches`). */
const draft = (round: Entry, change: Values = {}) => ({
  id: round.id,
  smokeDate: day,
  inputKg: round.values.inputKg,
  wasteKg: round.values.wasteKg,
  packs: round.values.packs,
  ...change,
});
const returnTruck = {
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
const sale = {
  boxes: "10",
  chiliAddons: "2",
  soldKg: "1.01",
  wasteKg: "0",
  riceWasteKg: "0",
  expense: "0",
  lineMan: "3560",
};
const material = materials[0];
/** MAT-05: what a material receipt is warned with when the count of `date` has to be saved again. */
const recount = (date: string) =>
  `วันที่ ${date} ตรวจนับวัสดุไปแล้ว · บันทึกยอดตรวจนับของวันนั้นอีกครั้งให้ยอดตรงกัน`;

/** One of everything, in the usual order: a purchase PO with Foodiva's invoice, its payment and
 *  the Owner's waste pick-up; a batch from smoke PO to central stock with its smoking invoice
 *  reviewed and paid; the Owner's chili and material purchases and an expense; ศาลาแดง's day
 *  (the chili and the material it received among it), closed and unlocked. Returns the database after each save, so `at(-1)` is the whole flow. */
function fullFlow() {
  const s = setup();
  const steps: Database[] = [];
  const save = s.run;
  s.run = (...args) => {
    const db = save(...args);
    steps.push(db);
    return db;
  };
  purchase(s, "100");
  confirm(s, "100", "90");
  s.run("owner", "meatPayment", {
    paymentDate: day,
    paidBy: "Owner",
    paidAmount: "1",
  });
  s.run("owner", "ownerWasteReceive", {
    receivedDate: day,
    receivedKg: "4",
    receiver: "Owner",
  });
  smokeOrder(s, [[s.db.lots[0].id, "50"]], "50", "");
  dispatch(s);
  packingList(s, "25\n25");
  s.run("owner", "smokeOrderAccept", { acceptedBy: "Chef House" });
  s.run("owner", "cmReceive", { receivedKg: "49", arrival: "08:00" });
  s.run("owner", "prepare", { preSmokeKg: "48" });
  s.run("owner", "smoke", {
    smokeDate: day,
    inputKg: "20",
    wasteKg: "5",
    packs: packs(150),
  });
  s.run("owner", "smoke", {
    smokeDate: day,
    inputKg: "28",
    wasteKg: "7",
    packs: packs(210),
  });
  s.run("owner", "closeLot", { confirm: "สมชาย" });
  const bill = invoice(s);
  s.run("owner", "invoiceReview", { decision: "รับยอด", reviewedBy: "Owner" });
  s.run("owner", "invoicePayment", {
    paymentDate: day,
    paidBy: "Owner",
    paidAmount: bill.values.netPayable,
  });
  s.run("owner", "return", returnTruck);
  s.run("owner", "foodivaReturnReceive", {
    receivedDate: day,
    receivedTime: "10:00",
    receivedKg: "36",
    receivedBags: "360",
  });
  s.run("owner", "central", { centralKg: "35" });
  const batch = s.db.lots.at(-1)!.id;
  s.run(
    "owner",
    "generalPurchase",
    {
      purchaseDate: day,
      item: "น้ำพริกหลอด",
      purchaseCategory: "วัตถุดิบ",
      unit: "หลอด",
      quantity: "50",
      unitPrice: "6",
      supplier: "ร้านพริก",
    },
    "",
  );
  s.run(
    "branch",
    "chiliReceive",
    { chiliTubes: "20", receiver: "ผู้ดูแล" },
    "",
  );
  s.run(
    "owner",
    "materialReceive",
    {
      purchaseDate: day,
      material,
      quantity: "10",
      unitPrice: "2",
      supplier: "ร้านวัสดุ",
    },
    "",
  );
  s.run(
    "owner",
    "expense",
    { amount: "500", category: "อื่น ๆ", detail: "ค่าที่จอดรถ" },
    "",
  );
  s.run("branch", "receive", { kg: "30" }, batch);
  s.run("branch", "thaw", { kg: "20" }, batch);
  s.run(
    "branch",
    "ricePurchase",
    {
      riceSource: riceSources[0],
      supplier: "ร้านข้าว",
      rawRiceKg: "10",
      rawRiceCost: "550",
    },
    "",
  );
  s.run("branch", "riceIssue", { rawRiceIssuedKg: "5", receiver: "ครัว" }, "");
  s.run("branch", "rice", { rawUsedKg: "4", riceKg: "8" }, "");
  s.run(
    "branch",
    "materialConfirm",
    { material, receivedQuantity: "6", receiver: "ผู้ดูแล" },
    "",
  );
  s.run(
    "branch",
    "influencerBox",
    { influencer: "คุณเอ", boxes: "1", chiliAddons: "1", shippingFee: "50" },
    batch,
  );
  s.run("branch", "sale", sale, batch);
  s.run(
    "branch",
    "materials",
    Object.fromEntries(materials.map((_, i) => [`material${i}`, "10"])),
    "",
  );
  s.run("branch", "riceCarry", { leftoverKg: "0" }, "");
  s.run("branch", "closeDay", { confirm: "ผู้ดูแล" }, "");
  s.run("owner", "unlock", { branch: sala, reason: "แก้ยอดขาย" }, "");
  return steps;
}
const flow = fullFlow();
const whole = flow.at(-1)!;
/** Deletes the flow refuses while something stands on the entry or names it by id: tested on
 *  their own below. */
const held: EntryKind[] = ["purchase", "smokeOrder", "smokingInvoice"];
const label = (e: Entry, index: number) =>
  `${e.kind} (${index + 1}/${whole.entries.length})`;

describe("EDT-23 delete, then restore, every kind of the flow", () => {
  test("the flow holds one of each kind a screen records", () => {
    const missing = voidableKinds.filter(
      (kind) => !whole.entries.some((e) => e.kind === kind),
    );
    // Retired or legacy kinds, the corrections (tested below) and the edits themselves.
    expect(missing).toEqual([
      "chefEdit",
      "allocate",
      "supplyPurchase",
      "supplyIssue",
      "chiliPurchase",
      "chiliIssue",
      "void",
      "entryEdit",
      "link",
      "steakTransfer",
    ]);
  });

  test.each(
    whole.entries
      .map((e, index) => [label(e, index), e] as const)
      .filter(([, e]) => !held.includes(e.kind)),
  )("%s is deleted, then restored as it was", (_, target) => {
    const w = from(whole);
    const gone = del(w, target);
    expect(live(w.db, target)).toBeUndefined();
    expect(isVoided(w.db, target.id)).toBe(true);
    expect(gone.values).toMatchObject({
      targetKind: target.kind,
      targetDate: target.date,
      targetRole: target.role,
      targetBranch: target.branch,
    });

    del(w, gone);
    expect(isVoided(w.db, target.id)).toBe(false);
    expect(live(w.db, target)).toEqual(live(whole, target));
    expect(cacheDiff(whole, w.db)).toEqual([]);
    expect(figures(w.db)).toEqual(figures(whole));
    // Append-only: nothing recorded before was touched.
    expect(w.db.entries.slice(0, whole.entries.length)).toEqual(whole.entries);
  });

  test.each(
    flow
      .slice(1)
      .map(
        (db, index) => [label(db.entries.at(-1)!, index + 1), index] as const,
      ),
  )(
    "deleting %s, the newest entry, leaves the database as it was before it",
    (_, index) => {
      const before = flow[index];
      const w = from(flow[index + 1]);
      del(w, w.db.entries.at(-1)!);
      expect(cacheDiff(before, w.db)).toEqual([]);
      // A lot the entry opened stays as a row, marked deleted.
      for (const lot of w.db.lots.slice(before.lots.length))
        expect(lot.values).toEqual({ deleted: "1" });
      expect(figures(w.db)).toEqual(figures(before));
    },
  );

  test("a Chef House correction is deleted and restored with the values it laid over the rounds", () => {
    const s = smoked();
    const [round1, round2] = entries(s.db, "smoke");
    const w = from(s.db);
    const plain = figures(w.db);
    const fix = w.run(
      "owner",
      "chefEdit",
      {
        arrival: "08:00",
        preSmokeKg: "48",
        batches: JSON.stringify([
          draft(round1, { wasteKg: "4", packs: packs(160) }),
          draft(round2),
        ]),
      },
      round1.lotId,
    );
    const fixed = w.db;
    expect(produced(fixed, round1.lotId)).toBeCloseTo(37);

    const gone = del(w, fix);
    expect(produced(w.db, round1.lotId)).toBeCloseTo(36);
    expect(figures(w.db)).toEqual(plain);
    expect(cacheDiff(s.db, w.db)).toEqual([]);

    del(w, gone);
    expect(figures(w.db)).toEqual(figures(fixed));
    expect(cacheDiff(fixed, w.db)).toEqual([]);
  });
});

describe("EDT-23 the stack: delete, restore, and what is refused", () => {
  /** ศาลาแดง's sale of chillDay, and the database it is in. */
  const sold = () => {
    const db = chillDay().db;
    return {
      w: from(db),
      sale: only(db, "sale"),
      lotId: only(db, "sale").lotId,
    };
  };

  test("only the settings and the retired request kinds cannot be deleted", () => {
    expect(entryKinds.filter((kind) => !voidableKinds.includes(kind))).toEqual([
      "config",
      "editRequest",
      "editDecision",
    ]);
  });

  test("delete, restore, delete and restore again", () => {
    const { w, sale, lotId } = sold();
    const ready = () => balance(w.db, lotId, sala).ready;
    const first = del(w, sale);
    expect(ready()).toBeCloseTo(70);
    del(w, first);
    expect(ready()).toBeCloseTo(4.5);
    const second = del(w, sale);
    expect(ready()).toBeCloseTo(70);
    expect(live(w.db, sale)).toBeUndefined();
    del(w, second);
    expect(ready()).toBeCloseTo(4.5);
    expect(live(w.db, sale)).toEqual(sale);
  });

  test("a restore is not deleted: the entry is deleted again instead", () => {
    const { w, sale } = sold();
    const restore = del(w, del(w, sale));
    expect(voidBlock(w.db, restore, "owner")).toBe(
      "รายการนี้ย้อนกลับไม่ได้ · แก้ไขหรือลบใหม่แทน",
    );
    expect(() => del(w, restore)).toThrow("ย้อนกลับไม่ได้");
    expect(live(w.db, sale)).toEqual(sale);
  });

  test("the undo of an edit is not deleted: the entry is edited again instead", () => {
    const { w, sale } = sold();
    const undo = del(w, edit(w, sale, { soldKg: "60" }));
    expect(only(w.db, "sale").values.soldKg).toBe("65.5");
    expect(() => del(w, undo)).toThrow("ย้อนกลับไม่ได้");
  });

  test("the undo of a link is not deleted: the entry is linked again instead", () => {
    const w = from(ready().db);
    const batch = batchOf(w.db).id;
    const receive = w.run("branch", "receive", { kg: "5" });
    const link = w.run("branch", "link", {
      targetId: receive.id,
      lotId: batch,
    });
    expect(balance(w.db, batch, sala).received).toBe(5);
    const undo = del(w, link);
    expect(balance(w.db, "", sala).received).toBe(5);
    expect(() => del(w, undo)).toThrow("ย้อนกลับไม่ได้");
  });

  test("a deleted entry is not deleted twice", () => {
    const { w, sale } = sold();
    del(w, sale);
    expect(voidBlock(w.db, sale, "owner")).toBe("รายการนี้ถูกลบแล้ว");
    expect(() => del(w, sale)).toThrow("รายการนี้ถูกลบแล้ว");
  });

  test("a delete is not restored twice", () => {
    const { w, sale } = sold();
    const gone = del(w, sale);
    del(w, gone);
    expect(() => del(w, gone)).toThrow("รายการนี้ย้อนกลับแล้ว");
  });

  test("an edit is not undone twice", () => {
    const { w, sale } = sold();
    const fix = edit(w, sale, { soldKg: "60" });
    del(w, fix);
    expect(() => del(w, fix)).toThrow("รายการนี้ย้อนกลับแล้ว");
  });

  test("a deleted entry is not edited", () => {
    const { w, sale } = sold();
    del(w, sale);
    expect(editBlock(w.db, sale, "owner")).toBe("รายการนี้ถูกลบแล้ว");
    expect(() => edit(w, sale, { soldKg: "60" })).toThrow("รายการนี้ถูกลบแล้ว");
  });

  test("the settings cannot be deleted", () => {
    const w = from(setup().db);
    const config = w.run("owner", "config", { ...w.db.config });
    expect(() => del(w, config)).toThrow("รายการชนิดนี้ลบไม่ได้");
  });

  test("a delete naming no entry is refused", () => {
    const { w } = sold();
    expect(() =>
      w.run("owner", "void", { targetId: "nothing", reason: "x" }),
    ).toThrow("ไม่พบรายการ");
  });

  test("an edit made before the delete is still there after the restore", () => {
    const { w, sale } = sold();
    edit(w, sale, { soldKg: "60" });
    del(w, del(w, sale));
    expect(only(w.db, "sale").values.soldKg).toBe("60");
    expect(entryEdits(w.db, sale.id)).toHaveLength(1);
  });

  test("a restored entry is edited and deleted like any other", () => {
    const { w, sale } = sold();
    del(w, del(w, sale));
    edit(w, sale, { soldKg: "60" });
    expect(only(w.db, "sale").values.soldKg).toBe("60");
    del(w, sale);
    expect(entries(w.db, "sale")).toEqual([]);
  });

  test("a closed day reopens when its closing is deleted and closes again on the restore", () => {
    const w = from(setup().db);
    const close = w.run("branch", "closeDay", { confirm: "ผู้ดูแล" });
    expect(isClosed(w.db, sala, day)).toBe(true);
    const gone = del(w, close, "branch");
    expect(isClosed(w.db, sala, day)).toBe(false);
    del(w, gone, "branch");
    expect(isClosed(w.db, sala, day)).toBe(true);
  });

  test("a day is closed again when its unlock is deleted", () => {
    const w = from(setup().db);
    w.run("branch", "closeDay", { confirm: "ผู้ดูแล" });
    const unlock = w.run("owner", "unlock", { branch: sala, reason: "แก้ยอด" });
    expect(isClosed(w.db, sala, day)).toBe(false);
    const gone = del(w, unlock);
    expect(isClosed(w.db, sala, day)).toBe(true);
    del(w, gone);
    expect(isClosed(w.db, sala, day)).toBe(false);
  });
});

describe("EDT-23 a purchase PO", () => {
  /** One PO of 100 kg, nothing on it. */
  const po = () => {
    const s = setup();
    purchase(s, "100");
    return { s, w: from(s.db), order: only(s.db, "purchase") };
  };

  test("is not deleted while Foodiva's invoice stands on it", () => {
    const { s, order } = po();
    confirm(s, "100");
    const w = from(s.db);
    expect(() => del(w, order)).toThrow(
      "PO นี้ยังมีรายการอื่นหรือ PO รมควันผูกอยู่",
    );
    // With the invoice deleted first the PO goes.
    del(w, only(w.db, "foodivaConfirm"));
    del(w, order);
    expect(purchaseLots(w.db)).toEqual([]);
  });

  test("is not deleted while a smoke PO draws from it", () => {
    const { s, order } = po();
    smokeOrder(s, [[order.lotId, "40"]], "40", "");
    const w = from(s.db);
    expect(() => del(w, order)).toThrow(
      "PO นี้ยังมีรายการอื่นหรือ PO รมควันผูกอยู่",
    );
    del(w, only(w.db, "smokeOrder"));
    del(w, order);
    expect(liveLots(w.db)).toEqual([]);
  });

  test("alone it is deleted: the lot leaves every list but keeps its row", () => {
    const { w, order } = po();
    del(w, order);
    expect(entries(w.db, "purchase")).toEqual([]);
    expect(w.db.lots).toHaveLength(1);
    expect(w.db.lots[0].values).toEqual({ deleted: "1" });
    expect(purchaseLots(w.db)).toEqual([]);
    expect(liveLots(w.db)).toEqual([]);
  });

  test("its number is not used again by the next PO", () => {
    const { s, w, order } = po();
    del(w, order);
    const next = w.run("owner", "purchase", {
      ...only(s.db, "purchase").values,
    });
    expect(next.lotId).not.toBe(order.lotId);
    expect(next.lotId).toMatch(/-002$/);
    expect(lotOf(w.db, next.lotId).poId).toMatch(/-0002$/);
    expect(purchaseLots(w.db).map((lot) => lot.id)).toEqual([next.lotId]);
  });

  test("restoring it brings the lot back with the values it had", () => {
    const { s, w, order } = po();
    del(w, del(w, order));
    expect(w.db.lots).toEqual(s.db.lots);
    expect(purchaseLots(w.db).map((lot) => lot.id)).toEqual([order.lotId]);
    expect(poRemainingKg(w.db, order.lotId)).toBe(100);
  });

  test("an edited PO is restored with its edited values", () => {
    const { w, order } = po();
    edit(w, order, { orderedKg: "120", price: "260" });
    const edited = cache(w.db);
    del(w, del(w, order));
    expect(cache(w.db)).toEqual(edited);
    expect(poRemainingKg(w.db, order.lotId)).toBe(120);
  });

  test("deleted, it takes no new invoice and no smoke PO line", () => {
    const { s, w, order } = po();
    del(w, order);
    expect(() =>
      w.run(
        "owner",
        "foodivaConfirm",
        {
          invoiceNo: "INV-1",
          invoiceDate: day,
          attachment: "inv.pdf",
          confirmedBy: "Foodiva",
          confirmedKg: "100",
          readyForChiangMaiKg: "100",
          reservedForOwnerKg: "0",
          invoiceAmount: "1",
        },
        order.lotId,
      ),
    ).toThrow("PO นี้ถูกลบแล้ว · กู้คืน PO ก่อน");
    expect(() =>
      w.run("owner", "smokeOrder", {
        requestedSmokeDate: day,
        smoker: "Chef House",
        rawKg: "40",
        lines: JSON.stringify([{ lotId: order.lotId, kg: "40" }]),
      }),
    ).toThrow("ไม่พบ PO ซื้อที่เลือก");
    expect(s.db.lots).toHaveLength(1);
  });

  test("a smoke PO deleted before its PO is not restored while the PO is deleted", () => {
    const { s, order } = po();
    smokeOrder(s, [[order.lotId, "40"]], "40", "");
    const w = from(s.db);
    const gone = del(w, only(w.db, "smokeOrder"));
    del(w, order);
    expect(() => del(w, gone)).toThrow("ไม่พบ PO ซื้อที่เลือก");
  });

  test("an invoice deleted before its PO is restored only after the PO", () => {
    const { s, order } = po();
    confirm(s, "100");
    const w = from(s.db);
    const gone = del(w, only(w.db, "foodivaConfirm"));
    const noPo = del(w, order);
    expect(() => del(w, gone)).toThrow("PO นี้ถูกลบแล้ว · กู้คืน PO ก่อน");
    expect(onDeletedPo(w.db)).toEqual([]);
    del(w, noPo);
    del(w, gone);
    expect(w.db.lots).toEqual(s.db.lots);
    expect(live(w.db, only(s.db, "foodivaConfirm"))).toEqual(
      only(s.db, "foodivaConfirm"),
    );
  });

  test.each([
    ["meatPayment", { paymentDate: day, paidBy: "Owner", paidAmount: "1" }],
    [
      "ownerWasteReceive",
      { receivedDate: day, receivedKg: "1", receiver: "Owner" },
    ],
  ] as const)(
    "a %s deleted before its PO is not restored while the PO is deleted",
    (kind, values) => {
      const { w, order } = po();
      const gone = del(w, w.run("owner", kind, values, order.lotId));
      del(w, order);
      expect(() => del(w, gone)).toThrow("PO นี้ถูกลบแล้ว · กู้คืน PO ก่อน");
    },
  );

  test("the undo of a move does not put an invoice back on a deleted PO", () => {
    const { s, order } = po();
    confirm(s, "100");
    purchase(s, "50");
    const w = from(s.db);
    const other = entries(w.db, "purchase")[1];
    const move = edit(
      w,
      only(w.db, "foodivaConfirm"),
      {},
      {
        toLotId: other.lotId,
      },
    );
    del(w, order);
    expect(() => del(w, move)).toThrow("PO นี้ถูกลบแล้ว · กู้คืน PO ก่อน");
    expect(onDeletedPo(w.db)).toEqual([]);
  });
});

describe("EDT-23 a batch's cached steps", () => {
  /** fixtures' `ready()`: every step from smoke PO to 35 kg in central stock. */
  const batch = () => {
    const db = ready().db;
    const lot = batchOf(db);
    const w = from(db);
    return {
      db,
      w,
      id: lot.id,
      values: () => lotOf(w.db, lot.id).values,
      cost: () => lotCost(w.db, lotOf(w.db, lot.id)),
    };
  };

  test("the transport document: its keys and the round fee leave the batch, and come back", () => {
    const { db, w, values, cost } = batch();
    const gone = del(w, only(db, "dispatch"));
    for (const key of ["pickupDate", "pickupTime", "trip", "outboundCost"])
      expect(values()[key], key).toBeUndefined();
    // What the return truck also wrote stays the return truck's.
    expect(values().transferNumber).toBe(
      only(db, "return").values.transferNumber,
    );
    // No round trip any more: the return leg is charged on its own.
    expect(cost().freight).toBe(Number(db.config.returnFee));
    del(w, gone);
    expect(cacheDiff(db, w.db)).toEqual([]);
    expect(cost().freight).toBe(Number(db.config.roundFee));
  });

  test("the return truck: its keys and fee leave the batch, and come back", () => {
    const { db, w, values } = batch();
    const gone = del(w, only(db, "return"));
    for (const key of ["returnDate", "returnKg", "plate", "returnCost"])
      expect(values()[key], key).toBeUndefined();
    // The places and the number are the outbound document's again.
    expect(values()).toMatchObject({
      origin: only(db, "dispatch").values.origin,
      destination: only(db, "dispatch").values.destination,
      transferNumber: only(db, "dispatch").values.transferNumber,
    });
    del(w, gone);
    expect(cacheDiff(db, w.db)).toEqual([]);
  });

  test("a one-way return: its fee leaves the freight, and comes back", () => {
    const s = closed();
    // fixtures send "ไปกลับ"; this batch went one way and pays the return leg.
    const out = from(s.db);
    edit(out, only(out.db, "dispatch"), { trip: "เที่ยวเดียว" });
    const back = out.run("owner", "return", returnTruck, batchOf(out.db).id);
    const before = out.db;
    const freight = () => lotCost(out.db, batchOf(out.db)).freight;
    const fees = before.config;
    expect(freight()).toBe(Number(fees.outboundFee) + Number(fees.returnFee));
    const gone = del(out, back);
    expect(freight()).toBe(Number(fees.outboundFee));
    del(out, gone);
    expect(freight()).toBe(Number(fees.outboundFee) + Number(fees.returnFee));
    expect(cacheDiff(before, out.db)).toEqual([]);
  });

  test("central stock: the kg leaves the batch and central stock, and comes back", () => {
    const { db, w, id, values, cost } = batch();
    const gone = del(w, only(db, "central"));
    expect(values().centralKg).toBeUndefined();
    expect(centralStock(w.db, id)).toBe(0);
    expect(cost().perKg).toBe(0);
    del(w, gone);
    expect(centralStock(w.db, id)).toBe(35);
    expect(cost()).toEqual(lotCost(db, batchOf(db)));
    expect(cacheDiff(db, w.db)).toEqual([]);
  });

  test("the later smoke round: the batch shows the round before it, and the later one again", () => {
    const { db, w, id, values } = batch();
    const [round1, round2] = entries(db, "smoke");
    const gone = del(w, round2);
    expect(values()).toMatchObject({
      inputKg: round1.values.inputKg,
      packs: round1.values.packs,
      subLot: round1.values.subLot,
    });
    expect(produced(w.db, id)).toBeCloseTo(15);
    del(w, gone);
    expect(values().subLot).toBe(round2.values.subLot);
    expect(produced(w.db, id)).toBeCloseTo(36);
    expect(cacheDiff(db, w.db)).toEqual([]);
  });

  test("the earlier smoke round: the later round stays on the batch throughout", () => {
    const { db, w, id, values } = batch();
    const [round1, round2] = entries(db, "smoke");
    const gone = del(w, round1);
    expect(values().subLot).toBe(round2.values.subLot);
    expect(produced(w.db, id)).toBeCloseTo(21);
    del(w, gone);
    expect(values().subLot).toBe(round2.values.subLot);
    expect(cacheDiff(db, w.db)).toEqual([]);
  });

  test("the weigh-in: its kg and arrival leave the batch, and come back", () => {
    const { db, w, values, cost } = batch();
    const meat = cost().meat;
    const gone = del(w, only(db, "cmReceive"));
    expect(values().receivedKg).toBeUndefined();
    expect(values().arrival).toBeUndefined();
    // Not weighed in: the meat is costed on the smoke PO's 50 kg, not the 49 kg received.
    expect(cost().meat).toBeCloseTo((meat * 50) / 49);
    del(w, gone);
    expect(cost().meat).toBeCloseTo(meat);
    expect(cacheDiff(db, w.db)).toEqual([]);
  });

  test("a second weigh-in recorded after the delete stays the batch's when the first is restored", () => {
    const { db, w, id, values } = batch();
    const gone = del(w, only(db, "cmReceive"));
    w.run("owner", "cmReceive", { receivedKg: "49.5", arrival: "09:00" }, id);
    del(w, gone);
    // Log order: the newest entry counts (GEN-06), whenever the older one came back.
    expect(entries(w.db, "cmReceive", id)).toHaveLength(2);
    expect(values()).toMatchObject({ receivedKg: "49.5", arrival: "09:00" });
  });

  test("with every step deleted the batch is hidden; restoring one brings it back", () => {
    const s = setup();
    readyToDispatch(s, "50");
    dispatch(s);
    const w = from(s.db);
    const id = batchOf(s.db).id;
    del(w, only(s.db, "smokeOrder"));
    expect(shipments(w.db).map((lot) => lot.id)).toEqual([id]);
    const gone = del(w, only(s.db, "dispatch"));
    expect(shipments(w.db)).toEqual([]);
    expect(lotOf(w.db, id).values).toEqual({ deleted: "1" });
    expect(w.db.lots).toHaveLength(2);

    del(w, gone);
    expect(shipments(w.db).map((lot) => lot.id)).toEqual([id]);
    const { lines, requestedKg, ...trip } = lotOf(s.db, id).values;
    expect(lines).toBeDefined();
    expect(requestedKg).toBe("50");
    // Only the transport document is back, so only its values are.
    expect(lotOf(w.db, id).values).toMatchObject({
      trip: trip.trip,
      outboundCost: trip.outboundCost,
      transferNumber: trip.transferNumber,
    });
    expect(lotOf(w.db, id).values.lines).toBeUndefined();
  });

  test("a hidden batch's number is not used again by the next batch", () => {
    const s = setup();
    dispatch(s, "");
    const w = from(s.db);
    const first = batchOf(s.db);
    del(w, only(s.db, "dispatch"));
    const next = w.run("owner", "dispatch", {
      ...only(s.db, "dispatch").values,
    });
    expect(next.lotId).not.toBe(first.id);
    expect(lotOf(w.db, next.lotId).poId).toMatch(/-0002$/);
    expect(shipments(w.db).map((lot) => lot.id)).toEqual([next.lotId]);
  });

  test("a hidden batch takes no new step", () => {
    const s = setup();
    dispatch(s, "");
    const w = from(s.db);
    del(w, only(s.db, "dispatch"));
    expect(() =>
      w.run(
        "owner",
        "cmReceive",
        { receivedKg: "10", arrival: "08:00" },
        batchOf(s.db).id,
      ),
    ).toThrow("ชุดนี้ถูกลบแล้ว · กู้คืนรายการของชุดก่อน");
  });

  test("a batch opened by a step that caches nothing is hidden and brought back too", () => {
    const s = setup();
    s.run(
      "owner",
      "smokingInvoice",
      {
        invoiceNumber: "CH-1",
        invoiceDate: day,
        attachment: "ch.pdf",
        serviceQuantity: "10",
      },
      "",
    );
    const w = from(s.db);
    const gone = del(w, only(s.db, "smokingInvoice"));
    expect(shipments(w.db)).toEqual([]);
    del(w, gone);
    expect(shipments(w.db)).toHaveLength(1);
    expect(cacheDiff(s.db, w.db)).toEqual([]);
  });
});

describe("EDT-24 the date an entry is filed under", () => {
  const sold = () => {
    const db = chillDay().db;
    return { db, w: from(db), sale: only(db, "sale") };
  };

  test("toDate moves the entry to the new day and records where it was", () => {
    const { db, w, sale } = sold();
    const move = edit(w, sale, {}, { toDate: earlier });
    expect(entries(w.db, "sale", undefined, sala, day)).toEqual([]);
    expect(
      entries(w.db, "sale", undefined, sala, earlier).map((e) => e.id),
    ).toEqual([sale.id]);
    expect(move.values).toMatchObject({ fromDate: day, toDate: earlier });
    // The stored entry is untouched: the move is an overlay.
    expect(w.db.entries.slice(0, db.entries.length)).toEqual(db.entries);
  });

  test("a day in the future is refused", () => {
    const { w, sale } = sold();
    expect(() => edit(w, sale, {}, { toDate: "2999-01-01" })).toThrow(
      "ต้องไม่เกินวันนี้",
    );
  });

  test("a day that does not exist is refused", () => {
    const { w, sale } = sold();
    expect(() => edit(w, sale, {}, { toDate: "2026-02-31" })).toThrow(
      "เลือกวันที่ทำรายการ",
    );
  });

  test("undoing the edit moves the entry back", () => {
    const { w, sale } = sold();
    del(w, edit(w, sale, {}, { toDate: earlier }));
    expect(live(w.db, sale)).toEqual(sale);
    expect(entries(w.db, "sale", undefined, sala, earlier)).toEqual([]);
  });

  test("a later edit of its values keeps the entry on the day it was moved to", () => {
    const { w, sale } = sold();
    edit(w, sale, {}, { toDate: earlier });
    const fix = edit(w, sale, { soldKg: "60" });
    expect(live(w.db, sale)).toMatchObject({ date: earlier });
    expect(live(w.db, sale)!.values.soldKg).toBe("60");
    expect(fix.values.fromDate).toBeUndefined();
    expect(fix.values.toDate).toBeUndefined();
    expect(fix.values.targetDate).toBe(earlier);
  });

  test("moved twice, each undo steps back one day", () => {
    const { w, sale } = sold();
    edit(w, sale, {}, { toDate: earlier });
    const second = edit(w, sale, {}, { toDate: "2026-09-07" });
    expect(second.values).toMatchObject({
      fromDate: earlier,
      toDate: "2026-09-07",
    });
    del(w, second);
    expect(live(w.db, sale)!.date).toBe(earlier);
  });

  test("a moved entry that is deleted and restored stays on its new day", () => {
    const { w, sale } = sold();
    edit(w, sale, {}, { toDate: earlier });
    del(w, del(w, sale));
    expect(live(w.db, sale)!.date).toBe(earlier);
  });

  test("a moved day-close closes the new day and reopens the old one", () => {
    const w = from(setup().db);
    const close = w.run("branch", "closeDay", { confirm: "ผู้ดูแล" });
    const move = edit(w, close, {}, { toDate: earlier }, "branch");
    expect(isClosed(w.db, sala, day)).toBe(false);
    expect(isClosed(w.db, sala, earlier)).toBe(true);
    del(w, move, "branch");
    expect(isClosed(w.db, sala, day)).toBe(true);
    expect(isClosed(w.db, sala, earlier)).toBe(false);
  });

  test("a moved sale leaves the day's used kg and joins the new day's", () => {
    const { w, sale } = sold();
    const used = (date: string) =>
      entries(w.db, "sale", sale.lotId, sala, date).reduce(
        (kg, e) => kg + Number(e.values.soldKg),
        0,
      );
    edit(w, sale, {}, { toDate: earlier });
    expect(used(day)).toBe(0);
    expect(used(earlier)).toBe(65.5);
    // Stock is not dated: the lot's balance is what it was.
    expect(balance(w.db, sale.lotId, sala).ready).toBeCloseTo(4.5);
  });

  test("an Owner batch step is moved to another day", () => {
    const db = ready().db;
    const w = from(db);
    const weighIn = only(db, "cmReceive");
    edit(w, weighIn, {}, { toDate: earlier });
    expect(live(w.db, weighIn)!.date).toBe(earlier);
    expect(cacheDiff(db, w.db)).toEqual([]);
  });

  const bought = {
    purchaseDate: day,
    item: "ถุงมือ",
    purchaseCategory: "วัสดุสิ้นเปลือง",
    unit: "กล่อง",
    quantity: "2",
    unitPrice: "80",
    supplier: "ร้านค้า",
  };

  test("a general purchase moves when its purchase date is edited", () => {
    const w = from(setup().db);
    const buy = w.run("owner", "generalPurchase", bought);
    const move = edit(w, buy, { purchaseDate: earlier });
    expect(live(w.db, buy)).toMatchObject({ date: earlier });
    expect(live(w.db, buy)!.values.purchaseDate).toBe(earlier);
    expect(move.values).toMatchObject({ fromDate: day, toDate: earlier });
    expect(entries(w.db, "generalPurchase", undefined, undefined, day)).toEqual(
      [],
    );
    del(w, move);
    expect(live(w.db, buy)).toEqual(buy);
  });

  test("a material purchase moves when its purchase date is edited", () => {
    const w = from(setup().db);
    const buy = w.run("owner", "materialReceive", {
      purchaseDate: day,
      material,
      quantity: "10",
      unitPrice: "1",
      supplier: "ร้านวัสดุ",
    });
    edit(w, buy, { purchaseDate: earlier });
    expect(live(w.db, buy)).toMatchObject({ date: earlier });
    expect(ownerMaterialStock(w.db, material)).toBe(10);
  });

  test("the Owner's waste pick-up moves when its received date is edited", () => {
    const s = setup();
    purchase(s, "100");
    confirm(s, "100", "90");
    const w = from(s.db);
    const pickUp = w.run(
      "owner",
      "ownerWasteReceive",
      { receivedDate: day, receivedKg: "4", receiver: "Owner" },
      s.db.lots[0].id,
    );
    edit(w, pickUp, { receivedDate: earlier });
    expect(live(w.db, pickUp)).toMatchObject({ date: earlier });
  });

  test("a purchase date in the future is refused", () => {
    const w = from(setup().db);
    const buy = w.run("owner", "generalPurchase", bought);
    expect(() => edit(w, buy, { purchaseDate: "2999-01-01" })).toThrow(
      "ต้องไม่เกินวันนี้",
    );
  });

  test("toDate on a kind filed under a field of its own sets that field", () => {
    const w = from(setup().db);
    const buy = w.run("owner", "generalPurchase", bought);
    const move = edit(w, buy, {}, { toDate: earlier });
    expect(live(w.db, buy)).toMatchObject({ date: earlier });
    expect(live(w.db, buy)!.values.purchaseDate).toBe(earlier);
    expect(move.values).toMatchObject({
      fromDate: day,
      toDate: earlier,
      "from.purchaseDate": day,
      "to.purchaseDate": earlier,
    });
  });

  test("the field wins when the edit gives it and a toDate", () => {
    const w = from(setup().db);
    const buy = w.run("owner", "generalPurchase", bought);
    edit(w, buy, { purchaseDate: "2026-09-07" }, { toDate: earlier });
    expect(live(w.db, buy)).toMatchObject({ date: "2026-09-07" });
    expect(live(w.db, buy)!.values.purchaseDate).toBe("2026-09-07");
  });
});

describe("EDT-24 the lot an entry is recorded on", () => {
  /** Batch A weighed in at Chef House, batch B trucked but not weighed in yet. */
  const two = () => {
    const s = setup();
    received(s, "50", "25\n25", "24.5\n24.5");
    const a = s.db.lots.at(-1)!.id;
    readyToDispatch(s, "40");
    dispatch(s);
    const b = s.db.lots.at(-1)!.id;
    return { db: s.db, w: from(s.db), a, b, weighIn: only(s.db, "cmReceive") };
  };

  test("a weigh-in moved to another batch leaves the first batch's cache and joins the other's", () => {
    const { db, w, a, b, weighIn } = two();
    const move = edit(w, weighIn, {}, { toLotId: b });
    expect(move.values).toMatchObject({ fromLotId: a, toLotId: b });
    expect(entries(w.db, "cmReceive", a)).toEqual([]);
    expect(entries(w.db, "cmReceive", b).map((e) => e.id)).toEqual([
      weighIn.id,
    ]);
    expect(lotOf(w.db, a).values.receivedKg).toBeUndefined();
    expect(lotOf(w.db, a).values.arrival).toBeUndefined();
    expect(lotOf(w.db, b).values).toMatchObject({
      receivedKg: "49",
      arrival: "08:00",
    });
    expect(lotProgress(w.db, a).has("cmReceive")).toBe(false);
    expect(lotProgress(w.db, b).has("cmReceive")).toBe(true);
    // Nothing else of either batch moved.
    expect(
      cacheDiff(db, w.db).filter((line) => !/receivedKg|arrival/.test(line)),
    ).toEqual([]);
  });

  test("undoing the move restores both batches", () => {
    const { db, w, b, weighIn } = two();
    del(w, edit(w, weighIn, {}, { toLotId: b }));
    expect(live(w.db, weighIn)).toEqual(weighIn);
    expect(cacheDiff(db, w.db)).toEqual([]);
    expect(figures(w.db)).toEqual(figures(db));
  });

  test("an entry moved and edited at once lands on the other batch with the new values", () => {
    const { w, b, weighIn } = two();
    edit(w, weighIn, { receivedKg: "39" }, { toLotId: b });
    expect(lotOf(w.db, b).values.receivedKg).toBe("39");
    expect(live(w.db, weighIn)).toMatchObject({ lotId: b });
  });

  test("a moved entry that is deleted leaves the batch it was moved to, and returns to it", () => {
    const { w, a, b, weighIn } = two();
    edit(w, weighIn, {}, { toLotId: b });
    const moved = cache(w.db);
    const gone = del(w, weighIn);
    expect(lotOf(w.db, b).values.receivedKg).toBeUndefined();
    expect(lotOf(w.db, a).values.receivedKg).toBeUndefined();
    del(w, gone);
    expect(cache(w.db)).toEqual(moved);
  });

  test("a batch left with no step by a move is hidden, and is back when the move is undone", () => {
    const s = setup();
    dispatch(s, "");
    const a = s.db.lots.at(-1)!.id;
    received(s, "50");
    const b = s.db.lots.at(-1)!.id;
    const w = from(s.db);
    const move = edit(w, entries(s.db, "dispatch", a)[0], {}, { toLotId: b });
    expect(shipments(w.db).map((lot) => lot.id)).toEqual([b]);
    expect(lotOf(w.db, a).values).toEqual({ deleted: "1" });
    del(w, move);
    expect(shipments(w.db).map((lot) => lot.id)).toEqual([a, b]);
    expect(cacheDiff(s.db, w.db)).toEqual([]);
  });

  test("Foodiva's invoice moved to another PO takes its ready kg with it", () => {
    const s = setup();
    purchase(s, "100");
    confirm(s, "80");
    purchase(s, "60");
    const [one, other] = s.db.lots.map((lot) => lot.id);
    const w = from(s.db);
    edit(w, only(s.db, "foodivaConfirm"), {}, { toLotId: other });
    // Without an invoice a PO offers its ordered kg; with one, the invoice's.
    expect(poRemainingKg(w.db, one)).toBe(100);
    expect(poRemainingKg(w.db, other)).toBe(80);
  });

  test("a PO is its own lot: it does not move", () => {
    const s = setup();
    purchase(s, "100");
    purchase(s, "60");
    const w = from(s.db);
    expect(() =>
      edit(w, only(s.db, "purchase"), {}, { toLotId: s.db.lots[1].id }),
    ).toThrow("ย้าย Lot ของรายการนี้ไม่ได้");
  });

  test.each(["receive", "thaw", "sale"] as const)(
    "a branch's %s does not move by an edit (that is a link)",
    (kind) => {
      const s = chillDay();
      received(s, "50");
      const other = s.db.lots.at(-1)!.id;
      const w = from(s.db);
      const target = only(s.db, kind);
      expect(() => edit(w, target, {}, { toLotId: other })).toThrow(
        "ย้าย Lot ของรายการนี้ไม่ได้",
      );
      expect(() => edit(w, target, {}, { toLotId: other }, "branch")).toThrow(
        "ย้าย Lot ของรายการนี้ไม่ได้",
      );
    },
  );

  test("a lot that does not exist is refused", () => {
    const { w, weighIn } = two();
    expect(() => edit(w, weighIn, {}, { toLotId: "S000000-999" })).toThrow(
      "ย้าย Lot ของรายการนี้ไม่ได้",
    );
  });

  test("a deleted batch is refused", () => {
    const s = setup();
    received(s, "50");
    dispatch(s, "");
    const hidden = s.db.lots.at(-1)!.id;
    const w = from(s.db);
    del(w, entries(s.db, "dispatch", hidden)[0]);
    expect(() =>
      edit(w, only(s.db, "cmReceive"), {}, { toLotId: hidden }),
    ).toThrow("ย้าย Lot ของรายการนี้ไม่ได้");
  });

  test("a batch step is not moved onto a purchase PO", () => {
    const { db, w, weighIn } = two();
    expect(() =>
      edit(w, weighIn, {}, { toLotId: purchaseLots(db)[0].id }),
    ).toThrow("รายการนี้ต้องทำกับการส่ง ไม่ใช่ PO ซื้อ");
  });

  test("Foodiva's invoice is not moved onto a batch", () => {
    const { db, w, a } = two();
    expect(() =>
      edit(w, only(db, "foodivaConfirm"), {}, { toLotId: a }),
    ).toThrow("รายการนี้ต้องทำกับ PO ซื้อ");
  });
});

describe("EDT-22 a branch changes its own entries directly", () => {
  /** ศาลาแดง's chillDay (70 kg received and thawed, 65.5 kg sold), an old Owner allocation of
   *  1 kg addressed to ศาลาแดง, and มีนบุรี's receive of 1 kg on the same batch. */
  const day1 = () => {
    const s = chillDay();
    const sent = legacyAllocate(s, { branch: sala, kg: "1" });
    const w = from(s.db);
    const lotId = only(w.db, "sale").lotId;
    const theirs = w.run("branch", "receive", { kg: "1" }, lotId, day, min);
    return { w, db: w.db, lotId, sale: only(w.db, "sale"), theirs, sent };
  };

  test("its edit applies at once, with no request and no approval", () => {
    const { w, lotId, sale } = day1();
    const fix = edit(w, sale, { soldKg: "60" }, {}, "branch");
    expect(only(w.db, "sale").values.soldKg).toBe("60");
    expect(balance(w.db, lotId, sala).ready).toBeCloseTo(10);
    expect(fix).toMatchObject({
      kind: "entryEdit",
      role: "branch",
      branch: sala,
    });
  });

  test("the Owner's log holds the branch's edit, with whose entry it changed", () => {
    const { w, sale } = day1();
    const fix = edit(w, sale, { soldKg: "60" }, {}, "branch");
    const seen = visibleEntries(w.db, "owner").find((e) => e.id === fix.id);
    expect(seen?.values).toMatchObject({
      targetId: sale.id,
      targetKind: "sale",
      targetRole: "branch",
      targetBranch: sala,
      "from.soldKg": "65.5",
      "to.soldKg": "60",
      reason: "แก้ตามเอกสาร",
    });
  });

  test("another branch's entry is refused for an edit", () => {
    const { w, theirs } = day1();
    expect(editBlock(w.db, theirs, "branch", sala)).toBe(
      "แก้ไขได้เฉพาะรายการของบัญชีนี้",
    );
    expect(() => edit(w, theirs, { kg: "2" }, {}, "branch")).toThrow(
      "แก้ไขได้เฉพาะรายการของบัญชีนี้",
    );
  });

  test("another branch's entry is refused for a delete", () => {
    const { w, theirs } = day1();
    expect(voidBlock(w.db, theirs, "branch", sala)).toBe(
      "ลบได้เฉพาะรายการของบัญชีนี้",
    );
    expect(() => del(w, theirs, "branch")).toThrow(
      "ลบได้เฉพาะรายการของบัญชีนี้",
    );
  });

  test("an Owner entry is refused for an edit, also one addressed to the branch", () => {
    const { w, sent } = day1();
    expect(() => edit(w, sent, { kg: "2" }, {}, "branch")).toThrow(
      "แก้ไขได้เฉพาะรายการของบัญชีนี้",
    );
    expect(() =>
      edit(w, only(w.db, "central"), { centralKg: "99" }, {}, "branch"),
    ).toThrow("แก้ไขได้เฉพาะรายการของบัญชีนี้");
  });

  test("an Owner entry is refused for a delete, also one addressed to the branch", () => {
    const { w, sent } = day1();
    expect(() => del(w, sent, "branch")).toThrow("ลบได้เฉพาะรายการของบัญชีนี้");
    expect(() => del(w, only(w.db, "central"), "branch")).toThrow(
      "ลบได้เฉพาะรายการของบัญชีนี้",
    );
  });

  test("a branch account with no branch changes nothing", () => {
    const { w, sale } = day1();
    expect(() => edit(w, sale, { soldKg: "60" }, {}, "branch", "")).toThrow(
      "ไม่พบสาขาของบัญชีนี้",
    );
    expect(() => del(w, sale, "branch", "")).toThrow("ไม่พบสาขาของบัญชีนี้");
  });

  test("it deletes and restores its own entry", () => {
    const { w, lotId, sale } = day1();
    const gone = del(w, sale, "branch");
    expect(gone).toMatchObject({ kind: "void", role: "branch", branch: sala });
    expect(balance(w.db, lotId, sala).ready).toBeCloseTo(70);
    del(w, gone, "branch");
    expect(balance(w.db, lotId, sala).ready).toBeCloseTo(4.5);
    expect(live(w.db, sale)).toEqual(sale);
  });

  test("it cannot restore what the Owner deleted", () => {
    const { w, sale } = day1();
    const gone = del(w, sale);
    expect(() => del(w, gone, "branch")).toThrow("ลบได้เฉพาะรายการของบัญชีนี้");
    expect(live(w.db, sale)).toBeUndefined();
  });

  test("it cannot undo the Owner's edit of its entry", () => {
    const { w, sale } = day1();
    const fix = edit(w, sale, { soldKg: "60" });
    expect(() => del(w, fix, "branch")).toThrow("ลบได้เฉพาะรายการของบัญชีนี้");
    expect(only(w.db, "sale").values.soldKg).toBe("60");
  });

  test("it edits again on top of the Owner's edit", () => {
    const { w, sale } = day1();
    edit(w, sale, { soldKg: "60" });
    const again = edit(w, sale, { soldKg: "61" }, {}, "branch");
    expect(only(w.db, "sale").values.soldKg).toBe("61");
    expect(again.values["from.soldKg"]).toBe("60");
    // Undoing its own edit shows the Owner's again.
    del(w, again, "branch");
    expect(only(w.db, "sale").values.soldKg).toBe("60");
  });

  test("the Owner undoes the branch's edit", () => {
    const { w, sale } = day1();
    const fix = edit(w, sale, { soldKg: "60" }, {}, "branch");
    del(w, fix);
    expect(only(w.db, "sale").values.soldKg).toBe("65.5");
  });

  test("the Owner restores the branch's delete", () => {
    const { w, sale } = day1();
    const gone = del(w, sale, "branch");
    del(w, gone);
    expect(live(w.db, sale)).toEqual(sale);
    // Restored by the Owner, the branch may still delete it again.
    del(w, sale, "branch");
    expect(live(w.db, sale)).toBeUndefined();
  });

  test("only the latest edit of an entry is undone", () => {
    const { w, sale } = day1();
    const older = edit(w, sale, { soldKg: "60" }, {}, "branch");
    const newer = edit(w, sale, { soldKg: "61" }, {}, "branch");
    expect(voidBlock(w.db, older, "branch", sala)).toBe(
      "ย้อนกลับการแก้ไขล่าสุดของรายการนี้ก่อน",
    );
    expect(() => del(w, older, "branch")).toThrow(
      "ย้อนกลับการแก้ไขล่าสุดของรายการนี้ก่อน",
    );
    expect(() => del(w, older)).toThrow(
      "ย้อนกลับการแก้ไขล่าสุดของรายการนี้ก่อน",
    );
    // Newest first, the stack unwinds to the entry as it was recorded.
    del(w, newer, "branch");
    expect(only(w.db, "sale").values.soldKg).toBe("60");
    del(w, older, "branch");
    expect(only(w.db, "sale").values).toEqual(sale.values);
  });

  test("an older edit under the Owner's is not undone by the branch", () => {
    const { w, sale } = day1();
    const mine = edit(w, sale, { soldKg: "60" }, {}, "branch");
    edit(w, sale, { soldKg: "61" });
    expect(() => del(w, mine, "branch")).toThrow(
      "ย้อนกลับการแก้ไขล่าสุดของรายการนี้ก่อน",
    );
  });

  test("a forged edit by a branch of another branch's entry is ignored", () => {
    const { db, theirs } = day1();
    const forged: Entry = {
      ...theirs,
      id: "forged-edit",
      kind: "entryEdit",
      branch: sala,
      values: { targetId: theirs.id, "to.kg": "50", toDate: earlier },
    };
    const log = { ...db, entries: [...db.entries, forged] };
    expect(live(log, theirs)).toEqual(theirs);
    expect(entryEdits(log, theirs.id)).toEqual([]);
  });

  test("a forged edit by a branch of an Owner entry is ignored", () => {
    const { db, sent, sale, lotId } = day1();
    const forged: Entry = {
      ...sale,
      id: "forged-edit",
      kind: "entryEdit",
      values: { targetId: sent.id, "to.kg": "500" },
    };
    const log = { ...db, entries: [...db.entries, forged] };
    expect(live(log, sent)).toEqual(sent);
    expect(centralStock(log, lotId)).toBe(centralStock(db, lotId));
  });

  test("a forged delete by a branch of another branch's entry is ignored", () => {
    const { db, theirs, sale } = day1();
    const forged: Entry = {
      ...sale,
      id: "forged-void",
      kind: "void",
      values: { targetId: theirs.id },
    };
    const log = { ...db, entries: [...db.entries, forged] };
    expect(isVoided(log, theirs.id)).toBe(false);
    expect(live(log, theirs)).toEqual(theirs);
  });

  test("a forged delete by a branch of an Owner entry is ignored", () => {
    const { db, sent, sale, lotId } = day1();
    const forged: Entry = {
      ...sale,
      id: "forged-void",
      kind: "void",
      values: { targetId: sent.id },
    };
    const log = { ...db, entries: [...db.entries, forged] };
    expect(isVoided(log, sent.id)).toBe(false);
    expect(centralStock(log, lotId)).toBe(centralStock(db, lotId));
  });

  test("a forged restore by a branch of the Owner's delete is ignored", () => {
    const { w, sale } = day1();
    const gone = del(w, sale);
    const forged: Entry = {
      ...sale,
      id: "forged-restore",
      kind: "void",
      values: { targetId: gone.id },
    };
    const log = { ...w.db, entries: [...w.db.entries, forged] };
    expect(isVoided(log, sale.id)).toBe(true);
    expect(live(log, sale)).toBeUndefined();
  });

  test("a forged undo by a branch of the Owner's edit is ignored", () => {
    const { w, sale } = day1();
    const fix = edit(w, sale, { soldKg: "60" });
    const forged: Entry = {
      ...sale,
      id: "forged-undo",
      kind: "void",
      values: { targetId: fix.id },
    };
    const log = { ...w.db, entries: [...w.db.entries, forged] };
    expect(only(log, "sale").values.soldKg).toBe("60");
  });

  test("a delete naming nothing in the log changes nothing", () => {
    const { db, sale } = day1();
    const forged: Entry = {
      ...sale,
      id: "forged-void",
      kind: "void",
      values: { targetId: "nothing" },
    };
    const log = { ...db, entries: [...db.entries, forged] };
    expect(figures(log)).toEqual(figures(db));
  });

  test("its edit, delete, restore and undo never write a lot", () => {
    const { w, db, sale } = day1();
    const receive = only(db, "receive");
    const fix = edit(w, receive, { kg: "69" }, {}, "branch");
    expect(w.db.lots).toEqual(db.lots);
    del(w, fix, "branch");
    expect(w.db.lots).toEqual(db.lots);
    const gone = del(w, sale, "branch");
    expect(w.db.lots).toEqual(db.lots);
    del(w, gone, "branch");
    expect(w.db.lots).toEqual(db.lots);
    edit(w, only(db, "thaw"), {}, { toDate: earlier }, "branch");
    expect(w.db.lots).toEqual(db.lots);
  });
});

describe("EDT-22 direct edits, closed day or not", () => {
  /** ศาลาแดง's `day` (65.5 kg sold of 70 thawed) with the day closed. */
  const closedDay = () => {
    const s = chillDay();
    const sold = only(s.db, "sale");
    s.run(
      "branch",
      "materials",
      Object.fromEntries(materials.map((_, i) => [`material${i}`, "10"])),
    );
    s.run("branch", "riceCarry", { leftoverKg: "0" });
    s.run("branch", "closeDay", { confirm: "ผู้ดูแล" });
    return { w: from(s.db), sold, lotId: sold.lotId };
  };
  const fix = { soldKg: "60", lineMan: "190000" };

  test("a branch corrects its closed-day sale; stock and revenue use it at once", () => {
    const { w, sold, lotId } = closedDay();
    // A new entry on the closed day is said (GEN-03); a correction of one is not.
    expectWarning(
      w.check("branch", "sale", { ...sale, soldKg: "1" }, lotId),
      "ปิดยอดแล้ว",
    );
    const { error, warnings } = w.check("branch", "entryEdit", {
      targetId: sold.id,
      values: JSON.stringify(fix),
      reason: "พิมพ์ยอดผิด",
    });
    expect(error).toBe("");
    expect(warnings.join()).not.toMatch("ปิดยอดแล้ว");

    const change = edit(w, sold, fix, {}, "branch");
    expect(balance(w.db, lotId, sala).ready).toBeCloseTo(10);
    expect(revenue(w.db)).toBe(190000);
    expect(entryEdits(w.db, sold.id).map((e) => e.id)).toEqual([change.id]);
    expect(isClosed(w.db, sala, day)).toBe(true);
  });

  test("the Owner's edit without a reason saves, marked as not filled in", () => {
    const { w, sold } = closedDay();
    const change = w.run("owner", "entryEdit", {
      targetId: sold.id,
      values: JSON.stringify(fix),
    });
    expect(change.values.missing).toBe("reason");
    expect(change.values).toMatchObject({
      "from.soldKg": "65.5",
      "to.soldKg": "60",
    });
  });

  test("an undone edit no longer applies and leaves the edit history", () => {
    const { w, sold, lotId } = closedDay();
    del(w, edit(w, sold, fix));
    expect(entryEdits(w.db, sold.id)).toEqual([]);
    expect(balance(w.db, lotId, sala).ready).toBeCloseTo(4.5);
    expect(revenue(w.db)).toBe(209600);
  });

  test("a correction that would leave stock short is said, not refused", () => {
    const { w, sold, lotId } = closedDay();
    // 50 kg thawed cannot cover the 65.5 kg already sold.
    expectWarning(
      w.check("branch", "entryEdit", {
        targetId: entries(w.db, "thaw", lotId)[0].id,
        values: JSON.stringify({ kg: "50" }),
        reason: "x",
      }),
      "ติดลบ",
    );
    // The sale's own rule: more than was thawed.
    expectWarning(
      w.check("owner", "entryEdit", {
        targetId: sold.id,
        values: JSON.stringify({ soldKg: "80" }),
        reason: "x",
      }),
      "เกินเนื้อที่ละลายแล้ว",
    );
  });

  test("a branch links an unlinked receive on a closed day", () => {
    const { w, lotId } = closedDay();
    expectWarning(w.check("branch", "receive", { kg: "1" }), "ปิดยอดแล้ว");
    const receive = w.run("branch", "receive", { kg: "1" });
    w.run("branch", "link", { targetId: receive.id, lotId });
    expect(balance(w.db, "", sala).received).toBe(0);
    expect(balance(w.db, lotId, sala).received).toBe(71);
  });

  test("an edit naming no entry is refused", () => {
    const { w } = closedDay();
    expect(() =>
      w.run("owner", "entryEdit", { targetId: "nothing", values: "{}" }),
    ).toThrow("ไม่พบรายการที่จะแก้ไข");
  });

  test("the daily material count is deleted and counted again, not edited", () => {
    const { w } = closedDay();
    const count = only(w.db, "materials");
    expect(() => edit(w, count, { material0: "9" }, {}, "branch")).toThrow(
      "รายการชนิดนี้แก้ไขย้อนหลังไม่ได้",
    );
    del(w, count, "branch");
    expect(entries(w.db, "materials")).toEqual([]);
  });
});

describe("EDT-22 edit requests are retired", () => {
  const sold = () => {
    const db = chillDay().db;
    return { db, w: from(db), sale: only(db, "sale") };
  };
  /** An approval as old logs hold it: the Owner's decision carrying the corrected values. */
  const decision = (target: Entry, verdict: string): Entry => ({
    ...target,
    id: `decision-${verdict}`,
    kind: "editDecision",
    role: "owner",
    values: {
      requestId: "request",
      targetId: target.id,
      decision: verdict,
      "to.soldKg": "60",
      "to.lineMan": "190000",
      "to.revenue": "190000",
    },
  });

  test("a branch records no new edit request", () => {
    const { w, sale } = sold();
    expect(() =>
      w.run("branch", "editRequest", {
        targetId: sale.id,
        values: JSON.stringify({ soldKg: "60" }),
        reason: "พิมพ์ผิด",
      }),
    ).toThrow("รายการชนิดนี้เลิกใช้แล้ว");
  });

  test("the Owner records no new decision", () => {
    const { w } = sold();
    expect(() =>
      w.run("owner", "editDecision", {
        requestId: "request",
        decision: editDecisions.approve,
      }),
    ).toThrow("รายการชนิดนี้เลิกใช้แล้ว");
  });

  test("an approval already in the log still lays its values over the entry", () => {
    const { db, sale } = sold();
    const log = {
      ...db,
      entries: [...db.entries, decision(sale, editDecisions.approve)],
    };
    expect(only(log, "sale").values.soldKg).toBe("60");
    expect(revenue(log)).toBe(190000);
    expect(balance(log, sale.lotId, sala).ready).toBeCloseTo(10);
    expect(entryEdits(log, sale.id)).toHaveLength(1);
  });

  test("a rejection already in the log changes nothing", () => {
    const { db, sale } = sold();
    const log = {
      ...db,
      entries: [...db.entries, decision(sale, editDecisions.reject)],
    };
    expect(only(log, "sale")).toEqual(sale);
    expect(entryEdits(log, sale.id)).toEqual([]);
  });

  test("an old approval is not deleted; the entry is edited again on top of it", () => {
    const { db, sale } = sold();
    const approval = decision(sale, editDecisions.approve);
    const w = from({ ...db, entries: [...db.entries, approval] });
    expect(() => del(w, approval)).toThrow("รายการชนิดนี้ลบไม่ได้");
    const fix = edit(w, sale, { soldKg: "62" }, {}, "branch");
    expect(fix.values["from.soldKg"]).toBe("60");
    expect(only(w.db, "sale").values.soldKg).toBe("62");
    del(w, fix, "branch");
    expect(only(w.db, "sale").values.soldKg).toBe("60");
  });
});

describe("EDT-23 a restore is checked like a new save", () => {
  test("a smoking invoice paid again in the meantime: the first payment is not restored", () => {
    const s = closed();
    const bill = invoice(s);
    s.run("owner", "invoiceReview", {
      decision: "รับยอด",
      reviewedBy: "Owner",
    });
    const w = from(s.db);
    const pay = () =>
      w.run(
        "owner",
        "invoicePayment",
        {
          paymentDate: day,
          paidBy: "Owner",
          paidAmount: bill.values.netPayable,
        },
        bill.lotId,
      );
    const gone = del(w, pay());
    const second = pay();
    expect(() => del(w, gone)).toThrow("ชำระ Invoice ใบนี้แล้ว");
    // With the second payment deleted the first one comes back.
    del(w, second);
    del(w, gone);
    expect(entries(w.db, "invoicePayment")).toHaveLength(1);
  });

  test("a meat invoice paid again in the meantime: the first payment is not restored", () => {
    const s = setup();
    purchase(s, "100");
    confirm(s, "100");
    const w = from(s.db);
    const pay = () =>
      w.run(
        "owner",
        "meatPayment",
        { paymentDate: day, paidBy: "Owner", paidAmount: "1" },
        s.db.lots[0].id,
      );
    const gone = del(w, pay());
    pay();
    expect(() => del(w, gone)).toThrow("ชำระ Invoice เนื้อใบนี้แล้ว");
  });

  test("a restore that leaves stock short is said, not refused", () => {
    const db = chillDay().db;
    const w = from(db);
    const gone = del(w, only(db, "sale"));
    // 60 of the 70 kg thawed is sold while the first sale is deleted: 65.5 kg more cannot fit.
    w.run("branch", "sale", { ...sale, soldKg: "60" }, only(db, "sale").lotId);
    const restore = w.check("owner", "void", {
      targetId: gone.id,
      reason: "กู้คืน",
    });
    // The sale's own rule, and the stock check every change gets.
    expectWarning(restore, "เกินเนื้อที่ละลายแล้ว");
    expectWarning(
      restore,
      /กู้คืนแล้วเนื้อละลายแล้ว .*จะติดลบ \(-55\.50\) · แก้รายการที่ตามมาก่อน/,
    );
  });

  test("an undo that leaves stock short is said, not refused", () => {
    const db = chillDay().db;
    const w = from(db);
    const more = edit(w, only(db, "thaw"), { kg: "100" });
    // 20 kg more is sold from the 100 kg; back at 70 kg thawed that is 15.5 kg short.
    w.run("branch", "sale", { ...sale, soldKg: "20" }, only(db, "sale").lotId);
    expectWarning(
      w.check("owner", "void", { targetId: more.id, reason: "ย้อนกลับ" }),
      /ย้อนกลับแล้วเนื้อละลายแล้ว .*จะติดลบ \(-15\.50\) · แก้รายการที่ตามมาก่อน/,
    );
  });
});

describe("EDT-25 what a branch sees of the change log", () => {
  const day1 = () => {
    const w = from(chillDay().db);
    const mine = only(w.db, "sale");
    const theirs = w.run(
      "branch",
      "receive",
      { kg: "1" },
      mine.lotId,
      day,
      min,
    );
    const cost = w.run("owner", "expense", {
      amount: "500",
      category: "อื่น ๆ",
      detail: "ค่าที่จอดรถ",
    });
    return { w, mine, theirs, cost };
  };
  const seenBy = (w: World, branch: string) =>
    visibleEntries(w.db, "branch", branch).map((e) => e.id);

  test("the Owner's delete of its entry, with whose entry it was", () => {
    const { w, mine } = day1();
    const gone = del(w, mine);
    const seen = visibleEntries(w.db, "branch", sala).find(
      (e) => e.id === gone.id,
    );
    expect(seen?.values).toMatchObject({
      targetId: mine.id,
      targetKind: "sale",
      targetRole: "branch",
      targetBranch: sala,
      reason: "บันทึกผิด",
    });
    expect(seenBy(w, min)).not.toContain(gone.id);
  });

  test("the Owner's edit of its entry, without the Owner's cost keys", () => {
    const { w, mine } = day1();
    const fix = edit(w, mine, { soldKg: "60" });
    const seen = visibleEntries(w.db, "branch", sala).find(
      (e) => e.id === fix.id,
    );
    expect(seen?.values["to.soldKg"]).toBe("60");
    expect(Object.keys(seen!.values).join()).not.toMatch(/meatCost|wasteCost/);
    expect(seenBy(w, min)).not.toContain(fix.id);
  });

  test("not the Owner's changes to its own entries, nor the undo of them", () => {
    const { w, cost } = day1();
    const fix = edit(w, cost, { amount: "600" });
    const undo = del(w, fix);
    const gone = del(w, cost);
    const restore = del(w, gone);
    for (const branch of branches)
      for (const change of [fix, undo, gone, restore])
        expect(seenBy(w, branch)).not.toContain(change.id);
  });

  test("not the Owner's or the other branch's changes to the other branch's entries", () => {
    const { w, theirs } = day1();
    const fix = edit(w, theirs, { kg: "2" });
    const own = edit(w, theirs, { kg: "3" }, {}, "branch", min);
    const gone = del(w, theirs);
    for (const change of [fix, own, gone])
      expect(seenBy(w, sala)).not.toContain(change.id);
    for (const change of [fix, own, gone])
      expect(seenBy(w, min)).toContain(change.id);
  });

  test("its own changes", () => {
    const { w, mine } = day1();
    const fix = edit(w, mine, { soldKg: "60" }, {}, "branch");
    const undo = del(w, fix, "branch");
    const gone = del(w, mine, "branch");
    const restore = del(w, gone, "branch");
    for (const change of [fix, undo, gone, restore])
      expect(seenBy(w, sala)).toContain(change.id);
  });

  // A void of a change names whose entry the change was about, so the branch reads it too.
  test("the Owner's restore of its entry", () => {
    const { w, mine } = day1();
    const restore = del(w, del(w, mine));
    expect(seenBy(w, sala)).toContain(restore.id);
    expect(seenBy(w, min)).not.toContain(restore.id);
  });

  test("the Owner's undo of an edit of its entry", () => {
    const { w, mine } = day1();
    const undo = del(w, edit(w, mine, { soldKg: "60" }));
    expect(seenBy(w, sala)).toContain(undo.id);
    expect(seenBy(w, min)).not.toContain(undo.id);
  });

  test("the Owner's restore of a delete the branch made itself", () => {
    const { w, mine } = day1();
    const restore = del(w, del(w, mine, "branch"));
    expect(seenBy(w, sala)).toContain(restore.id);
  });

  /** An old Owner allocation of 1 kg addressed to ศาลาแดง (sentToBranch in visibility.ts). */
  const allocated = () => {
    const s = chillDay();
    const sent = legacyAllocate(s, { branch: sala, kg: "1" });
    return { w: from(s.db), sent };
  };

  test("the Owner's delete of an old allocation it was sent, and the restore", () => {
    const { w, sent } = allocated();
    expect(seenBy(w, sala)).toContain(sent.id);
    const gone = del(w, sent);
    const restore = del(w, gone);
    for (const change of [gone, restore]) {
      expect(seenBy(w, sala)).toContain(change.id);
      expect(seenBy(w, min)).not.toContain(change.id);
    }
  });

  test("the Owner's edit of an old allocation it was sent, and the undo", () => {
    const { w, sent } = allocated();
    const fix = edit(w, sent, { kg: "2" });
    const undo = del(w, fix);
    for (const change of [fix, undo]) {
      expect(seenBy(w, sala)).toContain(change.id);
      expect(seenBy(w, min)).not.toContain(change.id);
    }
  });

  test("the Owner's edit of its chili and material receipts, and the undo", () => {
    const { w } = day1();
    for (const got of [
      w.run("branch", "chiliReceive", {
        chiliTubes: "20",
        receiver: "ผู้ดูแล",
      }),
      w.run("branch", "materialConfirm", {
        material,
        receivedQuantity: "6",
        receiver: "ผู้ดูแล",
      }),
    ]) {
      const fix = edit(w, got, { receiver: "ผู้จัดการ" });
      const undo = del(w, fix);
      for (const change of [got, fix, undo]) {
        expect(seenBy(w, sala)).toContain(change.id);
        expect(seenBy(w, min)).not.toContain(change.id);
      }
    }
  });

  test("a change to its entry is not shown to the branch with the Owner's prices", () => {
    const { w, mine } = day1();
    const fix = edit(w, mine, { soldKg: "60" });
    const undo = del(w, fix);
    for (const change of [fix, undo]) {
      const seen = visibleEntries(w.db, "branch", sala).find(
        (e) => e.id === change.id,
      )!;
      expect(Object.keys(seen.values).join()).not.toMatch(
        /meatCost|wasteCost|estimatedCost|serviceRate|price|outboundCost|returnCost/,
      );
    }
  });
});

describe("EDT-23 a delete that leaves stock short is said, not refused", () => {
  const short = (db: Database, target: Entry, match: RegExp) =>
    expectWarning(
      from(db).check("owner", "void", { targetId: target.id, reason: "x" }),
      match,
    );

  test("a thaw the branch already sold from", () => {
    const db = chillDay().db;
    short(db, only(db, "thaw"), /ลบแล้วเนื้อละลายแล้ว .*จะติดลบ/);
  });

  test("a receive the branch already thawed", () => {
    const db = chillDay().db;
    short(db, only(db, "receive"), /ลบแล้วเนื้อแช่แข็ง .*จะติดลบ/);
  });

  test("central stock a branch already received from", () => {
    const db = chillDay().db;
    short(db, only(db, "central"), /ลบแล้วสต๊อกกลาง .*จะติดลบ/);
  });

  test("Foodiva's invoice a smoke PO already drew past the order", () => {
    const s = setup();
    purchase(s, "50");
    confirm(s, "80");
    smokeOrder(s, [[s.db.lots[0].id, "70"]], "70", "");
    short(s.db, only(s.db, "foodivaConfirm"), /ลบแล้วยอดพร้อมส่ง .*จะติดลบ/);
  });

  test("STK-44 a chili purchase a branch already received from", () => {
    const db = whole;
    short(
      db,
      only(db, "generalPurchase"),
      /ลบแล้วน้ำพริกในคลัง Owner.*จะติดลบ/,
    );
  });

  test("STK-44 a material purchase a branch already received from", () => {
    const db = whole;
    short(
      db,
      only(db, "materialReceive"),
      new RegExp(`ลบแล้ว${material} ในคลัง Owner.*จะติดลบ`),
    );
  });

  test("a move that leaves stock short is said too", () => {
    const s = chillDay();
    const central = only(s.db, "central");
    dispatch(s, "");
    expectWarning(
      from(s.db).check("owner", "entryEdit", {
        targetId: central.id,
        values: "{}",
        reason: "x",
        toLotId: s.db.lots.at(-1)!.id,
      }),
      /แก้แล้วสต๊อกกลาง .*จะติดลบ/,
    );
  });

  test("the delete still saves", () => {
    const db = chillDay().db;
    const w = from(db);
    del(w, only(db, "thaw"));
    expect(balance(w.db, only(db, "thaw").lotId, sala).ready).toBeCloseTo(
      -65.5,
    );
  });

  test("a delete that leaves nothing short says nothing", () => {
    const db = chillDay().db;
    const { error, warnings } = from(db).check("owner", "void", {
      targetId: only(db, "sale").id,
      reason: "x",
    });
    expect(error).toBe("");
    expect(warnings).toEqual([]);
  });
});

describe("DM-09 the rebuilt lot cache equals the one the saves built", () => {
  const end = today();

  test.each([
    ["smoked", () => smoked().db],
    ["closed", () => closed().db],
    ["returned", () => returned().db],
    ["ready", () => ready().db],
    ["chillDay", () => chillDay().db],
    ["the full flow", () => whole],
  ])("fixtures: %s", (_, build) => {
    expect(rebuilt(build())).toEqual([]);
  });

  // chefEdit writes no cache of its own: the batch is rebuilt from the rounds it corrects, so
  // the smoke date the thaw's FIFO order reads follows the correction.
  test("after a Chef House correction of the last round's smoke date", () => {
    const s = smoked();
    const [round1, round2] = entries(s.db, "smoke");
    s.run(
      "owner",
      "chefEdit",
      {
        arrival: "08:00",
        preSmokeKg: "48",
        batches: JSON.stringify([
          draft(round1),
          draft(round2, { smokeDate: earlier }),
        ]),
      },
      round1.lotId,
    );
    expect(rebuilt(s.db)).toEqual([]);
  });

  test("the Owner and branch scenario", () => {
    expect(rebuilt(ownerBranchScenario(end), end)).toEqual([]);
  }, 300_000);

  test("the seven-day roleplay", () => {
    expect(rebuilt(sevenDayRoleplay(end), end)).toEqual([]);
  }, 300_000);

  test("the thirty-day roleplay", () => {
    expect(rebuilt(thirtyDayRoleplay(end), end)).toEqual([]);
  }, 300_000);
});

describe("EDT-23 document numbers", () => {
  // Deleted documents count: a number is never given to a second one.
  test.each([
    ["smokeOrder", "orderNumber", (s: Setup) => smokeOrder(s, [], "10", "")],
    ["dispatch", "transferNumber", (s: Setup) => dispatch(s, "")],
    [
      "return",
      "transferNumber",
      (s: Setup) => s.run("owner", "return", returnTruck, ""),
    ],
    [
      "smoke",
      "subLot",
      (s: Setup) =>
        s.run(
          "owner",
          "smoke",
          { smokeDate: day, inputKg: "1", wasteKg: "0", packs: "1" },
          "",
        ),
    ],
  ] as const)(
    "a new %s after a delete does not repeat the number of a live one",
    (kind, key, add) => {
      const s = setup();
      add(s);
      add(s);
      s.run(
        "owner",
        "void",
        { targetId: entries(s.db, kind)[0].id, reason: "บันทึกผิด" },
        "",
      );
      add(s);
      const numbers = entries(s.db, kind).map((e) => e.values[key]);
      expect(numbers).toHaveLength(2);
      expect(new Set(numbers).size).toBe(2);
    },
  );

  test.each([
    ["smokeOrder", "orderNumber", (s: Setup) => smokeOrder(s, [], "10", "")],
    ["dispatch", "transferNumber", (s: Setup) => dispatch(s, "")],
  ] as const)(
    "a restored %s keeps its number, and the one issued meanwhile has another",
    (kind, key, add) => {
      const s = setup();
      add(s);
      const first = entries(s.db, kind)[0];
      s.run("owner", "void", { targetId: first.id, reason: "บันทึกผิด" }, "");
      const gone = s.db.entries.at(-1)!;
      add(s);
      s.run("owner", "void", { targetId: gone.id, reason: "กู้คืน" }, "");
      const numbers = entries(s.db, kind).map((e) => e.values[key]);
      expect(numbers[0]).toBe(first.values[key]);
      expect(new Set(numbers).size).toBe(2);
    },
  );

  test("a material count after a deleted round takes the next round number", () => {
    const w = from(setup().db);
    const count = Object.fromEntries(
      materials.map((_, i) => [`material${i}`, "10"]),
    );
    const again = { ...count, correctionReason: "นับใหม่" };
    const first = w.run("branch", "materials", count);
    const second = w.run("branch", "materials", again);
    del(w, second, "branch");
    const third = w.run("branch", "materials", again);
    expect([first, second, third].map((e) => e.values.revision)).toEqual([
      undefined,
      "2",
      "3",
    ]);
    // The other branch's rounds, and another day's, are counted apart.
    const theirs = w.run("branch", "materials", count, "", day, min);
    const before = w.run("branch", "materials", count, "", earlier);
    expect(theirs.values.revision).toBeUndefined();
    expect(before.values.revision).toBeUndefined();
  });

  test("a delete records the day its entry is filed under", () => {
    const db = chillDay().db;
    const w = from(db);
    edit(w, only(db, "sale"), {}, { toDate: earlier });
    expect(del(w, only(db, "sale")).values.targetDate).toBe(earlier);
  });
});

describe("EDT-23 the undo of an edit is checked like a new save", () => {
  /** Batch A closed, its smoking invoice accepted and paid; batch B just trucked. */
  const paid = () => {
    const s = closed();
    const a = batchOf(s.db).id;
    const bill = invoice(s);
    s.run("owner", "invoiceReview", {
      decision: "รับยอด",
      reviewedBy: "Owner",
    });
    const pay = {
      paymentDate: day,
      paidBy: "Owner",
      paidAmount: bill.values.netPayable,
    };
    s.run("owner", "invoicePayment", pay);
    dispatch(s, "");
    const b = s.db.lots.at(-1)!.id;
    return {
      w: from(s.db),
      a,
      b,
      bill,
      pay,
      payment: only(s.db, "invoicePayment"),
    };
  };

  test("the undo of a move does not leave a smoking invoice paid twice", () => {
    const { w, a, b, bill, pay, payment } = paid();
    const move = edit(w, payment, {}, { toLotId: b });
    const second = w.run("owner", "invoicePayment", pay, a);
    expect(() => del(w, move)).toThrow("ชำระ Invoice ใบนี้แล้ว");
    expect(
      entries(w.db, "invoicePayment", a).filter(
        (p) => p.values.invoiceId === bill.id,
      ),
    ).toHaveLength(1);
    // With the second payment deleted the move is undone.
    del(w, second);
    del(w, move);
    expect(live(w.db, payment)).toEqual(payment);
  });

  test("the undo of a move does not leave a meat invoice paid twice", () => {
    const s = setup();
    purchase(s, "100");
    purchase(s, "50");
    const [one, other] = s.db.lots.map((lot) => lot.id);
    const w = from(s.db);
    const pay = { paymentDate: day, paidBy: "Owner", paidAmount: "1" };
    const move = edit(
      w,
      w.run("owner", "meatPayment", pay, one),
      {},
      {
        toLotId: other,
      },
    );
    w.run("owner", "meatPayment", pay, one);
    expect(() => del(w, move)).toThrow("ชำระ Invoice เนื้อใบนี้แล้ว");
  });

  // The overlay merges, so a value the rules no longer write is stored as "": the payment on
  // B names no invoice, which pays whatever invoice B gets (SVC-01).
  test("a payment moved to a batch with no invoice pays the invoice that batch gets later", () => {
    const { w, a, b, bill, payment } = paid();
    const move = edit(w, payment, {}, { toLotId: b });
    expect(live(w.db, payment)!.values.invoiceId).toBe("");
    expect(smokingInvoiceStatus(w.db, live(w.db, bill)!)).toBe("รอชำระ");
    const later = w.run(
      "owner",
      "smokingInvoice",
      {
        invoiceNumber: "CH-2",
        invoiceDate: day,
        attachment: "ch2.pdf",
        serviceQuantity: "10",
      },
      b,
    );
    expect(smokingInvoiceStatus(w.db, later)).toBe("ชำระแล้ว");
    // Undone, it names A's invoice again and B's is open.
    del(w, move);
    expect(live(w.db, payment)).toEqual(payment);
    expect(entries(w.db, "invoicePayment", a)).toHaveLength(1);
    expect(smokingInvoiceStatus(w.db, later)).toBe("รอตรวจยอด");
  });
});

describe("EDT-23 an entry another one names by id", () => {
  /** fixtures' closed batch, its smoke PO accepted, its smoking invoice accepted and paid,
   *  and a second batch to move things to. */
  const billed = () => {
    const s = closed();
    const lot = batchOf(s.db).id;
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
    dispatch(s, "");
    return {
      db: s.db,
      w: from(s.db),
      lot,
      other: s.db.lots.at(-1)!.id,
      bill,
      order: only(s.db, "smokeOrder"),
      accept: only(s.db, "smokeOrderAccept"),
      review: only(s.db, "invoiceReview"),
      payment: only(s.db, "invoicePayment"),
    };
  };
  /** Live entries whose `orderId` / `invoiceId` names an entry that is deleted. */
  const dangling = (db: Database) =>
    (
      [
        ["smokeOrderAccept", "orderId"],
        ["invoiceReview", "invoiceId"],
        ["invoicePayment", "invoiceId"],
      ] as const
    ).flatMap(([kind, key]) =>
      entries(db, kind)
        .filter((e) => e.values[key] && isVoided(db, e.values[key]))
        .map((e) => e.kind),
    );
  const order2 = { requestedSmokeDate: day, smoker: "Chef House", rawKg: "5" };
  const bill2 = {
    invoiceNumber: "CH-2",
    invoiceDate: day,
    attachment: "b.pdf",
  };

  test("a smoke PO is not deleted while its acceptance stands", () => {
    const { w, order } = billed();
    expect(() => del(w, order)).toThrow(
      "ยืนยันรับ PO รมควัน อ้างถึงรายการนี้อยู่ · ลบรายการนั้นก่อน",
    );
  });

  test("a smoke PO is not moved to another batch while its acceptance stands", () => {
    const { w, order, other } = billed();
    expect(() => edit(w, order, {}, { toLotId: other })).toThrow(
      "ยืนยันรับ PO รมควัน อ้างถึงรายการนี้อยู่ · ย้ายหรือลบรายการนั้นก่อน",
    );
  });

  test("a document that is named is still edited and moved to another day", () => {
    const { w, order, bill } = billed();
    edit(w, order, { smoker: "โรงรมใหม่" }, { toDate: earlier });
    edit(w, bill, { invoiceNumber: "CH-9" }, { toDate: earlier });
    expect(live(w.db, order)).toMatchObject({ date: earlier });
    expect(live(w.db, order)!.values.smoker).toBe("โรงรมใหม่");
    expect(live(w.db, bill)!.values.invoiceNumber).toBe("CH-9");
  });

  test("with its acceptance deleted first, a smoke PO is deleted and restored as it was", () => {
    const { db, w, order, accept } = billed();
    const noAccept = del(w, accept);
    const before = w.db;
    const gone = del(w, order);
    expect(live(w.db, order)).toBeUndefined();
    del(w, gone);
    expect(cacheDiff(before, w.db)).toEqual([]);
    expect(figures(w.db)).toEqual(figures(before));
    del(w, noAccept);
    expect(live(w.db, accept)).toEqual(accept);
    expect(figures(w.db)).toEqual(figures(db));
  });

  test("with its acceptance deleted first, a smoke PO moves to another batch, and back", () => {
    const { w, order, accept, other } = billed();
    del(w, accept);
    const before = w.db;
    const move = edit(w, order, {}, { toLotId: other });
    expect(live(w.db, order)).toMatchObject({ lotId: other });
    del(w, move);
    expect(cacheDiff(before, w.db)).toEqual([]);
  });

  test("an acceptance is not restored while the smoke PO it names is deleted", () => {
    const { w, order, accept } = billed();
    const noAccept = del(w, accept);
    const noOrder = del(w, order);
    expect(() => del(w, noAccept)).toThrow(
      "ออก PO รมควันเนื้อ ที่รายการนี้อ้างถึงถูกลบแล้ว · กู้คืนรายการนั้นก่อน",
    );
    // Newest first, both come back.
    del(w, noOrder);
    del(w, noAccept);
    expect(dangling(w.db)).toEqual([]);
  });

  test("a smoking invoice is not deleted while its review stands", () => {
    const { w, bill } = billed();
    expect(() => del(w, bill)).toThrow(
      "ตรวจยอด Invoice ค่ารมควัน อ้างถึงรายการนี้อยู่ · ลบรายการนั้นก่อน",
    );
  });

  test("a smoking invoice is not deleted while its payment stands", () => {
    const { w, bill, review } = billed();
    del(w, review);
    expect(() => del(w, bill)).toThrow(
      "ชำระ Invoice ค่ารมควัน อ้างถึงรายการนี้อยู่ · ลบรายการนั้นก่อน",
    );
  });

  test("a smoking invoice is not moved to another batch while its review or payment stands", () => {
    const { w, bill, review, other } = billed();
    expect(() => edit(w, bill, {}, { toLotId: other })).toThrow(
      "ตรวจยอด Invoice ค่ารมควัน อ้างถึงรายการนี้อยู่ · ย้ายหรือลบรายการนั้นก่อน",
    );
    del(w, review);
    expect(() => edit(w, bill, {}, { toLotId: other })).toThrow(
      "ชำระ Invoice ค่ารมควัน อ้างถึงรายการนี้อยู่ · ย้ายหรือลบรายการนั้นก่อน",
    );
  });

  test("with its payment and review deleted, newest first, an invoice is deleted and restored, then they are", () => {
    const { db, w, lot, bill, review, payment } = billed();
    const noPayment = del(w, payment);
    const noReview = del(w, review);
    const before = w.db;
    const gone = del(w, bill);
    // No invoice: the batch is costed on the smoke PO's estimate again.
    expect(lotCost(w.db, lotOf(w.db, lot)).smokingCostSource).toBe("estimate");
    del(w, gone);
    expect(figures(w.db)).toEqual(figures(before));
    del(w, noReview);
    del(w, noPayment);
    expect(smokingInvoiceStatus(w.db, live(w.db, bill)!)).toBe("ชำระแล้ว");
    expect(figures(w.db)).toEqual(figures(db));
    expect(cacheDiff(db, w.db)).toEqual([]);
  });

  test("with its payment and review deleted, an invoice moves to another batch, and back", () => {
    const { w, bill, review, payment, other } = billed();
    del(w, payment);
    del(w, review);
    const before = w.db;
    const move = edit(w, bill, {}, { toLotId: other });
    expect(live(w.db, bill)).toMatchObject({ lotId: other });
    del(w, move);
    expect(figures(w.db)).toEqual(figures(before));
  });

  test("a payment moved off the batch no longer holds the invoice; the review still does", () => {
    const { w, bill, review, payment, other } = billed();
    edit(w, payment, {}, { toLotId: other });
    expect(() => del(w, bill)).toThrow(
      "ตรวจยอด Invoice ค่ารมควัน อ้างถึงรายการนี้อยู่",
    );
    del(w, review);
    del(w, bill);
    expect(dangling(w.db)).toEqual([]);
  });

  test("a review is not restored while the invoice it names is deleted", () => {
    const { w, bill, review, payment } = billed();
    del(w, payment);
    const noReview = del(w, review);
    del(w, bill);
    expect(() => del(w, noReview)).toThrow(
      "สร้าง / Submit ใบวางบิลค่ารมควัน ที่รายการนี้อ้างถึงถูกลบแล้ว · กู้คืนรายการนั้นก่อน",
    );
  });

  // What an entry names must still be there when it comes back: record() alone would settle
  // for another document on the batch, or for none.
  const invoiceGone =
    "สร้าง / Submit ใบวางบิลค่ารมควัน ที่รายการนี้อ้างถึงถูกลบแล้ว · กู้คืนรายการนั้นก่อน";
  const orderGone =
    "ออก PO รมควันเนื้อ ที่รายการนี้อ้างถึงถูกลบแล้ว · กู้คืนรายการนั้นก่อน";

  test("a payment is not restored while the invoice it names is deleted", () => {
    const { w, bill, review, payment } = billed();
    const noPayment = del(w, payment);
    const noReview = del(w, review);
    const noBill = del(w, bill);
    expect(() => del(w, noPayment)).toThrow(invoiceGone);
    expect(dangling(w.db)).toEqual([]);
    // Oldest back first, the three are as they were.
    for (const change of [noBill, noReview, noPayment]) del(w, change);
    expect(smokingInvoiceStatus(w.db, live(w.db, bill)!)).toBe("ชำระแล้ว");
  });

  test("a payment is not restored onto another invoice of the batch still naming the deleted one", () => {
    const { w, lot, bill, review, payment } = billed();
    const noPayment = del(w, payment);
    del(w, review);
    del(w, bill);
    w.run("owner", "smokingInvoice", bill2, lot);
    expect(() => del(w, noPayment)).toThrow(invoiceGone);
    expect(dangling(w.db)).toEqual([]);
  });

  test("a review is not restored still naming a deleted invoice when the batch has another", () => {
    const { w, lot, bill, review, payment } = billed();
    del(w, payment);
    const noReview = del(w, review);
    del(w, bill);
    w.run("owner", "smokingInvoice", bill2, lot);
    expect(() => del(w, noReview)).toThrow(invoiceGone);
    expect(dangling(w.db)).toEqual([]);
  });

  test("an acceptance is not restored still naming a deleted smoke PO when the batch has another", () => {
    const { w, lot, order, accept } = billed();
    w.run("owner", "smokeOrder", order2, lot);
    const noAccept = del(w, accept);
    del(w, order);
    expect(() => del(w, noAccept)).toThrow(orderGone);
    expect(dangling(w.db)).toEqual([]);
  });

  // An edit of an acceptance names the batch's newest smoke PO, which frees the first one to
  // be deleted; the undo would name the deleted one again.
  test("the undo of an edit does not leave an acceptance naming a deleted smoke PO", () => {
    const { w, lot, order, accept } = billed();
    const second = w.run("owner", "smokeOrder", order2, lot);
    const fix = edit(w, accept, { acceptedBy: "หัวหน้าโรงรม" });
    expect(live(w.db, accept)!.values.orderId).toBe(second.id);
    const noOrder = del(w, order);
    expect(() => del(w, fix)).toThrow(orderGone);
    expect(dangling(w.db)).toEqual([]);
    del(w, noOrder);
    del(w, fix);
    expect(live(w.db, accept)).toEqual(accept);
  });

  test("a payment naming an invoice that is not in the log is not restored", () => {
    const s = closed();
    const stray: Entry = {
      ...only(s.db, "closeLot"),
      id: "stray-payment",
      kind: "invoicePayment",
      role: "owner",
      values: {
        invoiceId: "not-in-the-log",
        paymentDate: day,
        paidBy: "Owner",
        paidAmount: "1",
      },
    };
    const w = from({ ...s.db, entries: [...s.db.entries, stray] });
    const gone = del(w, stray);
    expect(() => del(w, gone)).toThrow("ที่รายการนี้อ้างถึงถูกลบแล้ว");
  });
});

describe("EDT-23 what a Chef House correction names", () => {
  /** fixtures' smoked batch with a correction of round 1, and a second batch to move to. */
  const corrected = () => {
    const s = smoked();
    const [round1, round2] = entries(s.db, "smoke");
    dispatch(s, "");
    const w = from(s.db);
    const fix = w.run(
      "owner",
      "chefEdit",
      {
        arrival: "08:00",
        preSmokeKg: "48",
        batches: JSON.stringify([
          draft(round1, { wasteKg: "4", packs: packs(160) }),
          draft(round2),
        ]),
      },
      round1.lotId,
    );
    return {
      w,
      fix,
      round1,
      round2,
      lot: round1.lotId,
      other: s.db.lots.at(-1)!.id,
    };
  };
  const named = "Edit ข้อมูลก่อนปิด Lot อ้างถึงรายการนี้อยู่";

  test.each(["cmReceive", "prepare", "smoke"] as const)(
    "the %s it corrects is not deleted while the correction stands",
    (kind) => {
      const { w } = corrected();
      expect(() => del(w, only(w.db, kind))).toThrow(
        `${named} · ลบรายการนั้นก่อน`,
      );
    },
  );

  test.each(["cmReceive", "prepare", "smoke"] as const)(
    "the %s it corrects is not moved to another batch while the correction stands",
    (kind) => {
      const { w, other } = corrected();
      expect(() => edit(w, only(w.db, kind), {}, { toLotId: other })).toThrow(
        `${named} · ย้ายหรือลบรายการนั้นก่อน`,
      );
    },
  );

  test("a round it corrects is still edited and moved to another day", () => {
    const { w, round2, lot } = corrected();
    edit(w, round2, { wasteKg: "6", packs: packs(220) }, { toDate: earlier });
    expect(live(w.db, round2)).toMatchObject({ date: earlier });
    expect(produced(w.db, lot)).toBeCloseTo(16 + 22);
  });

  test("with the correction deleted, its round is deleted and moved", () => {
    const { w, fix, round1, round2, lot, other } = corrected();
    del(w, fix);
    del(w, round1);
    edit(w, round2, {}, { toLotId: other });
    expect(produced(w.db, lot)).toBe(0);
    expect(produced(w.db, other)).toBeCloseTo(21);
  });

  test("a deleted correction is not restored while a round it names is deleted", () => {
    const { w, fix, round1, lot } = corrected();
    const noFix = del(w, fix);
    const noRound = del(w, round1);
    expect(() => del(w, noFix)).toThrow(
      "บันทึก Lot สโมครายวัน ที่รายการนี้อ้างถึงถูกลบแล้ว · กู้คืนรายการนั้นก่อน",
    );
    del(w, noRound);
    del(w, noFix);
    expect(produced(w.db, lot)).toBeCloseTo(37);
  });

  test("a deleted correction is not restored while the weigh-in it names is deleted", () => {
    const { w, fix } = corrected();
    const noFix = del(w, fix);
    del(w, only(w.db, "cmReceive"));
    expect(() => del(w, noFix)).toThrow(
      "ยืนยันรับเนื้อที่ Chef House ที่รายการนี้อ้างถึงถูกลบแล้ว · กู้คืนรายการนั้นก่อน",
    );
  });

  test("a correction deleted after another round was smoked is restored", () => {
    const { w, fix, lot } = corrected();
    w.run(
      "owner",
      "smoke",
      { smokeDate: day, inputKg: "1", wasteKg: "0", packs: "1" },
      lot,
    );
    const before = produced(w.db, lot);
    const noFix = del(w, fix);
    expect(produced(w.db, lot)).toBeCloseTo(before - 1);
    del(w, noFix);
    expect(produced(w.db, lot)).toBeCloseTo(before);
  });
});

describe("EDT-22 an edit stores only what it changes", () => {
  /** ศาลาแดง's receipt of 6 boxes. */
  const receipt = (w: World) =>
    w.run("branch", "materialConfirm", {
      material,
      receivedQuantity: "6",
      receiver: "ผู้ดูแล",
    });

  test("one field edited: the edit holds that field, and the whole entry as it was", () => {
    const w = from(whole);
    const cost = only(whole, "expense");
    const fix = edit(w, cost, { ...cost.values, amount: "600" });
    expect(unpack("to.", fix.values)).toEqual({ amount: "600" });
    expect(unpack("from.", fix.values)).toEqual(cost.values);
  });

  test("an edit that changes nothing holds no value", () => {
    const w = from(whole);
    const fix = edit(w, only(whole, "cmReceive"), {
      ...only(whole, "cmReceive").values,
    });
    expect(unpack("to.", fix.values)).toEqual({});
    expect(live(w.db, only(whole, "cmReceive"))).toEqual(
      only(whole, "cmReceive"),
    );
  });

  test("what the rules work out from the edited field is held too", () => {
    const w = from(whole);
    const round = only(whole, "smoke");
    const fix = edit(w, round, { packs: "8\n8" });
    expect(Object.keys(unpack("to.", fix.values)).sort()).toEqual([
      "packCount",
      "packs",
      "postSmokeKg",
    ]);
  });

  // The server works a sale's menu total out from the edit's own counts (restore_sale_money).
  test("a sale's edit still holds every value", () => {
    const w = from(whole);
    const sold = only(whole, "sale");
    const fix = edit(w, sold, { soldKg: "1.02" });
    expect(Object.keys(unpack("to.", fix.values)).sort()).toEqual(
      [...new Set([...Object.keys(sold.values), "missing"])].sort(),
    );
  });

  test("two edits of different fields unwind newest first, each taking its own field back", () => {
    const w = from(setup().db);
    const got = receipt(w);
    const first = edit(w, got, { receiver: "ผู้จัดการ" }, {}, "branch");
    const second = edit(w, got, { receivedQuantity: "5" }, {}, "branch");
    expect(Object.keys(unpack("to.", second.values))).toEqual([
      "receivedQuantity",
    ]);
    expect(() => del(w, first, "branch")).toThrow(
      "ย้อนกลับการแก้ไขล่าสุดของรายการนี้ก่อน",
    );
    del(w, second, "branch");
    expect(live(w.db, got)!.values).toMatchObject({
      receiver: "ผู้จัดการ",
      receivedQuantity: "6",
    });
    del(w, first, "branch");
    expect(live(w.db, got)).toEqual(got);
  });

  test("a Chef House correction deleted after a later edit of its round is gone", () => {
    const s = smoked();
    const [round1, round2] = entries(s.db, "smoke");
    const w = from(s.db);
    const fix = w.run(
      "owner",
      "chefEdit",
      {
        arrival: "08:00",
        preSmokeKg: "48",
        batches: JSON.stringify([
          draft(round1),
          draft(round2, { wasteKg: "6", packs: packs(220) }),
        ]),
      },
      round1.lotId,
    );
    expect(produced(w.db, round1.lotId)).toBeCloseTo(37);
    edit(w, round2, { smokeDate: earlier });
    del(w, fix);
    expect(produced(w.db, round1.lotId)).toBeCloseTo(36);
    // The edit's own field stays.
    expect(live(w.db, round2)!.values.smokeDate).toBe(earlier);
    expect(rebuilt(w.db)).toEqual([]);
  });

  test("a Chef House correction made after an edit of a round shows over it, and is undone alone", () => {
    const s = smoked();
    const [round1, round2] = entries(s.db, "smoke");
    const w = from(s.db);
    edit(w, round2, { wasteKg: "6", packs: packs(220) });
    const fix = w.run(
      "owner",
      "chefEdit",
      {
        arrival: "08:00",
        preSmokeKg: "48",
        batches: JSON.stringify([
          draft(round1),
          draft(round2, { wasteKg: "8", packs: packs(200) }),
        ]),
      },
      round1.lotId,
    );
    expect(produced(w.db, round1.lotId)).toBeCloseTo(35);
    del(w, fix);
    expect(produced(w.db, round1.lotId)).toBeCloseTo(37);
  });
});

describe("EDT-23 a deleted batch", () => {
  // The guard is for a lot's own steps: a kind with no lot that was saved with the batch's
  // id (fixtures' `run` does that) is not held up by it.
  test.each([
    [
      "owner",
      "expense",
      { amount: "5", category: "อื่น ๆ", detail: "ค่าจอดรถ" },
    ],
    ["branch", "closeDay", { confirm: "ผู้ดูแล" }],
  ] as const)(
    "%s: a %s saved with its id is still edited and restored",
    (role, kind, values) => {
      const s = setup();
      dispatch(s, "");
      const w = from(s.db);
      const entry = w.run(role, kind, values, batchOf(s.db).id);
      del(w, only(s.db, "dispatch"));
      edit(w, entry, {}, { toDate: earlier }, role);
      del(w, del(w, entry, role), role);
      expect(live(w.db, entry)).toMatchObject({ date: earlier });
    },
  );

  /** chillDay (70 kg received and thawed, 65.5 kg sold by ศาลาแดง) with every step of its
   *  batch deleted, newest first. */
  const hidden = () => {
    const db = chillDay().db;
    const lot = only(db, "sale").lotId;
    const w = from(db);
    for (const step of db.entries
      .filter((e) => e.lotId === lot && batchKinds.includes(e.kind))
      .reverse())
      del(w, step);
    expect(shipments(w.db)).toEqual([]);
    return { db, w, lot };
  };
  const batchGone = "ชุดนี้ถูกลบแล้ว · กู้คืนรายการของชุดก่อน";

  test.each([sala, min])("สาขา%s records no new receive on it", (branch) => {
    const { w, lot } = hidden();
    expect(() =>
      w.run("branch", "receive", { kg: "1" }, lot, day, branch),
    ).toThrow(batchGone);
  });

  test("a branch still thaws, sells and gives away what it holds of it", () => {
    const { w, lot } = hidden();
    w.run("branch", "receive", { kg: "5" });
    // 4.5 kg thawed is left of the 70; nothing frozen, so the thaw is only said.
    w.run("branch", "thaw", { kg: "0" }, lot);
    w.run("branch", "sale", { ...sale, soldKg: "1" }, lot);
    w.run(
      "branch",
      "influencerBox",
      { influencer: "คุณเอ", boxes: "1", chiliAddons: "0", shippingFee: "0" },
      lot,
    );
    expect(balance(w.db, lot, sala).ready).toBeCloseTo(4.5 - 1 - 0.1015);
  });

  test("its old receive is still edited, deleted and restored", () => {
    const { db, w, lot } = hidden();
    const receive = only(db, "receive");
    const fix = edit(w, receive, { kg: "69" }, {}, "branch");
    expect(balance(w.db, lot, sala).received).toBe(69);
    del(w, fix, "branch");
    del(w, del(w, receive, "branch"), "branch");
    expect(live(w.db, receive)).toEqual(receive);
  });

  test("a receive with no batch is not linked to it", () => {
    const { w, lot } = hidden();
    const receive = w.run("branch", "receive", { kg: "1" });
    expect(() =>
      w.run("branch", "link", { targetId: receive.id, lotId: lot }),
    ).toThrow("ไม่พบชุดรมควันที่เลือก");
  });

  test("restoring one of its steps opens it for a receive again", () => {
    const { db, w, lot } = hidden();
    const gone = w.db.entries.find(
      (e) => e.kind === "void" && e.values.targetId === only(db, "central").id,
    )!;
    del(w, gone);
    expect(shipments(w.db).map((l) => l.id)).toEqual([lot]);
    w.run("branch", "receive", { kg: "1" }, lot);
    expect(balance(w.db, lot, sala).received).toBe(71);
  });
});

describe("EDT-22 what an edit may not change", () => {
  test("the branch an Owner entry is addressed to", () => {
    // Only old allocations are addressed to a branch any more.
    const s = ready();
    const allocation = legacyAllocate(s, { branch: sala, kg: "10" });
    const w = from(s.db);
    expect(() => edit(w, allocation, { branch: min })).toThrow(
      "แก้สาขาปลายทางไม่ได้ · ลบรายการแล้วบันทึกใหม่",
    );
    // Sent along unchanged, as a form does, it is no change.
    edit(w, allocation, { branch: sala, kg: "5" });
    expect(centralStock(w.db, allocation.lotId)).toBe(30);
  });

  test("a receive is not linked to a deleted batch", () => {
    const s = ready();
    dispatch(s, "");
    const hidden = s.db.lots.at(-1)!.id;
    const w = from(s.db);
    del(w, entries(s.db, "dispatch", hidden)[0]);
    const receive = w.run("branch", "receive", { kg: "1" });
    expect(() =>
      w.run("branch", "link", { targetId: receive.id, lotId: hidden }),
    ).toThrow("ไม่พบชุดรมควันที่เลือก");
  });

  test("an old allocation is deleted and restored though the kind is retired", () => {
    const s = ready();
    const allocation = legacyAllocate(s, { branch: sala, kg: "10" });
    const w = from(s.db);
    const gone = del(w, allocation);
    expect(centralStock(w.db, allocation.lotId)).toBe(35);
    del(w, gone);
    expect(centralStock(w.db, allocation.lotId)).toBe(25);
  });
});

describe("EDT-23/21 the whole flow, change by change", () => {
  /** The flow plus a second PO and a second batch to move entries to. */
  const wide = () => {
    const w = from(whole);
    w.run("owner", "purchase", {
      ...only(whole, "purchase").values,
      orderedKg: "70",
    });
    const po = w.db.lots.at(-1)!.id;
    w.run("owner", "dispatch", { ...only(whole, "dispatch").values });
    return { db: w.db, po, batch: w.db.lots.at(-1)!.id };
  };
  const { db: base, po, batch } = wide();
  test.each(
    whole.entries
      .map((e, index) => [label(e, index), e] as const)
      .filter(([, e]) => editableKinds.includes(e.kind)),
  )("%s moves to another day, and back", (_, target) => {
    const w = from(whole);
    const move = edit(w, target, {}, { toDate: earlier });
    expect(live(w.db, target)).toMatchObject({ date: earlier });
    // Nothing but the day changed: for a kind filed under a field of its own, that field.
    const field = dateField[target.kind];
    expect({ ...live(w.db, target)!.values, missing: "" }).toEqual({
      ...target.values,
      ...(field && { [field]: earlier }),
      missing: "",
    });
    // And the edit holds nothing else (a sale's carries every value, for the server's
    // restore of its money; a day-close lists what the new day is missing).
    if (target.kind !== "sale")
      expect(
        Object.keys(unpack("to.", move.values)).filter(
          (key) => key !== "missing",
        ),
      ).toEqual(field ? [field] : []);
    expect(cacheDiff(whole, w.db)).toEqual([]);
    del(w, move);
    expect(live(w.db, target)).toEqual(live(whole, target));
    expect(cacheDiff(whole, w.db)).toEqual([]);
    expect(figures(w.db)).toEqual(figures(whole));
  });

  /** Not moved alone: a step that answers a document needs it on the other lot too, and a
   *  document another entry names by id waits for that entry. */
  const needs: Partial<Record<EntryKind, string>> = {
    smokeOrderAccept: "ยังไม่มี PO รมควันจาก Owner",
    invoiceReview: "ไม่พบ Invoice ค่ารมควันที่ต้องตรวจ",
    smokeOrder:
      "ยืนยันรับ PO รมควัน อ้างถึงรายการนี้อยู่ · ย้ายหรือลบรายการนั้นก่อน",
    smokingInvoice:
      "ตรวจยอด Invoice ค่ารมควัน อ้างถึงรายการนี้อยู่ · ย้ายหรือลบรายการนั้นก่อน",
  };

  test.each(
    whole.entries
      .map((e, index) => [label(e, index), e] as const)
      .filter(([, e]) => lotMovableKinds.includes(e.kind)),
  )("%s moves to another lot, and back", (_, target) => {
    const to = lotOf(base, target.lotId).kind ? batch : po;
    const w = from(base);
    const refusal = needs[target.kind];
    if (refusal) {
      expect(() => edit(w, target, {}, { toLotId: to })).toThrow(refusal);
      return;
    }
    const move = edit(w, target, {}, { toLotId: to });
    expect(move.values).toMatchObject({
      fromLotId: target.lotId,
      toLotId: to,
    });
    expect(live(w.db, target)).toMatchObject({ lotId: to });
    expect(lotProgress(w.db, to).has(target.kind)).toBe(true);
    del(w, move);
    expect(live(w.db, target)).toEqual(live(base, target));
    expect(cacheDiff(base, w.db)).toEqual([]);
    expect(figures(w.db)).toEqual(figures(base));
  });

  test.each([1, 2, 3, 4, 5, 6])(
    "a run of 40 deletes, moves and edits unwinds, newest first, to where it started (seed %i)",
    (seed) => {
      let state = seed * 7919;
      const random = (n: number) => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state % n;
      };
      const w = from(base);
      const done: Entry[] = [];
      const dates = [day, earlier, "2026-09-07"];
      for (let step = 0; step < 40; step++) {
        const target = base.entries[random(base.entries.length)];
        const other = lotOf(base, target.lotId)?.kind ? batch : po;
        const here = live(w.db, target)?.lotId;
        const change = [
          () => del(w, target),
          () => edit(w, target, {}, { toDate: dates[random(3)] }),
          () =>
            edit(
              w,
              target,
              {},
              {
                toLotId: here === other ? target.lotId : other,
              },
            ),
          () => edit(w, target),
        ][random(4)];
        // A refused change (deleted already, in use, not movable) is no change.
        attempt(() => done.push(change()));
      }
      expect(done.length).toBeGreaterThan(10);
      // The caches the changes rebuilt are what a rebuild gives again.
      expect(rebuilt(w.db)).toEqual([]);
      for (const change of done.reverse()) del(w, change);
      expect(cacheDiff(base, w.db)).toEqual([]);
      expect(figures(w.db)).toEqual(figures(base));
      expect(base.entries.map((e) => live(w.db, e))).toEqual(
        base.entries.map((e) => live(base, e)),
      );
    },
  );

  test("every entry of the seven-day roleplay is deleted and restored as it was", () => {
    const end = today();
    const db = sevenDayRoleplay(end);
    const refused = new Set<string>();
    const changed: string[] = [];
    for (const target of db.entries) {
      if (target.kind === "config") continue;
      const w = from(db);
      const run = (id: string) =>
        w.run("owner", "void", { targetId: id, reason: "ตรวจ" }, "", end);
      let gone: Entry;
      try {
        gone = run(target.id);
      } catch (error) {
        refused.add(`${target.kind}: ${(error as Error).message}`);
        continue;
      }
      run(gone.id);
      changed.push(
        ...cacheDiff(db, w.db).map((line) => `${target.kind}: ${line}`),
      );
      if (JSON.stringify(figures(w.db)) !== JSON.stringify(figures(db)))
        changed.push(`${target.kind}: figures`);
    }
    expect(changed).toEqual([]);
    expect([...refused].sort()).toEqual(
      [
        "purchase: PO นี้ยังมีรายการอื่นหรือ PO รมควันผูกอยู่ · ลบรายการเหล่านั้นก่อน",
        "smokeOrder: ยืนยันรับ PO รมควัน อ้างถึงรายการนี้อยู่ · ลบรายการนั้นก่อน",
        "smokingInvoice: ตรวจยอด Invoice ค่ารมควัน อ้างถึงรายการนี้อยู่ · ลบรายการนั้นก่อน",
      ].sort(),
    );
  }, 60_000);
});

describe("STK-43 / MAT-01 / STK-44 what a branch received, and the Owner's store", () => {
  const clean = { warnings: [], error: "" };
  /** The Owner bought 50 chili tubes and 10 of `material`; ศาลาแดง wrote down 20 tubes and 6
   *  pieces received, มีนบุรี 5 tubes. */
  const stocked = () => {
    const w = from(setup().db);
    const chiliBought = w.run("owner", "generalPurchase", {
      purchaseDate: day,
      item: "น้ำพริกหลอด",
      purchaseCategory: "วัตถุดิบ",
      unit: "หลอด",
      quantity: "50",
      unitPrice: "6",
      supplier: "ร้านพริก",
    });
    const materialBought = w.run("owner", "materialReceive", {
      purchaseDate: day,
      material,
      quantity: "10",
      unitPrice: "2",
      supplier: "ร้านวัสดุ",
    });
    const chili = w.run("branch", "chiliReceive", {
      chiliTubes: "20",
      receiver: "ผู้ดูแล",
    });
    const boxes = w.run("branch", "materialConfirm", {
      material,
      receivedQuantity: "6",
      receiver: "ผู้ดูแล",
    });
    const theirs = w.run(
      "branch",
      "chiliReceive",
      { chiliTubes: "5", receiver: "ผู้ดูแล" },
      "",
      day,
      min,
    );
    return { w, chiliBought, materialBought, chili, boxes, theirs };
  };
  const stock = (db: Database) => ({
    chili: chiliStock(db, sala),
    boxes: branchMaterialStock(db, sala, 0),
    ownerChili: ownerChiliStock(db),
    ownerBoxes: ownerMaterialStock(db, material),
  });
  const change = (target: Entry, values: Values) => ({
    targetId: target.id,
    values: JSON.stringify(values),
    reason: "x",
  });

  test("a chili receipt is edited, undone, deleted and restored by its branch: stock follows", () => {
    const { w, chili } = stocked();
    const start = { chili: 20, boxes: 6, ownerChili: 25, ownerBoxes: 4 };
    expect(stock(w.db)).toEqual(start);
    const fix = edit(w, chili, { chiliTubes: "30" }, {}, "branch");
    expect(fix).toMatchObject({ role: "branch", branch: sala });
    expect(stock(w.db)).toEqual({ ...start, chili: 30, ownerChili: 15 });
    del(w, fix, "branch");
    expect(stock(w.db)).toEqual(start);
    const gone = del(w, chili, "branch");
    expect(live(w.db, chili)).toBeUndefined();
    expect(stock(w.db)).toEqual({ ...start, chili: 0, ownerChili: 45 });
    del(w, gone, "branch");
    expect(stock(w.db)).toEqual(start);
    expect(live(w.db, chili)).toEqual(chili);
  });

  test("a material receipt is edited, undone, deleted and restored by its branch: stock follows", () => {
    const { w, boxes } = stocked();
    const start = stock(w.db);
    const fix = edit(w, boxes, { receivedQuantity: "9" }, {}, "branch");
    expect(stock(w.db)).toEqual({ ...start, boxes: 9, ownerBoxes: 1 });
    del(w, fix, "branch");
    expect(stock(w.db)).toEqual(start);
    const gone = del(w, boxes, "branch");
    expect(stock(w.db)).toEqual({ ...start, boxes: 0, ownerBoxes: 10 });
    del(w, gone, "branch");
    expect(stock(w.db)).toEqual(start);
    expect(live(w.db, boxes)).toEqual(boxes);
    // Another material of the receipt moves both shelves.
    edit(w, boxes, { material: materials[1] }, {}, "branch");
    expect(stock(w.db)).toEqual({ ...start, boxes: 0, ownerBoxes: 10 });
    expect(branchMaterialStock(w.db, sala, 1)).toBe(6);
    expect(ownerMaterialStock(w.db, materials[1])).toBe(-6);
  });

  test("a change that leaves the branch's own shelf short is said, not refused", () => {
    const { w, chili, boxes } = stocked();
    // 3 tubes sold, 4 pieces used and 2 counted.
    w.run("branch", "sale", {
      ...sale,
      boxes: "0",
      soldKg: "0",
      chiliAddons: "3",
      lineMan: "90",
    });
    w.run(
      "branch",
      "materials",
      Object.fromEntries(
        materials.flatMap((_, i) => [
          ["opening" + i, i ? "0" : "6"],
          ["used" + i, i ? "0" : "4"],
          ["material" + i, i ? "0" : "2"],
        ]),
      ),
    );
    expect(stock(w.db)).toMatchObject({ chili: 17, boxes: 2 });
    for (const role of ["branch", "owner"] as const) {
      expectWarning(
        w.check(role, "void", { targetId: chili.id, reason: "x" }),
        "ลบแล้วน้ำพริก สาขาศาลาแดงจะติดลบ (-3.00)",
      );
      expectWarning(
        w.check(role, "entryEdit", change(chili, { chiliTubes: "2" })),
        "แก้แล้วน้ำพริก สาขาศาลาแดงจะติดลบ (-1.00)",
      );
      expectWarning(
        w.check(role, "void", { targetId: boxes.id, reason: "x" }),
        `ลบแล้ว${material} สาขาศาลาแดงจะติดลบ (-4.00)`,
      );
      expectWarning(
        w.check(role, "entryEdit", change(boxes, { receivedQuantity: "3" })),
        `แก้แล้ว${material} สาขาศาลาแดงจะติดลบ (-1.00)`,
      );
    }
    // Enough left: nothing to say.
    expect(
      w.check("branch", "entryEdit", change(chili, { chiliTubes: "3" })),
    ).toEqual(clean);
    // The material receipt is under that day's count, so the count is to be saved again (MAT-05).
    expect(
      w.check("branch", "entryEdit", change(boxes, { receivedQuantity: "4" })),
    ).toEqual({ ...clean, warnings: [recount(day)] });
    // Said, and saved.
    del(w, chili, "branch");
    del(w, boxes, "branch");
    expect(stock(w.db)).toMatchObject({ chili: -3, boxes: -4 });
  });

  test("a sale keeps the shelf its chili count was made against; an edit of a chili figure is judged against that shelf", () => {
    const { w } = stocked();
    const sold = w.run("branch", "sale", {
      ...sale,
      boxes: "0",
      soldKg: "0",
      chiliAddons: "3",
      lineMan: "90",
      chiliCount: "17",
    });
    expect(sold.values.chiliExpected).toBe("17");
    // 10 more tubes after the count: the sale still says 17 (the day table reads it).
    w.run("branch", "chiliReceive", { chiliTubes: "10", receiver: "ผู้ดูแล" });
    expect(live(w.db, sold)?.values.chiliExpected).toBe("17");
    const mismatch = "ยอดนับน้ำพริกไม่ตรง · ควรระบุหมายเหตุ";
    // Another field, or the same chili figures as the form sends them back: not judged again.
    for (const values of [
      { lineMan: "100" },
      { lineMan: "100", chiliAddons: "3", chiliCount: "17" },
    ] as Values[])
      expect(w.check("branch", "entryEdit", change(sold, values))).toEqual(
        clean,
      );
    const fixed = edit(w, sold, { lineMan: "100" }, {}, "branch");
    expect(live(w.db, sold)?.values).toMatchObject({
      lineMan: "100",
      chiliExpected: "17",
    });
    // Undoing that edit, or deleting the sale and putting it back, does not judge it either.
    expect(
      w.check("branch", "void", { targetId: fixed.id, reason: "x" }),
    ).toEqual(clean);
    const gone = del(w, sold, "branch");
    expect(
      w.check("branch", "void", { targetId: gone.id, reason: "x" }),
    ).toEqual(clean);
    del(w, gone, "branch");
    // A chili figure changed: judged against the shelf of the count (20 received, 3 or 4
    // sold), not today's 27.
    for (const values of [
      { chiliAddons: "4" },
      { chiliCount: "18" },
      { chiliCount: "27" },
    ] as Values[])
      expectWarning(
        w.check("branch", "entryEdit", change(sold, values)),
        mismatch,
      );
    // One more tube sold and one fewer counted: the count is right again. A remark answers
    // a count that is not.
    for (const values of [
      { chiliAddons: "4", chiliCount: "16" },
      { chiliCount: "16", chiliRemark: "หลอดแตก 1" },
    ] as Values[])
      expect(w.check("branch", "entryEdit", change(sold, values))).toEqual(
        clean,
      );
    edit(w, sold, { chiliAddons: "4", chiliCount: "16" }, {}, "branch");
    expect(live(w.db, sold)?.values).toMatchObject({
      chiliCount: "16",
      chiliSold: "4",
      chiliExpected: "16",
    });
    // The next edit stands on the edited figures: back to 3 sold, 17 are expected again.
    expectWarning(
      w.check("branch", "entryEdit", change(sold, { chiliAddons: "3" })),
      mismatch,
    );
    edit(w, sold, { chiliAddons: "3", chiliCount: "17" }, {}, "branch");
    expect(live(w.db, sold)?.values.chiliExpected).toBe("17");
    // A remark taken off a count that is still off is told off again.
    edit(w, sold, { chiliCount: "15", chiliRemark: "หลอดแตก 2" }, {}, "branch");
    expectWarning(
      w.check("branch", "entryEdit", change(sold, { chiliRemark: "" })),
      mismatch,
    );
    // The shelf is the sale's own: one the call sends is not taken.
    edit(w, sold, { lineMan: "110", chiliExpected: "999" }, {}, "branch");
    expect(live(w.db, sold)?.values).toMatchObject({
      lineMan: "110",
      chiliExpected: "17",
    });
  });

  test("a later receipt and sale do not move what an edited count is judged against", () => {
    const { w } = stocked();
    const sold = w.run(
      "branch",
      "sale",
      {
        ...sale,
        boxes: "0",
        soldKg: "0",
        chiliAddons: "3",
        lineMan: "90",
        chiliCount: "17",
      },
      "",
      earlier,
    );
    // The next day: 10 more tubes in and 5 sold, 22 on the shelf.
    w.run("branch", "chiliReceive", { chiliTubes: "10", receiver: "ผู้ดูแล" });
    w.run("branch", "sale", {
      ...sale,
      boxes: "0",
      soldKg: "0",
      chiliAddons: "5",
      lineMan: "150",
    });
    expect(chiliStock(w.db, sala)).toBe(22);
    // One tube short on the first day: said, and the sale still reads 17 expected.
    expectWarning(
      w.check("branch", "entryEdit", change(sold, { chiliCount: "16" })),
      "ยอดนับน้ำพริกไม่ตรง · ควรระบุหมายเหตุ",
    );
    edit(w, sold, { chiliCount: "16" }, {}, "branch");
    expect(live(w.db, sold)?.values).toMatchObject({
      chiliCount: "16",
      chiliExpected: "17",
    });
  });

  test("a sale saved before the shelf was kept is judged against today's shelf", () => {
    const { w } = stocked();
    const sold = w.run("branch", "sale", {
      ...sale,
      boxes: "0",
      soldKg: "0",
      chiliAddons: "3",
      lineMan: "90",
      chiliCount: "17",
    });
    // Old data: the sale holds no `chiliExpected`.
    w.db = {
      ...w.db,
      entries: w.db.entries.map((e) =>
        e.id === sold.id
          ? {
              ...e,
              values: Object.fromEntries(
                Object.entries(e.values).filter(
                  ([key]) => key !== "chiliExpected",
                ),
              ),
            }
          : e,
      ),
    };
    w.run("branch", "chiliReceive", { chiliTubes: "10", receiver: "ผู้ดูแล" });
    expectWarning(
      w.check("branch", "entryEdit", change(sold, { chiliCount: "18" })),
      "ยอดนับน้ำพริกไม่ตรง · ควรระบุหมายเหตุ",
    );
    expect(
      w.check("branch", "entryEdit", change(sold, { chiliCount: "27" })),
    ).toEqual(clean);
    edit(w, sold, { chiliCount: "27" }, {}, "branch");
    expect(live(w.db, sold)?.values.chiliExpected).toBe("27");
  });

  test("STK-44 a branch is never warned about the Owner's store", () => {
    // A branch's copy holds none of the Owner's purchases: the store there is only a minus.
    const w = from(setup().db);
    const chili = w.run("branch", "chiliReceive", {
      chiliTubes: "20",
      receiver: "ผู้ดูแล",
    });
    const boxes = w.run("branch", "materialConfirm", {
      material,
      receivedQuantity: "6",
      receiver: "ผู้ดูแล",
    });
    expect(ownerChiliStock(w.db)).toBe(-20);
    expect(ownerMaterialStock(w.db, material)).toBe(-6);
    // A new receipt, a raised one and a restored one each take the store further down.
    expect(
      w.check("branch", "chiliReceive", { chiliTubes: "5", receiver: "x" }),
    ).toEqual(clean);
    expect(
      w.check("branch", "materialConfirm", {
        material,
        receivedQuantity: "5",
        receiver: "x",
      }),
    ).toEqual(clean);
    expect(
      w.check("branch", "entryEdit", change(chili, { chiliTubes: "30" })),
    ).toEqual(clean);
    expect(
      w.check("branch", "entryEdit", change(boxes, { receivedQuantity: "9" })),
    ).toEqual(clean);
    for (const got of [chili, boxes]) {
      const gone = del(w, got, "branch");
      expect(
        w.check("branch", "void", { targetId: gone.id, reason: "x" }),
      ).toEqual(clean);
    }
  });

  test("STK-44 the Owner is told when its purchase, deleted or edited, takes the store below zero", () => {
    const { w, chiliBought, materialBought } = stocked();
    // Branches wrote down 25 of the 50 tubes and 6 of the 10 pieces.
    expectWarning(
      w.check("owner", "void", { targetId: chiliBought.id, reason: "x" }),
      "ลบแล้วน้ำพริกในคลัง Owner จะติดลบ (-25.00)",
    );
    expectWarning(
      w.check("owner", "entryEdit", change(chiliBought, { quantity: "20" })),
      "แก้แล้วน้ำพริกในคลัง Owner จะติดลบ (-5.00)",
    );
    expectWarning(
      w.check("owner", "void", { targetId: materialBought.id, reason: "x" }),
      `ลบแล้ว${material} ในคลัง Owner จะติดลบ (-6.00)`,
    );
    expectWarning(
      w.check("owner", "entryEdit", change(materialBought, { quantity: "5" })),
      `แก้แล้ว${material} ในคลัง Owner จะติดลบ (-1.00)`,
    );
    // Still at or above what the branches received: nothing to say.
    expect(
      w.check("owner", "entryEdit", change(chiliBought, { quantity: "25" })),
    ).toEqual(clean);
    expect(
      w.check("owner", "entryEdit", change(materialBought, { quantity: "6" })),
    ).toEqual(clean);
    // Said, and saved: the store reads the minus as it is.
    del(w, chiliBought);
    del(w, materialBought);
    expect(stock(w.db)).toEqual({
      chili: 20,
      boxes: 6,
      ownerChili: -25,
      ownerBoxes: -6,
    });
  });

  test("STK-44 the Owner is told when a branch's receipt, raised or restored, takes the store below zero; the branch is not", () => {
    const { w, chiliBought, materialBought, chili, boxes } = stocked();
    // 25 tubes and 4 pieces left in the store.
    const raised = [
      [change(chili, { chiliTubes: "50" }), "น้ำพริกในคลัง Owner", "-5.00"],
      [
        change(boxes, { receivedQuantity: "12" }),
        `${material} ในคลัง Owner`,
        "-2.00",
      ],
    ] as const;
    for (const [values, store, left] of raised) {
      expectWarning(
        w.check("owner", "entryEdit", values),
        `แก้แล้ว${store} จะติดลบ (${left})`,
      );
      expect(w.check("branch", "entryEdit", values)).toEqual(clean);
    }
    // Both receipts deleted, then the Owner's purchases cut to less than they took.
    const gone = [del(w, chili, "branch"), del(w, boxes, "branch")];
    edit(w, chiliBought, { quantity: "10" });
    edit(w, materialBought, { quantity: "3" });
    const restored = [
      ["น้ำพริกในคลัง Owner", "-15.00"],
      [`${material} ในคลัง Owner`, "-3.00"],
    ];
    gone.forEach((target, i) => {
      const back = { targetId: target.id, reason: "x" };
      expectWarning(
        w.check("owner", "void", back),
        `กู้คืนแล้ว${restored[i][0]} จะติดลบ (${restored[i][1]})`,
      );
      expect(w.check("branch", "void", back)).toEqual(clean);
    });
    // Said, and saved.
    for (const target of gone) del(w, target);
    expect(stock(w.db)).toMatchObject({ ownerChili: -15, ownerBoxes: -3 });
  });

  test("a branch cannot touch another branch's chili or material receipt", () => {
    const { w, theirs } = stocked();
    const theirBoxes = w.run(
      "branch",
      "materialConfirm",
      { material, receivedQuantity: "3", receiver: "ผู้ดูแล" },
      "",
      day,
      min,
    );
    for (const target of [theirs, theirBoxes]) {
      expect(editBlock(w.db, target, "branch", sala)).toBe(
        "แก้ไขได้เฉพาะรายการของบัญชีนี้",
      );
      expect(() => edit(w, target, { receiver: "x" }, {}, "branch")).toThrow(
        "แก้ไขได้เฉพาะรายการของบัญชีนี้",
      );
      expect(() => del(w, target, "branch")).toThrow(
        "ลบได้เฉพาะรายการของบัญชีนี้",
      );
      // Forged ones change nothing.
      const forged = (kind: EntryKind, values: Values): Database => ({
        ...w.db,
        entries: [
          ...w.db.entries,
          { ...target, id: "forged", kind, branch: sala, values },
        ],
      });
      expect(isVoided(forged("void", { targetId: target.id }), target.id)).toBe(
        false,
      );
      expect(
        live(
          forged("entryEdit", {
            targetId: target.id,
            "to.chiliTubes": "500",
            "to.receivedQuantity": "500",
          }),
          target,
        ),
      ).toEqual(target);
      // Its own branch may, and so may the Owner.
      del(
        w,
        edit(w, target, { receiver: "x" }, {}, "branch", min),
        "branch",
        min,
      );
      del(w, del(w, target));
      // And ศาลาแดง does not read it.
      expect(
        visibleEntries(w.db, "branch", sala).map((e) => e.id),
      ).not.toContain(target.id);
    }
    expect(chiliStock(w.db, min)).toBe(5);
    expect(branchMaterialStock(w.db, min, 0)).toBe(3);
  });
});

describe("MAT-05 a material receipt under a day already counted", () => {
  const clean = { warnings: [], error: "" };
  const receipt = (receivedQuantity: string) => ({
    material,
    receivedQuantity,
    receiver: "ผู้ดูแล",
  });
  /** The count of `date` as the table sends it: `used` and `actual` of the first material. */
  const tally = (
    w: World,
    date: string,
    used: string,
    actual: string,
    extra: Values = {},
  ): Values => ({
    ...Object.fromEntries(
      materials.flatMap((_, i) => {
        const opening = String(branchMaterialStock(w.db, sala, i, date));
        return [
          ["opening" + i, opening],
          ["used" + i, i ? "0" : used],
          ["material" + i, i ? opening : actual],
        ];
      }),
    ),
    ...extra,
  });
  const count = (
    w: World,
    date: string,
    ...figures: [used: string, actual: string, extra?: Values]
  ) => w.run("branch", "materials", tally(w, date, ...figures), "", date);
  /** 100 received and counted on `earlier` (10 used, 90 left); on `day` 50 more arrive, nobody
   *  writes them down, and the count finds 120 (20 used). */
  const counted = () => {
    const w = from(setup().db);
    const first = w.run(
      "branch",
      "materialConfirm",
      receipt("100"),
      "",
      earlier,
    );
    const firstCount = count(w, earlier, "10", "90");
    count(w, day, "20", "120", { materialReason0: "ของเข้าเพิ่ม" });
    expect(branchMaterialStock(w.db, sala, 0)).toBe(120);
    return { w, first, firstCount };
  };

  test("a receipt dated on or before a counted day is warned about, never refused", () => {
    const { w } = counted();
    expect(
      w.check("branch", "materialConfirm", receipt("50"), "", day),
    ).toEqual({ ...clean, warnings: [recount(day)] });
    // Before both counts: the earliest is named.
    expect(
      w.check("branch", "materialConfirm", receipt("50"), "", earlier),
    ).toEqual({ ...clean, warnings: [recount(earlier)] });
    // Saved as typed: the shelf reads the 50 twice until that day's count is saved again.
    w.run("branch", "materialConfirm", receipt("50"), "", day);
    expect(branchMaterialStock(w.db, sala, 0)).toBe(170);
    count(w, day, "20", "120", { correctionReason: "จดรับย้อนหลัง" });
    expect(branchMaterialStock(w.db, sala, 0)).toBe(120);
  });

  test("a receipt after the last count, or with no count at all, is not warned about", () => {
    const { w } = counted();
    expect(
      w.check("branch", "materialConfirm", receipt("50"), "", today()),
    ).toEqual(clean);
    expect(
      from(setup().db).check("branch", "materialConfirm", receipt("50")),
    ).toEqual(clean);
  });

  test("an edit or a restore is warned about only when it changes what the count saw", () => {
    const { w, first } = counted();
    const change = (values: Values) => ({
      targetId: first.id,
      values: JSON.stringify(values),
      reason: "x",
    });
    for (const role of ["branch", "owner"] as const) {
      expect(w.check(role, "entryEdit", change({ receiver: "x" }))).toEqual(
        clean,
      );
      expect(
        w.check(role, "entryEdit", change({ receivedQuantity: "80" })),
      ).toEqual({ ...clean, warnings: [recount(earlier)] });
      // Another material: both the one it left and the one it joined were counted that day
      // (the Owner is also told its own store of the other goes below zero, STK-44).
      expect(
        w.check(role, "entryEdit", change({ material: materials[1] })).warnings,
      ).toContain(recount(earlier));
    }
    // A count already off its opening (a receipt written under it) is not told off again by
    // a change that moves nothing.
    const under = w.run("branch", "materialConfirm", receipt("50"), "", day);
    expect(
      w.check("branch", "entryEdit", {
        targetId: under.id,
        values: JSON.stringify({ receiver: "x" }),
        reason: "x",
      }),
    ).toEqual(clean);
    del(w, under, "branch");
    // Deleted and put back as the counts saw it.
    const gone = del(w, first, "branch");
    expect(
      w.check("branch", "void", { targetId: gone.id, reason: "x" }),
    ).toEqual(clean);
    // Its day counted again without it: putting it back is a receipt under that count.
    count(w, earlier, "10", "90", { correctionReason: "ลบรายการรับ" });
    expect(
      w.check("branch", "void", { targetId: gone.id, reason: "x" }),
    ).toEqual({ ...clean, warnings: [recount(earlier)] });
  });

  test("deleting a receipt a count was built on, moving it past that count, and undoing either, are warned about", () => {
    const { w, first } = counted();
    const move = (toDate: string) => ({
      targetId: first.id,
      values: "{}",
      reason: "x",
      toDate,
    });
    for (const role of ["branch", "owner"] as const) {
      expect(
        w.check(role, "void", { targetId: first.id, reason: "x" }),
      ).toEqual({ ...clean, warnings: [recount(earlier)] });
      // To the day of the later count: the earlier one opened on it, the later one still does.
      expect(w.check(role, "entryEdit", move(day))).toEqual({
        ...clean,
        warnings: [recount(earlier)],
      });
      // Past both counts.
      expect(w.check(role, "entryEdit", move(today()))).toEqual({
        ...clean,
        warnings: [recount(earlier)],
      });
    }
    // A receipt after the last count, moved under it: that count is the one to save again.
    const late = w.run("branch", "materialConfirm", receipt("5"), "", today());
    expect(
      w.check("branch", "entryEdit", { ...move(day), targetId: late.id }),
    ).toEqual({ ...clean, warnings: [recount(day)] });
    // Moved and the counts saved again on the new openings: the undo is a change under them.
    const moved = edit(w, first, {}, { toDate: day }, "branch");
    count(w, earlier, "10", "90", { correctionReason: "ย้ายวันรับ" });
    count(w, day, "20", "120", { correctionReason: "ย้ายวันรับ" });
    expect(
      w.check("branch", "void", { targetId: moved.id, reason: "x" }),
    ).toEqual({ ...clean, warnings: [recount(earlier)] });
    // Saved, not refused.
    del(w, moved, "branch");
    expect(live(w.db, first)?.date).toBe(earlier);
  });

  test("a count whose opening went below zero is saved again, and the shelf is what was counted", () => {
    const { w, first } = counted();
    del(w, first, "branch");
    // The later count opened on the 90 the receipt left: without it, on 10 used and none in.
    expect(branchMaterialStock(w.db, sala, 0, day)).toBe(-10);
    const again = w.check("branch", "materials", {
      ...Object.fromEntries(
        materials.flatMap((_, i) => [
          ["opening" + i, i ? "0" : "-10"],
          ["used" + i, i ? "0" : "20"],
          ["material" + i, i ? "0" : "120"],
        ]),
      ),
      materialReason0: "ลบรายการรับ",
      correctionReason: "ลบรายการรับ",
    });
    expect(again.error).toBe("");
    expect(again.warnings).toEqual([
      `จำนวนใช้ ${material} เกินยอดตั้งต้น · กรอกได้สูงสุด 0`,
    ]);
    // Using nothing is not over an opening below zero.
    expect(
      w.check("branch", "materials", {
        ...tally(w, day, "0", "0"),
        correctionReason: "ลบรายการรับ",
      }),
    ).toEqual(clean);
    const saved = count(w, day, "20", "120", {
      correctionReason: "ลบรายการรับ",
    });
    expect(saved.values.opening0).toBe("-10");
    expect(branchMaterialStock(w.db, sala, 0)).toBe(120);
  });

  test("counts saved again after a deleted receipt, the earlier day first: the shelf is what was counted last", () => {
    const { w, first } = counted();
    del(w, first, "branch");
    const again = tally(w, earlier, "10", "90", {
      materialReason0: "ลบรายการรับ",
      correctionReason: "ลบรายการรับ",
    });
    // The later count opened on the 90 this one leaves, and still does.
    expect(w.check("branch", "materials", again, "", earlier).warnings).toEqual(
      [`จำนวนใช้ ${material} เกินยอดตั้งต้น · กรอกได้สูงสุด 0`],
    );
    w.run("branch", "materials", again, "", earlier);
    expect(branchMaterialStock(w.db, sala, 0, day)).toBe(90);
    expect(branchMaterialStock(w.db, sala, 0)).toBe(120);
  });

  test("counts saved again after a deleted receipt, the later day first: the earlier save says to save the later day again", () => {
    const { w, first } = counted();
    del(w, first, "branch");
    const reason = { correctionReason: "ลบรายการรับ" };
    // The later day, on its opening of -10: nothing counted after it, nothing to say.
    const later = tally(w, day, "20", "120", reason);
    expect(
      w
        .check("branch", "materials", later)
        .warnings.filter((m) => m.includes("ตรวจนับวัสดุไปแล้ว")),
    ).toEqual([]);
    w.run("branch", "materials", later);
    expect(branchMaterialStock(w.db, sala, 0)).toBe(120);
    // The earlier day now moves the later day's opening from -10 to 90, under its count.
    const before = tally(w, earlier, "10", "90", reason);
    expect(w.check("branch", "materials", before, "", earlier)).toEqual({
      error: "",
      warnings: [
        `จำนวนใช้ ${material} เกินยอดตั้งต้น · กรอกได้สูงสุด 0`,
        recount(day),
      ],
    });
    w.run("branch", "materials", before, "", earlier);
    // Off by the 100 the opening moved until the later day is saved again.
    expect(branchMaterialStock(w.db, sala, 0)).toBe(220);
    const saved = count(w, day, "20", "120", reason);
    expect(saved.values.opening0).toBe("90");
    expect(branchMaterialStock(w.db, sala, 0)).toBe(120);
  });

  test("the opening a count is saved with is the system's, whatever the form sends", () => {
    const { w } = counted();
    const forged = {
      ...tally(w, day, "20", "120", { correctionReason: "x" }),
      opening0: "-1000",
    };
    expectWarning(
      w.check("branch", "materials", forged),
      `ยอดตั้งต้น ${material} มีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่`,
    );
    const saved = w.run("branch", "materials", forged);
    expect(saved.values.opening0).toBe("90");
    expect(branchMaterialStock(w.db, sala, 0)).toBe(120);
    // The checks read the stored figure: 20 used of 90 is not over the opening, and 70 left
    // needs no reason.
    const plain = { ...tally(w, day, "20", "70"), opening0: "5" };
    expect(w.check("branch", "materials", plain).warnings).toEqual([
      `ยอดตั้งต้น ${material} มีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่`,
    ]);
    const kept = w.run("branch", "materials", {
      ...plain,
      correctionReason: "x",
    });
    expect(kept.values.opening0).toBe("90");
    expect(kept.values.missing).toBeUndefined();
    expect(branchMaterialStock(w.db, sala, 0)).toBe(70);
    // Sent with no opening at all: the same figure, nothing left empty.
    const { opening0: _, ...bare } = tally(w, today(), "0", "70");
    void _;
    const next = w.run("branch", "materials", bare, "", today());
    expect(next.values.opening0).toBe("70");
    expect(next.values.missing).toBeUndefined();
  });

  test("deleting a count a later one opened on, and putting one back on an opening that moved, are warned about", () => {
    const { w, first, firstCount } = counted();
    const gone = { targetId: firstCount.id, reason: "x" };
    for (const role of ["branch", "owner"] as const)
      expect(w.check(role, "void", gone)).toEqual({
        ...clean,
        warnings: [recount(day)],
      });
    // Put back as the later count saw it: nothing to say.
    const deleted = del(w, firstCount, "branch");
    const back = { targetId: deleted.id, reason: "x" };
    expect(w.check("branch", "void", back)).toEqual(clean);
    // The receipt deleted meanwhile: the count put back holds an opening of 100, the day's is 0.
    del(w, first, "branch");
    expect(w.check("branch", "void", back).warnings).toContain(
      recount(earlier),
    );
  });

  test("deleting the day's newest count leaves the round before it standing: told off when that one's opening is not the day's", () => {
    const w = from(setup().db);
    // Counted with nothing in, then 10 written down under it and the day counted again.
    count(w, day, "0", "0");
    w.run("branch", "materialConfirm", receipt("10"), "", day);
    const second = count(w, day, "2", "8", {
      correctionReason: "จดรับย้อนหลัง",
    });
    expect(branchMaterialStock(w.db, sala, 0)).toBe(8);
    for (const role of ["branch", "owner"] as const)
      expect(
        w.check(role, "void", { targetId: second.id, reason: "x" }),
      ).toEqual({ ...clean, warnings: [recount(day)] });
  });

  test("a deleted count that several materials stood on is one warning, one material reads as before", () => {
    const w = from(setup().db);
    // Nothing received: 5 of each found on `earlier`, all 5 used on `day`.
    const found = w.run(
      "branch",
      "materials",
      Object.fromEntries(
        materials.flatMap((_, i) => [
          ["opening" + i, "0"],
          ["used" + i, "0"],
          ["material" + i, "5"],
          ["materialReason" + i, "ของเดิมในร้าน"],
        ]),
      ),
      "",
      earlier,
    );
    w.run(
      "branch",
      "materials",
      Object.fromEntries(
        materials.flatMap((_, i) => [
          ["opening" + i, "5"],
          ["used" + i, "5"],
          ["material" + i, "0"],
        ]),
      ),
    );
    const gone = { targetId: found.id, reason: "x" };
    for (const role of ["branch", "owner"] as const)
      expect(w.check(role, "void", gone)).toEqual({
        ...clean,
        warnings: [
          `ลบแล้ววัสดุ ${materials.length} รายการ สาขาศาลาแดงจะติดลบ (${materials
            .map((m) => `${m} -5.00`)
            .join(", ")}) · แก้รายการที่ตามมาก่อน`,
          // The later count opened on the 5 this one found.
          recount(day),
        ],
      });
    // One material short: named on its own, as before.
    const one = from(setup().db);
    const got = one.run("branch", "materialConfirm", receipt("6"));
    count(one, day, "4", "2");
    expect(
      one.check("branch", "void", { targetId: got.id, reason: "x" }).warnings,
    ).toEqual([
      `ลบแล้ว${material} สาขาศาลาแดงจะติดลบ (-4.00) · แก้รายการที่ตามมาก่อน`,
      recount(day),
    ]);
  });
});

describe("GEN-04 GEN-05 a backdated entry is measured against the lot's live entries", () => {
  const clean = { warnings: [], error: "" };
  const arrive = { receivedKg: "50", arrival: "08:00" };
  /** A batch with its smoke PO and its outbound truck, both on `day`. */
  const trucked = () => {
    const s = setup();
    readyToDispatch(s, "50");
    dispatch(s);
    return { w: from(s.db), lotId: s.db.lots.at(-1)!.id };
  };

  test("a deleted entry of the batch sets no date", () => {
    const { w, lotId } = trucked();
    const late = w.run("owner", "cmReceive", arrive, lotId, "2026-09-20");
    expectWarning(
      w.check("owner", "prepare", { preSmokeKg: "48" }, lotId, "2026-09-12"),
      "วันที่ก่อนรายการอื่นของชุดนี้ (2026-09-20)",
    );
    del(w, late);
    expect(w.check("owner", "cmReceive", arrive, lotId, "2026-09-12")).toEqual(
      clean,
    );
  });

  test("an edit made today is not an entry of the batch", () => {
    const { w, lotId } = trucked();
    const sent = entries(w.db, "dispatch", lotId)[0];
    w.run(
      "owner",
      "entryEdit",
      {
        targetId: sent.id,
        values: JSON.stringify({ pickupTime: "07:00" }),
        reason: "x",
      },
      "",
      today(),
    );
    expect(w.check("owner", "cmReceive", arrive, lotId, "2026-09-12")).toEqual(
      clean,
    );
  });

  test("an entry moved to another day counts on the day it was moved to", () => {
    const { w, lotId } = trucked();
    const late = w.run("owner", "cmReceive", arrive, lotId, "2026-09-20");
    edit(w, late, {}, { toDate: "2026-09-10" });
    const weigh = (date: string) =>
      w.check("owner", "prepare", { preSmokeKg: "48" }, lotId, date);
    expect(weigh("2026-09-12")).toEqual(clean);
    expect(weigh("2026-09-10")).toEqual(clean);
    expectWarning(weigh(day), "วันที่ก่อนรายการอื่นของชุดนี้ (2026-09-10)");
  });

  test("a deleted entry dated before the PO does not hide a payment dated before it", () => {
    const s = setup();
    purchase(s, "40");
    const w = from(s.db);
    const lotId = w.db.lots[0].id;
    const early = "วันที่ก่อนวันเปิด PO";
    const pay = (date: string) =>
      w.check(
        "owner",
        "meatPayment",
        { paymentDate: date, paidBy: "Owner", paidAmount: "1" },
        lotId,
        date,
      ).warnings;
    const invoiced = w.run(
      "owner",
      "foodivaConfirm",
      {
        invoiceNo: "INV-1",
        invoiceDate: "2026-09-01",
        attachment: "inv.pdf",
        confirmedBy: "Foodiva",
        confirmedKg: "40",
        readyForChiangMaiKg: "40",
        reservedForOwnerKg: "0",
        invoiceAmount: "1",
      },
      lotId,
      "2026-09-01",
    );
    // With the early invoice live, it is the PO's earliest entry.
    expect(pay("2026-09-05").join()).not.toContain(early);
    del(w, invoiced);
    expect(pay("2026-09-05")).toContain(`${early} ของ Lot นี้ (${day})`);
    expect(pay(day).join()).not.toContain(early);
  });
});

describe("C4 the Account Manager's copy without sale money", () => {
  // The sale's current money is what every edit that counts left it at, a branch's own too.
  test("its edit of a sale keeps the money a branch's direct edit set", () => {
    const db = chillDay().db;
    const w = from(db);
    const sold = only(db, "sale");
    edit(w, sold, { lineMan: "190000" }, {}, "branch");
    expect(revenue(w.db)).toBe(190000);
    const seen = stripSaleMoney(w.db);
    const edited = mutate(
      seen,
      "owner",
      "entryEdit",
      {
        targetId: sold.id,
        values: JSON.stringify({ soldKg: "60" }),
        reason: "แก้น้ำหนัก",
      },
      "",
      day,
    );
    const saved = restoreSaleMoney(w.db, edited);
    expect(only(saved, "sale").values).toMatchObject({
      soldKg: "60",
      lineMan: "190000",
      revenue: "190000",
    });
  });

  test("its edit of a sale saved without the LINE MAN amount leaves that marked missing", () => {
    const db = chillDay().db;
    const w = from(db);
    const sold = only(db, "sale");
    edit(w, sold, { lineMan: "" }, {}, "branch");
    expect(only(w.db, "sale").values).toMatchObject({
      lineMan: "",
      missing: "lineMan",
    });
    const edited = mutate(
      stripSaleMoney(w.db),
      "owner",
      "entryEdit",
      {
        targetId: sold.id,
        values: JSON.stringify({ soldKg: "60" }),
        reason: "แก้น้ำหนัก",
      },
      "",
      day,
    );
    // The edit carries no money, and the amount the manager never saw is not called filled.
    expect(JSON.stringify(edited.entries.at(-1))).not.toMatch(
      /"(to\.|from\.)?(revenue|lineMan|menuTotal)":/,
    );
    expect(only(restoreSaleMoney(w.db, edited), "sale").values).toMatchObject({
      soldKg: "60",
      lineMan: "",
      missing: "lineMan",
    });
  });
});
