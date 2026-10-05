import { describe, expect, it } from "vitest";
import {
  advances,
  boxCost,
  cashBetween,
  branchChili,
  branchMaterial,
  branchMeat,
  branchRice,
  entries,
  giftBoxes,
  kindsForPage,
  ledgerRows,
  ledgerSummary,
  projectAssets,
  liveEntries,
  lotInfo,
  materialList,
  monthPl,
  plBetween,
  mutate,
  pendingTransfers,
  poInfo,
  purchaseLots,
  rawRiceBranches,
  saleMoney,
  salesChannels,
  seed,
  shipments,
  skuCatalogue,
  skuFor,
  stockLines,
  supplierBalances,
  todoOpens,
  todos,
  visibleEntries,
  visibleNotes,
  type Actor,
  type Database,
  type NoteKind,
  type Values,
} from "@/lib/store";
import { fields } from "@/lib/forms";
import { stripForManager } from "@/lib/manager-scope";
import { scopeDatabase } from "@/lib/role-scope";
import { sampleData } from "@/lib/store/demo";

// Smoke checks of the domain on the approved sample. The figures do not depend on the date.
const day = "2026-09-09";
const db = sampleData(day);
const owner: Actor = { role: "owner" };
const manager: Actor = { role: "owner", hidesSales: true };
const saladaeng: Actor = { role: "branch", branch: "ศาลาแดง" };
const minburi: Actor = { role: "branch", branch: "มีนบุรี" };
const last = (d: Database) => d.entries.at(-1)!;

describe("sample: Lots", () => {
  const [lot1, lot2] = shipments(db).map((lot) => lotInfo(db, lot.id));

  it("costs the complete Lot", () => {
    expect(lot1).toMatchObject({
      sentKg: 200,
      backKg: 104,
      yield: 0.52,
      meatCost: 140000,
      fee: 24000,
      shippingFee: 6000,
      centralKg: 14,
      complete: true,
    });
    // (140000 + 24000 + 6000) / 104
    expect(lot1.costPerKg).toBeCloseTo(1634.62, 2);
    expect(lot1.meatPerBox).toBeCloseTo(196.15, 2);
    expect(lot1.costPerBox).toBeCloseTo(221.15, 2);
  });

  it("counts what is yellow on the others", () => {
    expect(lot2.missing).toEqual(["smoked", "return", "smokingInvoice"]);
    expect(lot2.unlinked).toBeUndefined();
    expect(lot2.yellow).toBe(3);
    expect(lot2.costPerBox).toBeNull();
  });

  it("knows what each PO still holds", () => {
    const [po1, po2] = purchaseLots(db).map((lot) => poInfo(db, lot.id));
    expect(po1.heldKg).toBe(0);
    expect(po2.heldKg).toBe(50);
  });
});

it("sample: balance per supplier", () => {
  expect(supplierBalances(db)).toEqual([
    { supplier: "Foodiva", billed: 140000, paid: 70000, left: 70000 },
    { supplier: "Chef House", billed: 24000, paid: 24000, left: 0 },
    { supplier: "โรงพิมพ์กล่อง", billed: 149400, paid: 103750, left: 45650 },
  ]);
});

describe("mutate", () => {
  const pay = (by: Actor, values: Record<string, string>, date = day) =>
    mutate(db, by, "pay", values, "", date);

  it("refuses a negative number, a future date and what an account may not jot", () => {
    expect(() => pay(owner, { category: "other", amount: "-5" })).toThrow(
      "ยอด: เว็บไม่รับตัวเลขติดลบหรือค่าที่ไม่ใช่ตัวเลข",
    );
    expect(() =>
      pay(owner, { category: "other", amount: "5" }, "2999-01-01"),
    ).toThrow("วันที่อยู่ในอนาคต เว็บไม่รับ");
    const forbidden = "บัญชีนี้ไม่มีสิทธิ์จดรายการนี้";
    expect(() =>
      mutate(db, manager, "sale", { branch: "ศาลาแดง", boxes: "1" }, "", day),
    ).toThrow(forbidden);
    expect(() => pay(manager, { category: "payroll", amount: "1" })).toThrow(
      forbidden,
    );
    expect(() => pay(saladaeng, { category: "meat", amount: "1" })).toThrow(
      forbidden,
    );
    expect(() => mutate(db, owner, "closeDay", {}, "", day)).toThrow(
      "รายการชนิดนี้เลิกใช้แล้ว",
    );
    // V2-RUL-01: what is not a plain number, and a day that is not on the calendar.
    for (const amount of ["abc", "1e3", "0x10", "1,000"])
      expect(() => pay(owner, { category: "other", amount })).toThrow(
        "เว็บไม่รับตัวเลขติดลบหรือค่าที่ไม่ใช่ตัวเลข",
      );
    for (const date of ["", "2026-02-31", "09/09/2026", "2019-12-31"])
      expect(() =>
        pay(owner, { category: "other", amount: "5" }, date),
      ).toThrow("เลือกวันที่");
    // V2-RUL-04: any earlier day is taken.
    expect(
      last(pay(owner, { category: "other", amount: "5" }, "2020-01-01")).date,
    ).toBe("2020-01-01");
  });

  it("V2-ACC: what each account may jot and change", () => {
    const forbidden = "บัญชีนี้ไม่มีสิทธิ์จดรายการนี้";
    const jot = (by: Actor, kind: NoteKind, values: Record<string, string>) =>
      last(mutate(db, by, kind, values, "", day));
    // V2-ACC-02: payroll is the Owner's alone.
    expect(
      jot(owner, "pay", { category: "payroll", amount: "1", employee: "x" })
        .values,
    ).toMatchObject({ category: "payroll", employee: "x" });
    // V2-ACC-03, 04: a branch's kinds are the branch's alone, the Owner jots none for it.
    for (const [kind, values] of [
      ["sale", { boxes: "1", lineMan: "350" }],
      ["receive", { kg: "1" }],
      ["meatCount", { kg: "1" }],
      ["influencerBox", { influencer: "x", boxes: "1" }],
      ["materials", { "count.m1": "1" }],
    ] as const) {
      for (const by of [owner, manager])
        expect(() => jot(by, kind, { ...values, branch: "มีนบุรี" })).toThrow(
          forbidden,
        );
      expect(jot(minburi, kind, values)).toMatchObject({
        role: "branch",
        branch: "มีนบุรี",
      });
    }
    expect(() =>
      mutate(db, manager, "config", { boxPrice: "1" }, "", day),
    ).toThrow(forbidden);
    // V2-ACC-07, 08: a branch pays in four categories, into its own branch; nothing of the centre.
    for (const category of ["ingredient", "packaging", "transport", "other"])
      expect(
        jot(saladaeng, "pay", { category, amount: "1", branch: "มีนบุรี" }),
      ).toMatchObject({ role: "branch", branch: "ศาลาแดง" });
    for (const category of ["smoke", "payroll", "rent", "marketing", "capex"])
      expect(() => jot(saladaeng, "pay", { category, amount: "1" })).toThrow(
        forbidden,
      );
    for (const kind of [
      "purchase",
      "smokeOrder",
      "smoked",
      "cmReceive",
    ] as const)
      expect(() => jot(saladaeng, kind, {})).toThrow(forbidden);
    expect(() =>
      mutate(db, saladaeng, "config", { boxPrice: "1" }, "", day),
    ).toThrow(forbidden);
    // Changes: the Account Manager none about payroll, a branch none of the centre's.
    const pays = entries(db, "pay");
    const payroll = pays.find((e) => e.values.category === "payroll")!;
    const transport = pays.find((e) => e.values.category === "transport")!;
    const edit = (by: Actor, targetId: string, values = '{"amount":"9"}') =>
      mutate(db, by, "entryEdit", { targetId, values }, "", day);
    expect(() => edit(manager, payroll.id)).toThrow(
      "แก้ไขได้เฉพาะรายการของบัญชีนี้",
    );
    expect(() => edit(saladaeng, transport.id)).toThrow(
      "แก้ไขได้เฉพาะรายการของบัญชีนี้",
    );
    expect(() =>
      mutate(db, saladaeng, "void", { targetId: transport.id }, "", day),
    ).toThrow("ลบได้เฉพาะรายการของบัญชีนี้");
    // Checked as the account that jotted it: the Manager's form has no payroll, the Owner's
    // has, and still no payment moves into or out of it.
    expect(() => edit(owner, transport.id, '{"category":"payroll"}')).toThrow(
      forbidden,
    );
    const capex = pays.find((e) => e.values.category === "capex")!;
    expect(() => edit(owner, capex.id, '{"category":"payroll"}')).toThrow(
      "แก้หมวดค่าแรงไม่ได้ · ลบแล้วจดใหม่",
    );
    expect(() => edit(owner, payroll.id, '{"category":"other"}')).toThrow(
      "แก้หมวดค่าแรงไม่ได้ · ลบแล้วจดใหม่",
    );
  });

  it("saves an empty core field and lists it in missing", () => {
    const saved = last(
      mutate(db, owner, "purchase", { supplier: "Foodiva" }, "", day),
    );
    expect(saved.values).toMatchObject({
      orderedKg: "",
      price: "",
      missing: "orderedKg,price",
    });
  });

  it("stamps a branch's note with its own branch, never the input's", () => {
    const own = last(
      mutate(
        db,
        saladaeng,
        "meatCount",
        { kg: "5", branch: "มีนบุรี" },
        "",
        day,
      ),
    );
    expect(own).toMatchObject({ role: "branch", branch: "ศาลาแดง" });
    expect(own.actor).toBeUndefined();
  });

  it("a payment with a quantity goes into the branch's stock", () => {
    const before = branchMaterial(db, "มีนบุรี", "m1", day).qty;
    const paid = pay(manager, {
      category: "packaging",
      amount: "100",
      item: "m1",
      qty: "50",
      branch: "มีนบุรี",
    });
    expect(last(paid)).toMatchObject({ role: "owner", branch: "มีนบุรี" });
    expect(branchMaterial(paid, "มีนบุรี", "m1", day).qty).toBe(before + 50);
    // Not a stock category: the item, the quantity and the branch are not saved.
    const other = last(
      pay(owner, { category: "other", amount: "1", item: "m1", qty: "5" }),
    );
    expect(other.branch).toBe("");
    expect(other.values.qty).toBeUndefined();
  });

  it("edits, deletes and undoes", () => {
    // The sample's sale with no money typed: the edit fills it and clears `missing`.
    const sale = visibleNotes(db, owner).find((e) => e.values.missing)!;
    expect(sale.kind).toBe("sale");
    const edited = mutate(
      db,
      saladaeng,
      "entryEdit",
      { targetId: sale.id, values: JSON.stringify({ lineMan: "9000" }) },
      "",
      day,
    );
    expect(last(edited).values).toMatchObject({
      "to.lineMan": "9000",
      "to.missing": "",
      targetKind: "sale",
    });
    const live = (d: Database) =>
      entries(d, "sale").find((e) => e.id === sale.id);
    expect(live(edited)?.values).toMatchObject({
      lineMan: "9000",
      missing: "",
    });
    const undone = mutate(
      edited,
      saladaeng,
      "void",
      { targetId: last(edited).id },
      "",
      day,
    );
    expect(live(undone)?.values.missing).toBe("lineMan");

    const before = branchMeat(db, "ศาลาแดง", day).kg;
    const count = entries(db, "meatCount", undefined, "ศาลาแดง").at(-1)!;
    const deleted = mutate(
      db,
      saladaeng,
      "void",
      { targetId: count.id },
      "",
      day,
    );
    expect(branchMeat(deleted, "ศาลาแดง", day).kg).not.toBe(before);
    const back = mutate(
      deleted,
      saladaeng,
      "void",
      { targetId: last(deleted).id },
      "",
      day,
    );
    expect(branchMeat(back, "ศาลาแดง", day).kg).toBe(before);
    // Another branch's entry, and the Account Manager on a sale.
    expect(() =>
      mutate(db, minburi, "void", { targetId: count.id }, "", day),
    ).toThrow();
    expect(() =>
      mutate(db, manager, "void", { targetId: sale.id }, "", day),
    ).toThrow();
    // A branch's note is the branch's to change: the Owner and the Account Manager neither
    // edit nor delete it, nor undo a change of it.
    const branchOnly = "บันทึกของสาขา · สาขาเป็นคนแก้";
    for (const by of [owner, manager]) {
      expect(() =>
        mutate(
          db,
          by,
          "entryEdit",
          { targetId: count.id, values: '{"kg":"1"}' },
          "",
          day,
        ),
      ).toThrow(branchOnly);
      expect(() =>
        mutate(db, by, "void", { targetId: count.id }, "", day),
      ).toThrow(branchOnly);
      // The branch's delete of the count: not theirs to undo.
      expect(() =>
        mutate(deleted, by, "void", { targetId: last(deleted).id }, "", day),
      ).toThrow(branchOnly);
    }
    expect(() =>
      mutate(edited, owner, "void", { targetId: last(edited).id }, "", day),
    ).toThrow(branchOnly);
  });

  it("a refused list setting says what is wrong", () => {
    const channels = (...more: object[]) =>
      mutate(
        db,
        owner,
        "config",
        {
          salesChannels: JSON.stringify([
            { key: "lineMan", name: "LINE MAN", gp: "10" },
            ...more,
          ]),
        },
        "",
        day,
      );
    expect(() => channels({ key: "sales.a", name: " ", gp: "5" })).toThrow(
      "ช่องทางขาย: มีแถวที่ยังไม่ได้ใส่ชื่อ",
    );
    expect(() =>
      channels({ key: "sales.a", name: "LINE MAN", gp: "5" }),
    ).toThrow("ช่องทางขาย: ชื่อ「LINE MAN」ซ้ำกัน");
    expect(() => channels({ key: "sales.a", name: "Grab", gp: "" })).toThrow(
      "ช่องทางขาย: ยังไม่ได้ใส่ GP % ของ「Grab」",
    );
    expect(() => channels({ key: "sales.a", name: "Grab", gp: "-1" })).toThrow(
      "ช่องทางขาย: GP % ของ「Grab」ใส่เป็นตัวเลข 0 ขึ้นไป",
    );
    expect(() =>
      mutate(db, owner, "config", { boxPrice: "x" }, "", day),
    ).toThrow("ราคากล่อง: ใส่เป็นตัวเลข 0 ขึ้นไป");
    expect(
      salesChannels(channels({ key: "sales.a", name: "Grab", gp: "0" }).config),
    ).toHaveLength(2);
  });

  it("deleting a PO leaves its Lot unlinked, and putting it back links it again", () => {
    const [po1] = purchaseLots(db);
    const [lot1] = shipments(db);
    const purchase = entries(db, "purchase", po1.id)[0];
    const deleted = mutate(
      db,
      owner,
      "void",
      { targetId: purchase.id },
      "",
      day,
    );
    expect(purchaseLots(deleted).map((lot) => lot.id)).not.toContain(po1.id);
    expect(lotInfo(deleted, lot1.id)).toMatchObject({
      linked: false,
      yellow: 1,
    });
    const back = mutate(
      deleted,
      owner,
      "void",
      { targetId: last(deleted).id },
      "",
      day,
    );
    expect(lotInfo(back, lot1.id).complete).toBe(true);
  });
});

it("todos: what each account still has to jot", () => {
  const texts = (by: Actor) => todos(db, by, day).map((todo) => todo.text);
  expect(texts(owner)).toEqual(
    expect.arrayContaining([
      "ศาลาแดง: ยอดขาย วันนี้",
      "มีนบุรี: นับเนื้อวันนี้",
      "มีนบุรี: วัสดุ 10 รายการไม่ได้นับเกิน 7 วัน",
      "SO-2026-0002 รอบ TR-2026-0002: ยังไม่ได้จด น้ำหนักหลังรมควัน",
      "รอรับ Waste PO-2026-0002 15 กก.",
    ]),
  );
  // V2-PAY-04: the sample's rent is dated the month before.
  expect(texts(owner)).toContain("ค่าเช่า/น้ำไฟ ของกันยายน 2569");
  expect(texts(manager).join()).not.toContain("ยอดขาย");
  expect(texts(manager)).toEqual(
    expect.arrayContaining([
      "มีนบุรี: นับเนื้อวันนี้",
      "SO-2026-0002 รอบ TR-2026-0002: ยังไม่ได้จด ส่งกลับ",
      "ค่าเช่า/น้ำไฟ ของกันยายน 2569",
    ]),
  );
  const branch = texts(saladaeng);
  expect(branch).toContain("ยอดขาย วันนี้");
  expect(branch.join()).not.toMatch(/SO-|PO-|มีนบุรี|ศาลาแดง|ค่าเช่า/);
  expect(texts(minburi)).toEqual(
    expect.arrayContaining([
      "นับเนื้อวันนี้",
      "วัสดุ 10 รายการไม่ได้นับเกิน 7 วัน",
    ]),
  );
  // On an empty database nothing is counted: the 10 materials (a line that opens Inventory),
  // and the chili plus the raw rice of the branch that steams its own (V2-BR-08; a line that
  // opens Stock). A count takes its item out of the number, and the last one the line.
  const late = (from: Database, by: Actor) =>
    todos(from, by, day)
      .map((todo) => todo.text)
      .filter((text) => text.includes("ไม่ได้นับเกิน 7 วัน"));
  expect(late(seed, saladaeng)).toEqual([
    "วัสดุ 10 รายการไม่ได้นับเกิน 7 วัน",
    "วัตถุดิบ 2 รายการไม่ได้นับเกิน 7 วัน",
  ]);
  expect(late(seed, minburi)).toEqual([
    "วัสดุ 10 รายการไม่ได้นับเกิน 7 วัน",
    "วัตถุดิบ 1 รายการไม่ได้นับเกิน 7 วัน",
  ]);
  expect(late(seed, manager)).toEqual([
    "ศาลาแดง: วัสดุ 10 รายการไม่ได้นับเกิน 7 วัน",
    "ศาลาแดง: วัตถุดิบ 2 รายการไม่ได้นับเกิน 7 วัน",
    "มีนบุรี: วัสดุ 10 รายการไม่ได้นับเกิน 7 วัน",
    "มีนบุรี: วัตถุดิบ 1 รายการไม่ได้นับเกิน 7 วัน",
  ]);
  expect(
    todos(seed, saladaeng, day)
      .filter((todo) => todo.page)
      .map((todo) => todo.page),
  ).toEqual(["stock", "meatStock"]);
  const riceCounted = mutate(
    seed,
    saladaeng,
    "materials",
    { "count.rice": "3" },
    "",
    day,
  );
  const chiliCounted = mutate(
    riceCounted,
    saladaeng,
    "sale",
    { chiliCount: "5" },
    "",
    day,
  );
  expect(late(riceCounted, saladaeng)).toEqual([
    "วัสดุ 10 รายการไม่ได้นับเกิน 7 วัน",
    "วัตถุดิบ 1 รายการไม่ได้นับเกิน 7 วัน",
  ]);
  expect(late(chiliCounted, saladaeng)).toEqual([
    "วัสดุ 10 รายการไม่ได้นับเกิน 7 วัน",
  ]);
  expect(branch.some((text) => text.endsWith("ยังไม่ได้จด 1 ช่อง"))).toBe(true);
  // A branch's line opens its form; for the Owner the same line is a status and opens nothing.
  const line = (by: Actor, text: string) =>
    todos(db, by, day).find((todo) => todo.text === text)!;
  expect(line(saladaeng, "ยอดขาย วันนี้")).toMatchObject({
    kind: "sale",
    date: day,
  });
  expect(todoOpens(line(owner, "ศาลาแดง: ยอดขาย วันนี้"))).toBe(false);
  expect(todoOpens(line(owner, "มีนบุรี: นับเนื้อวันนี้"))).toBe(false);
  expect(
    todos(db, owner, day)
      .filter((todo) => todo.text.endsWith("ยังไม่ได้จด 1 ช่อง"))
      .some(todoOpens),
  ).toBe(false);
});

it("kindsForPage: the jot buttons of each page, per account", () => {
  // A branch: its Stock and its Inventory, with `pay` on both (it has no Finance).
  expect(kindsForPage(saladaeng, "meatStock")).toEqual([
    "sale",
    "receive",
    "meatCount",
    "influencerBox",
    "pay",
  ]);
  // The receipt of a transfer is on no page's buttons.
  expect(kindsForPage(saladaeng, "stock")).toEqual(["pay", "materials"]);
  for (const by of [owner, manager]) {
    expect(kindsForPage(by, "meatStock")).toEqual([]);
    // Inventory: stock moves between the warehouses.
    expect(kindsForPage(by, "stock")).toEqual(["transfer"]);
    // Paying a person back is the Owner's alone (V2-PAY-07).
    expect(kindsForPage(by, "finance")).toEqual(
      by === owner ? ["pay", "reimburse"] : ["pay"],
    );
    expect(kindsForPage(by, "accounting")).toEqual(["expense"]);
    expect(kindsForPage(by, "lots")).toHaveLength(11);
  }
  // Daily Log is for looking: no account jots from it.
  for (const by of [owner, manager, saladaeng])
    expect(kindsForPage(by, "log")).toEqual([]);
});

it("edit, undo, delete and put back: one kind of each group", () => {
  const cases: [NoteKind, string, string, Actor][] = [
    ["smoked", "smokedKg", "100", owner], // Lot
    ["pay", "amount", "999", manager], // เงิน
    ["cmReceive", "receivedKg", "198", manager], // จดเพิ่มได้
    ["receive", "kg", "41", saladaeng], // สาขา
  ];
  for (const [kind, key, value, by] of cases) {
    // The centre's accounts change the centre's notes only (a branch's `pay` is the branch's).
    const target = visibleNotes(db, by).find(
      (e) => e.kind === kind && e.role === by.role,
    )!;
    const now = (d: Database) =>
      liveEntries(d).find((e) => e.id === target.id)?.values[key];
    const undo = (d: Database) =>
      mutate(d, by, "void", { targetId: last(d).id }, "", day);
    const edited = mutate(
      db,
      by,
      "entryEdit",
      { targetId: target.id, values: JSON.stringify({ [key]: value }) },
      "",
      day,
    );
    expect(now(edited), kind).toBe(value);
    const unedited = undo(edited);
    expect(now(unedited), kind).toBe(target.values[key]);
    const deleted = mutate(
      unedited,
      by,
      "void",
      { targetId: target.id },
      "",
      day,
    );
    expect(now(deleted), kind).toBeUndefined();
    const back = undo(deleted);
    expect(now(back), kind).toBe(target.values[key]);
    // An undo is not undone, and a deleted entry is not edited.
    expect(() => undo(back)).toThrow(
      "รายการนี้ย้อนกลับไม่ได้ · แก้ไขหรือลบใหม่แทน",
    );
    expect(() =>
      mutate(
        deleted,
        by,
        "entryEdit",
        { targetId: target.id, values: "{}" },
        "",
        day,
      ),
    ).toThrow("รายการนี้ถูกลบแล้ว");
  }
  // The figures follow: the edited weight is the Lot's yield, and an edit can re-date a note.
  const [lot1] = shipments(db);
  const smoked = entries(db, "smoked", lot1.id)[0];
  const moved = mutate(
    db,
    owner,
    "entryEdit",
    {
      targetId: smoked.id,
      values: '{"smokedKg":"100"}',
      toDate: "2026-08-01",
    },
    "",
    day,
  );
  expect(lotInfo(moved, lot1.id).yield).toBe(0.5);
  expect(entries(moved, "smoked", lot1.id)[0].date).toBe("2026-08-01");
});

it("visibleEntries and visibleNotes: what each account sees of the log", () => {
  // The log holds an Owner's correction of a branch's sale from before a branch's notes
  // became the branch's alone: it still applies. The Owner deletes a payroll payment and a
  // transport payment.
  const sale = entries(db, "sale", undefined, "ศาลาแดง").at(-1)!;
  const pays = entries(db, "pay");
  const payroll = pays.find((e) => e.values.category === "payroll")!;
  const transport = pays.find((e) => e.values.category === "transport")!;
  const saleEdit = "old-owner-edit";
  let changed: Database = {
    ...db,
    entries: [
      ...db.entries,
      {
        id: saleEdit,
        kind: "entryEdit",
        role: "owner",
        lotId: "",
        branch: "",
        date: day,
        at: `${day}T12:00:00.000Z`,
        values: {
          targetId: sale.id,
          targetKind: "sale",
          targetRole: "branch",
          targetBranch: "ศาลาแดง",
          "to.boxes": "1",
        },
      },
    ],
  };
  expect(() =>
    mutate(changed, owner, "void", { targetId: saleEdit }, "", day),
  ).toThrow("บันทึกของสาขา · สาขาเป็นคนแก้");
  changed = mutate(changed, owner, "void", { targetId: payroll.id }, "", day);
  const payrollVoid = last(changed).id;
  changed = mutate(changed, owner, "void", { targetId: transport.id }, "", day);
  const transportVoid = last(changed).id;
  const ids = (by: Actor) => visibleEntries(changed, by).map((e) => e.id);

  expect(visibleEntries(changed, owner)).toBe(changed.entries);
  // V2-ACC-01: no sale, no payroll payment, no change about either.
  const forManager = visibleEntries(changed, manager);
  expect(forManager.some((e) => e.kind === "sale")).toBe(false);
  expect(forManager.some((e) => e.values.category === "payroll")).toBe(false);
  expect(ids(manager)).not.toContain(saleEdit);
  expect(ids(manager)).not.toContain(payrollVoid);
  expect(ids(manager)).toContain(transportVoid);
  expect(forManager).toHaveLength(
    db.entries.filter(
      (e) =>
        e.kind !== "sale" &&
        e.kind !== "reimburse" &&
        e.values.category !== "payroll",
    ).length + 1,
  );
  // V2-ACC-05..07: a branch sees what is stamped with it and the changes to that, nothing else.
  for (const [by, other] of [
    [saladaeng, "มีนบุรี"],
    [minburi, "ศาลาแดง"],
  ] as const) {
    const seen = visibleEntries(changed, by);
    for (const e of seen.filter((e) => e.kind !== "entryEdit"))
      expect([e.role, e.branch]).toEqual(["branch", by.branch]);
    expect(JSON.stringify(seen)).not.toContain(other);
    expect(seen.some((e) => e.id === transportVoid)).toBe(false);
  }
  expect(ids(saladaeng)).toContain(saleEdit);
  expect(ids(minburi)).not.toContain(saleEdit);

  // The Daily Log: live notes only, the edit laid over, newest day first.
  const notes = visibleNotes(changed, saladaeng);
  expect(notes.find((e) => e.id === sale.id)?.values.boxes).toBe("1");
  expect(
    notes.some((e) => ["entryEdit", "void", "config"].includes(e.kind)),
  ).toBe(false);
  const dates = notes.map((e) => e.date);
  expect(dates).toEqual([...dates].sort().reverse());
  expect(visibleNotes(changed, owner).map((e) => e.id)).not.toContain(
    payroll.id,
  );
  expect(visibleNotes(changed, manager).some((e) => e.kind === "sale")).toBe(
    false,
  );
  // What the Account Manager paid for the branch (stock only) is not in the branch's log.
  expect(notes.filter((e) => e.kind === "pay")).toHaveLength(1);
});

/* V2-CAL-01..14 on a small log with fixed dates: one PO, one Lot, one branch's week. */
describe("figures (V2-CAL)", () => {
  let d = mutate(
    seed,
    owner,
    "config",
    {
      salesChannels: JSON.stringify([
        { key: "lineMan", name: "LINE MAN", gp: "10" },
        { key: "sales.grab", name: "Grab", gp: "30" },
      ]),
    },
    "",
    "2026-08-01",
  );
  const jot = (
    by: Actor,
    kind: NoteKind,
    date: string,
    values: Record<string, string>,
    lotId = "",
  ) => {
    d = mutate(d, by, kind, values, lotId, date);
    return last(d);
  };
  const paid = (date: string, values: Record<string, string>) =>
    jot(owner, "pay", date, values);
  paid("2026-08-31", { category: "other", amount: "300", payer: "น้องฝน" });
  const po = jot(owner, "purchase", "2026-09-01", {
    supplier: "Foodiva",
    orderedKg: "100",
    price: "500",
  }).lotId;
  jot(
    owner,
    "meatInvoice",
    "2026-09-01",
    { invoiceNumber: "F1", netPayable: "50000" },
    po,
  );
  const lot = jot(owner, "smokeOrder", "2026-09-02", { rawKg: "60" }).lotId;
  jot(owner, "dispatch", "2026-09-03", { dispatchKg: "60", poLotId: po }, lot);
  jot(owner, "cmReceive", "2026-09-04", { receivedKg: "60" }, lot);
  jot(owner, "smoked", "2026-09-05", { smokedKg: "30", boxes: "10" }, lot);
  jot(owner, "return", "2026-09-05", { returnKg: "30", shippingFee: "0" }, lot);
  jot(
    owner,
    "smokingInvoice",
    "2026-09-06",
    { netPayable: "6000", invoiceNumber: "X1" },
    lot,
  );
  jot(saladaeng, "receive", "2026-09-07", { kg: "10" }, lot);
  jot(saladaeng, "meatCount", "2026-09-08", { kg: "8" });
  jot(saladaeng, "receive", "2026-09-09", { kg: "5" });
  jot(saladaeng, "materials", "2026-09-09", {
    "count.m1": "50",
    "count.m2": "20",
  });
  const sale = jot(saladaeng, "sale", "2026-09-10", {
    boxes: "10",
    chiliAddons: "4",
    wasteKg: "0.3",
    lineMan: "1000",
    "sales.grab": "500",
    expense: "100",
    payer: "น้องฝน",
  });
  jot(saladaeng, "sale", "2026-09-11", {
    boxes: "5",
    soldKg: "1",
    chiliCount: "40",
  });
  jot(saladaeng, "influencerBox", "2026-09-12", {
    influencer: "@x",
    boxes: "2",
    chiliAddons: "3",
    shippingFee: "50",
  });
  paid("2026-09-10", { category: "rent", amount: "2000", payer: "บริษัท" });
  paid("2026-09-11", { category: "capex", amount: "5000" });
  paid("2026-09-12", {
    category: "meat",
    amount: "20000",
    supplier: "Foodiva",
  });
  paid("2026-09-12", {
    category: "packaging",
    amount: "900",
    item: "m1",
    qty: "100",
    branch: "ศาลาแดง",
    supplier: "โรงพิมพ์",
    fullAmount: "3000",
  });
  jot(saladaeng, "pay", "2026-09-13", {
    category: "ingredient",
    amount: "200",
    item: "chili",
    qty: "10",
  });
  const built = d;

  it("CAL-01: GP is each channel's sales × its GP %", () => {
    expect(saleMoney(built.config, sale)).toEqual({ sales: 1500, gp: 250 });
  });

  it("CAL-02: a month's P&L counts payments by their date, capex apart", () => {
    expect(monthPl(built, "2026-09")).toMatchObject({
      sales: 1500,
      gp: 250,
      byCategory: {
        meat: 20000,
        packaging: 900,
        ingredient: 200,
        rent: 2000,
        marketing: 50, // V2-PAY-06: the gift's shipping fee
        other: 100, // V2-PAY-06: the sale's branch expense
        capex: 5000,
        payroll: 0,
      },
      opex: 23250,
      profit: -22000,
      capex: 5000,
    });
    expect(monthPl(built, "2026-08")).toMatchObject({
      sales: 0,
      opex: 300,
      profit: -300,
      capex: 0,
    });
    // A year is a prefix as a month is; a span of days counts its two ends.
    expect(monthPl(built, "2026").opex).toBe(23550);
    expect(plBetween(built, sale.date, sale.date)).toMatchObject({
      sales: 1500,
      boxes: Number(sale.values.boxes || 0),
      byBranch: { [sale.branch]: 1500 },
    });
    expect(plBetween(built, "2026-09", "2026-08~").sales).toBe(0);
    // V2-PAY-07: out of pocket, over payments and the sale's expense; the company is no advance.
    expect(advances(built)).toEqual([
      { payer: "น้องฝน", advanced: 400, repaid: 0, left: 400 },
    ]);
  });

  it("PAY-08: paying a person back is money out of the shop, not an expense again", () => {
    // September: ฿28,250 paid in all, ฿100 of it out of น้องฝน's pocket (the sale's expense).
    const before = cashBetween(built, "2026-09", "2026-09~");
    expect(before).toEqual({
      paid: 28250,
      company: 28150,
      advanced: 100,
      repaid: 0,
      out: 28150,
    });
    const repaid = mutate(
      built,
      owner,
      "reimburse",
      { payer: "น้องฝน", amount: "150" },
      "",
      "2026-09-20",
    );
    expect(advances(repaid)).toEqual([
      { payer: "น้องฝน", advanced: 400, repaid: 150, left: 250 },
    ]);
    expect(cashBetween(repaid, "2026-09", "2026-09~")).toEqual({
      ...before,
      repaid: 150,
      out: 28300,
    });
    // The P&L counted the expense when she paid: it does not move.
    expect(monthPl(repaid, "2026-09")).toEqual(monthPl(built, "2026-09"));
    expect(cashBetween(repaid, "2026-08", "2026-08~").repaid).toBe(0);
    // The Owner's alone: the Account Manager neither jots it nor sees it.
    expect(() =>
      mutate(
        built,
        manager,
        "reimburse",
        { payer: "น้องฝน", amount: "1" },
        "",
        "2026-09-20",
      ),
    ).toThrow("บัญชีนี้ไม่มีสิทธิ์จดรายการนี้");
    expect(visibleEntries(repaid, manager).map((e) => e.kind)).not.toContain(
      "reimburse",
    );
  });

  it("CAL-03..06, 08: a Lot's yield, meat cost, cost per box and central stock", () => {
    expect(lotInfo(built, lot)).toMatchObject({
      yield: 0.5, // 30 / 60
      meatCost: 30000, // 60 กก. × 500
      costPerKg: 1200, // (30000 + 6000) / 30
      meatPerBox: 144, // × 0.12
      costPerBox: 169, // + 25
      centralKg: 20, // 30 − 10
      complete: true,
    });
    expect(boxCost(built)).toEqual({
      lotId: lot,
      meat: 144,
      pack: 25,
      total: 169,
    });
    // V2-LOT-03: a dispatch's PO เนื้อ lines are required and add up to what was sent.
    const dispatch = entries(built, "dispatch", lot)[0];
    expect(() =>
      mutate(
        built,
        owner,
        "entryEdit",
        { targetId: dispatch.id, values: '{"poLines":""}' },
        "",
        "2026-09-14",
      ),
    ).toThrow("เลือก PO เนื้อที่ส่งไปรม");
  });

  it("CAL-07: a PO holds what was ordered less what went to the smoker", () => {
    expect(poInfo(built, po)).toMatchObject({
      orderedKg: 100,
      price: 500,
      sentKg: 60,
      heldKg: 40,
      lotIds: [lot],
      wasteKg: 0,
      wasteReceivedKg: 0,
      wastePending: false,
    });
  });

  it("CAL-09, 10: branch meat is the last count, plus receipts, less what was used and wasted", () => {
    const at = (today: string) => branchMeat(built, "ศาลาแดง", today);
    // 8 + 5 − (10 × 0.12 + 0.3) − 1 (typed) − 2 × 0.12
    expect(at("2026-09-13").kg).toBeCloseTo(10.26, 10);
    expect(at("2026-09-13").countedToday).toBe(false);
    expect(at("2026-09-08").countedToday).toBe(true);
    expect(branchMeat(built, "มีนบุรี", "2026-09-13")).toMatchObject({
      kg: 0,
      counted: undefined,
    });
  });

  it("CAL-11: a material is the last count, plus what was bought, less boxes × per box", () => {
    const m1 = (today: string) => branchMaterial(built, "ศาลาแดง", "m1", today);
    // 50 − 10 − 5 − 2 + 100
    expect(m1("2026-09-16")).toEqual({
      qty: 133,
      countedOn: "2026-09-09",
      stale: false,
    });
    // V2-BR-03: the eighth day is yellow.
    expect(m1("2026-09-17").stale).toBe(true);
    // No "per box": only counts and purchases move it.
    expect(branchMaterial(built, "ศาลาแดง", "m2", "2026-09-16").qty).toBe(20);
    expect(branchMaterial(built, "ศาลาแดง", "m3", "2026-09-16")).toEqual({
      qty: -17,
      countedOn: "",
      stale: true,
    });
    expect(branchMaterial(built, "มีนบุรี", "m1", "2026-09-16").qty).toBe(0);
  });

  it("CAL-12: chili is the count in the sale form, plus what was bought, less sold and given", () => {
    // 40 (counted 11 ก.ย.) − 3 + 10
    expect(branchChili(built, "ศาลาแดง", "2026-09-18")).toEqual({
      qty: 47,
      countedOn: "2026-09-11",
      stale: false,
    });
    // Late as a material is: more than 7 days after the count, or never counted.
    expect(branchChili(built, "ศาลาแดง", "2026-09-19").stale).toBe(true);
    expect(branchChili(built, "มีนบุรี", "2026-09-11").stale).toBe(true);
  });

  it("CAL-19: raw rice is the last count plus what was bought since; nothing is taken off", () => {
    const rice = (qty: string, date: string) =>
      [
        owner,
        "pay",
        {
          category: "ingredient",
          amount: "1",
          item: "rice",
          qty,
          branch: "ศาลาแดง",
        },
        date,
      ] as const;
    const jotted = (
      [
        rice("20", "2026-09-08"),
        [saladaeng, "materials", { "count.rice": "12.5" }, "2026-09-09"],
        rice("5", "2026-09-10"),
        // A count of materials only leaves the rice count where it was.
        [saladaeng, "materials", { "count.m2": "20" }, "2026-09-11"],
      ] as const
    ).reduce(
      (next, [by, kind, input, date]) =>
        mutate(next, by, kind, input, "", date),
      built,
    );
    // Never counted: what was bought, and late.
    expect(branchRice(built, "ศาลาแดง", "2026-09-16")).toEqual({
      qty: 0,
      countedOn: "",
      stale: true,
    });
    // 12.5 (counted 9 ก.ย.) + 5; the sales and gift boxes since take nothing.
    expect(branchRice(jotted, "ศาลาแดง", "2026-09-16")).toEqual({
      qty: 17.5,
      countedOn: "2026-09-09",
      stale: false,
    });
    expect(branchRice(jotted, "ศาลาแดง", "2026-09-17").stale).toBe(true);
    expect(branchRice(jotted, "มีนบุรี", "2026-09-16").qty).toBe(0);
  });

  it("variance: the latest count against what the walk expected just before it", () => {
    const jotted = (
      d: Database,
      kind: Parameters<typeof mutate>[2],
      values: Values,
      date: string,
    ) => mutate(d, saladaeng, kind, values, "", date);
    const meat = (d: Database) =>
      branchMeat(d, "ศาลาแดง", "2026-09-13").variance;
    // A first count has nothing true before it: no variance, as a line never counted.
    expect(meat(built)).toBeUndefined();
    expect(branchMeat(built, "มีนบุรี", "2026-09-13").variance).toBeUndefined();
    // A backdated count before the receipt gives the later count its start: 5 + 10.
    const two = jotted(built, "meatCount", { kg: "5" }, "2026-09-06");
    expect(meat(two)).toEqual({
      expected: 15,
      counted: 8,
      diff: -7,
      date: "2026-09-08",
    });
    // An edited count is read as edited.
    const count = entries(built, "meatCount", undefined, "ศาลาแดง").at(-1)!;
    expect(
      meat(
        jotted(
          two,
          "entryEdit",
          { targetId: count.id, values: JSON.stringify({ kg: "15" }) },
          "2026-09-13",
        ),
      ),
    ).toMatchObject({ expected: 15, counted: 15, diff: 0 });
    // Deleting the earlier of the two leaves a first count again; deleting the later one
    // leaves the earlier, which is a first count too.
    expect(
      meat(jotted(two, "void", { targetId: last(two).id }, "2026-09-13")),
    ).toBeUndefined();
    expect(
      meat(jotted(two, "void", { targetId: count.id }, "2026-09-13")),
    ).toBeUndefined();

    // A material: a backdated count the day before the last one, then deleted again.
    const m1 = (d: Database) =>
      branchMaterial(d, "ศาลาแดง", "m1", "2026-09-16").variance;
    expect(m1(built)).toBeUndefined();
    const earlier = jotted(
      built,
      "materials",
      { "count.m1": "60" },
      "2026-09-08",
    );
    expect(m1(earlier)).toMatchObject({ expected: 60, counted: 50, diff: -10 });
    expect(
      m1(jotted(earlier, "void", { targetId: last(earlier).id }, "2026-09-16")),
    ).toBeUndefined();
    // A second count: 50 − 10 − 5 − 2 + 100 expected.
    expect(
      m1(jotted(built, "materials", { "count.m1": "130" }, "2026-09-14")),
    ).toEqual({ expected: 133, counted: 130, diff: -3, date: "2026-09-14" });
    expect(
      branchMaterial(built, "ศาลาแดง", "m3", "2026-09-16").variance,
    ).toBeUndefined();

    // Chili: counted at the end of a sale form, so that sale's own tubes come off first:
    // 40 − 3 + 10 − 2.
    expect(
      branchChili(built, "ศาลาแดง", "2026-09-14").variance,
    ).toBeUndefined();
    expect(
      branchChili(
        jotted(
          built,
          "sale",
          { chiliAddons: "2", chiliCount: "40" },
          "2026-09-14",
        ),
        "ศาลาแดง",
        "2026-09-14",
      ).variance,
    ).toEqual({ expected: 45, counted: 40, diff: -5, date: "2026-09-14" });
    // Raw rice has none: the web takes nothing off it, so there is no expected figure.
    expect(branchRice(built, "ศาลาแดง", "2026-09-16")).not.toHaveProperty(
      "variance",
    );
  });

  it("variance: the Account Manager's copy, without the sale money, gives the Owner's figures", () => {
    // A second count of each line, so each has a variance; the chili's is on a sale with money.
    let d = mutate(
      built,
      saladaeng,
      "meatCount",
      { kg: "9" },
      "",
      "2026-09-14",
    );
    d = mutate(
      d,
      saladaeng,
      "sale",
      { boxes: "6", chiliAddons: "2", chiliCount: "40", lineMan: "2100" },
      "",
      "2026-09-14",
    );
    d = mutate(
      d,
      saladaeng,
      "materials",
      { "count.m1": "120" },
      "",
      "2026-09-15",
    );
    const copy = stripForManager(d);
    expect(JSON.stringify(d.entries)).toContain('"2100"');
    expect(JSON.stringify(copy.entries)).not.toContain('"2100"');
    const figures = (x: Database) => ({
      meat: branchMeat(x, "ศาลาแดง", "2026-09-16"),
      chili: branchChili(x, "ศาลาแดง", "2026-09-16"),
      boxes: branchMaterial(x, "ศาลาแดง", "m1", "2026-09-16"),
    });
    const { meat, chili, boxes } = figures(d);
    // 8 + 5 − (10 × 0.12 + 0.3) − 1 − 2 × 0.12; 40 − 3 + 10 − 2; 50 − 10 − 5 − 2 + 100 − 6.
    expect(meat.variance).toMatchObject({ counted: 9 });
    expect(meat.variance!.expected).toBeCloseTo(10.26);
    expect(chili.variance).toMatchObject({ expected: 45, counted: 40 });
    expect(boxes.variance).toMatchObject({ expected: 127, counted: 120 });
    expect(figures(copy)).toEqual({ meat, chili, boxes });
  });

  it("BR-08: only a branch that uses raw rice counts it, and only the Owner says which", () => {
    const count = (d: Database, by: Actor) =>
      last(
        mutate(
          d,
          by,
          "materials",
          { "count.rice": "3", "count.m1": "9" },
          "",
          day,
        ),
      ).values;
    expect(rawRiceBranches(seed.config)).toEqual(["ศาลาแดง"]);
    expect(count(seed, saladaeng)["count.rice"]).toBe("3");
    // มีนบุรี buys its rice cooked: the row is not in its form, so it is not saved.
    expect(count(seed, minburi)["count.rice"]).toBeUndefined();
    expect(() =>
      mutate(seed, minburi, "materials", { "count.rice": "3" }, "", day),
    ).toThrow("ยังไม่ได้ใส่ยอดนับ");
    const set = (by: Actor, value: string) =>
      mutate(seed, by, "config", { rawRiceBranches: value }, "", day);
    const both = set(owner, '["ศาลาแดง","มีนบุรี"]');
    expect(count(both, minburi)["count.rice"]).toBe("3");
    expect(count(set(owner, "[]"), saladaeng)["count.rice"]).toBeUndefined();
    for (const bad of [
      '["เชียงใหม่"]',
      '["มีนบุรี","มีนบุรี"]',
      "มีนบุรี",
      '"x"',
    ])
      expect(() => set(owner, bad)).toThrow("สาขาที่ใช้ข้าวเหนียวดิบ");
    expect(() => set(manager, "[]")).toThrow("ไม่มีสิทธิ์");
    expect(() => set(saladaeng, "[]")).toThrow("ไม่มีสิทธิ์");
  });

  it("CAL-13: a supplier's balance is its bills less what was paid to it", () => {
    expect(supplierBalances(built)).toEqual([
      { supplier: "Foodiva", billed: 50000, paid: 20000, left: 30000 },
      { supplier: "Chef House", billed: 6000, paid: 0, left: 6000 },
      { supplier: "โรงพิมพ์", billed: 3000, paid: 900, left: 2100 },
    ]);
  });

  it("CAL-14: gift boxes are a figure of their own and leave the P&L alone", () => {
    expect(giftBoxes(built, "2026-09")).toEqual({ boxes: 2, value: 338 });
    const more = mutate(
      built,
      saladaeng,
      "influencerBox",
      { influencer: "@y", boxes: "8" },
      "",
      "2026-09-14",
    );
    expect(giftBoxes(more, "2026-09")).toEqual({ boxes: 10, value: 1690 });
    expect(monthPl(more, "2026-09")).toEqual(monthPl(built, "2026-09"));
  });
});

describe("SKU: materials and ledger items", () => {
  const jot = (d: Database, item: string, by: Actor = manager) =>
    mutate(d, by, "expense", { item, amount: "10" }, "", day);
  const sku = (d: Database) => last(d).values.sku;
  const config = (d: Database, input: Values, by: Actor = owner) =>
    mutate(d, by, "config", input, "", day);
  const edit = (d: Database, id: string, values: Values) =>
    mutate(
      d,
      manager,
      "entryEdit",
      { targetId: id, values: JSON.stringify(values) },
      "",
      day,
    );
  const skuOf = (d: Database, id: string) =>
    entries(d, "expense").find((e) => e.id === id)!.values.sku;
  const name = (d: Database, code: string) =>
    skuCatalogue(d).find((item) => item.sku === code)?.name;

  it("the seed's materials are SKU-0001 to SKU-0010, and a new ledger item is the next", () => {
    expect(materialList(seed.config).map((m) => m.sku)).toEqual(
      Array.from(
        { length: 10 },
        (_, i) => `SKU-${String(i + 1).padStart(4, "0")}`,
      ),
    );
    let d = jot(seed, "กระดาษ A4");
    expect(sku(d)).toBe("SKU-0011");
    d = jot(d, "ปากกา", owner);
    expect(sku(d)).toBe("SKU-0012");
    // The same name, trimmed, any case: the same item.
    d = jot(d, "  กระดาษ a4 ");
    expect(sku(d)).toBe("SKU-0011");
    expect(skuFor(d, "ยางลบ")).toEqual({ sku: "SKU-0013", isNew: true });
    expect(skuFor(d, " ")).toEqual({ sku: "", isNew: false });
  });

  it("an expense named as a material carries the material's SKU and moves no stock", () => {
    const before = branchMaterial(seed, "ศาลาแดง", "m3", day);
    const d = mutate(
      seed,
      manager,
      "expense",
      { item: " ถุงซีลเนื้อ", qty: "500", amount: "900" },
      "",
      day,
    );
    expect(sku(d)).toBe("SKU-0003");
    expect(skuFor(d, "ถุงซีลเนื้อ")).toEqual({ sku: "SKU-0003", isNew: false });
    expect(branchMaterial(d, "ศาลาแดง", "m3", day)).toEqual(before);
    // The form offers every item, the materials included, each under its SKU.
    expect(
      fields("expense", d, manager).find((f) => f.key === "item")!.options,
    ).toContainEqual({ value: "ถุงซีลเนื้อ", label: "SKU-0003" });
  });

  it("never gives a number twice: not a deleted entry's, an edited-away one's or a removed material's", () => {
    let d = jot(seed, "กระดาษ A4");
    d = jot(d, "ปากกา");
    d = mutate(d, owner, "void", { targetId: last(d).id }, "", day);
    d = jot(d, "ยางลบ");
    expect(sku(d)).toBe("SKU-0013");
    // The deleted item is no longer in the catalogue: its name is a new item.
    expect(skuFor(d, "ปากกา")).toEqual({ sku: "SKU-0014", isNew: true });
    const id = last(d).id;
    // An edit that keeps the name keeps the SKU; a new name gets a new one; a name that
    // exists gets that item's.
    d = edit(d, id, { item: "ยางลบ", qty: "2" });
    expect(skuOf(d, id)).toBe("SKU-0013");
    d = edit(d, id, { item: "คลิปหนีบ" });
    expect(skuOf(d, id)).toBe("SKU-0014");
    d = edit(d, id, { item: "กระดาษ a4" });
    expect(skuOf(d, id)).toBe("SKU-0011");
    expect(skuFor(d, "ลวดเย็บ").sku).toBe("SKU-0015");
    // A material added in Settings takes the next number, whatever the save sends; one
    // removed keeps its number out of use.
    const rows = JSON.parse(d.config.materialList);
    d = config(d, {
      materialList: JSON.stringify([
        ...rows,
        { id: "mx", sku: "SKU-0001", name: "เชือก", perBox: "" },
        { id: "my", name: "เทป", perBox: "" },
      ]),
    });
    expect(materialList(d.config).slice(-3)).toMatchObject([
      { id: "m10", sku: "SKU-0010" },
      { id: "mx", sku: "SKU-0015" },
      { id: "my", sku: "SKU-0016" },
    ]);
    d = config(d, { materialList: JSON.stringify(rows) });
    expect(jot(d, "ลวดเย็บ").entries.at(-1)!.values.sku).toBe("SKU-0017");
  });

  it("a rename keeps the SKU: a material in its list, a ledger item in skuNames", () => {
    let d = jot(seed, "กระดาษ A4");
    const id = last(d).id;
    const rows: Values[] = JSON.parse(d.config.materialList);
    d = config(d, {
      materialList: JSON.stringify(
        rows.map((row) =>
          row.id === "m3" ? { ...row, name: "ถุงซีล", sku: "" } : row,
        ),
      ),
    });
    expect(materialList(d.config)[2]).toMatchObject({
      id: "m3",
      sku: "SKU-0003",
      name: "ถุงซีล",
    });
    d = config(d, {
      skuNames: JSON.stringify([{ sku: "SKU-0011", name: " A4 80 แกรม " }]),
    });
    expect(name(d, "SKU-0011")).toBe("A4 80 แกรม");
    // The old row shows the new name; its entry keeps what was typed.
    expect(ledgerRows(d).find((row) => row.id === id)).toMatchObject({
      item: "A4 80 แกรม",
      sku: "SKU-0011",
    });
    // The new name is that item; the old name is now a new one.
    expect(sku(jot(d, "a4 80 แกรม"))).toBe("SKU-0011");
    expect(sku(jot(d, "กระดาษ A4"))).toBe("SKU-0012");
    // An edit that leaves the item as typed keeps its SKU.
    expect(skuOf(edit(d, id, { qty: "3" }), id)).toBe("SKU-0011");
  });

  it("refuses a name used twice in the catalogue, an empty one, and a rename by anyone but the Owner", () => {
    const d = jot(jot(seed, "กระดาษ A4"), "ปากกา");
    const rename = (to: string, by?: Actor) =>
      config(
        d,
        { skuNames: JSON.stringify([{ sku: "SKU-0011", name: to }]) },
        by,
      );
    expect(() => rename("ปากกา")).toThrow("ซ้ำกัน");
    // A material's name is taken too, in any case.
    expect(() => rename("ถุงซีลเนื้อ")).toThrow("ซ้ำกัน");
    expect(() => rename(" ")).toThrow("ยังไม่ได้ใส่ชื่อ");
    expect(() => config(d, { skuNames: "x" })).toThrow("อ่านรายการไม่ได้");
    expect(() => rename("A4", manager)).toThrow("ไม่มีสิทธิ์");
    // A material named as a ledger item is refused the same way.
    const rows: Values[] = JSON.parse(d.config.materialList);
    expect(() =>
      config(d, {
        materialList: JSON.stringify([
          ...rows,
          { id: "mz", name: "ปากกา", perBox: "" },
        ]),
      }),
    ).toThrow("ซ้ำกัน");
  });

  it("a materials list stored before SKUs has none until it is saved again", () => {
    const old: Database = {
      ...seed,
      config: {
        ...seed.config,
        materialList: JSON.stringify([
          { id: "m1", name: "กล่อง", perBox: "1" },
        ]),
      },
    };
    expect(materialList(old.config)[0].sku).toBe("");
    const saved = config(old, { materialList: old.config.materialList });
    expect(materialList(saved.config)[0].sku).toBe("SKU-0001");
  });

  it("is jotted by the Owner and the Manager only", () => {
    expect(() => jot(seed, "กระดาษ", saladaeng)).toThrow();
  });
});

describe("ledger: PO rows", () => {
  const rows = ledgerRows(db).filter((row) => row.source === "po");

  it("lists every PO เนื้อ and PO รมควัน with its amount", () => {
    expect(rows).toHaveLength(purchaseLots(db).length + shipments(db).length);
    const [po1] = purchaseLots(db);
    const [lot1] = shipments(db);
    // The Foodiva invoice; the Chef House invoice.
    expect(rows.find((row) => row.lotId === po1.id)!.poAmount).toBe(140000);
    expect(rows.find((row) => row.lotId === lot1.id)!.poAmount).toBe(24000);
  });

  it("spreads a supplier's payments over its POs oldest first", () => {
    const [po1, po2] = purchaseLots(db);
    const [lot1] = shipments(db);
    const row = (id: string) => rows.find((r) => r.lotId === id)!;
    expect(row(lot1.id)).toMatchObject({ paid: 24000, status: "paid" });
    expect(row(po1.id)).toMatchObject({ paid: 70000, status: "pending" });
    expect(row(po2.id)).toMatchObject({ paid: 0, status: "pending" });
    // Paying the rest and more: the first fills up, the second gets what is over.
    const d = mutate(
      db,
      owner,
      "pay",
      { category: "meat", amount: "80000", supplier: "Foodiva" },
      "",
      day,
    );
    const after = (id: string) => ledgerRows(d).find((r) => r.lotId === id)!;
    expect(after(po1.id)).toMatchObject({ paid: 140000, status: "paid" });
    expect(after(po2.id)).toMatchObject({ paid: 10000, status: "pending" });
  });

  it("drops a deleted PO", () => {
    const [po1] = purchaseLots(db);
    const purchase = entries(db, "purchase", po1.id)[0];
    const d = mutate(db, owner, "void", { targetId: purchase.id }, "", day);
    expect(ledgerRows(d).some((row) => row.lotId === po1.id)).toBe(false);
  });
});

describe("ledger: summary", () => {
  it("holds the pending POs' amounts, and sums what was paid per month", () => {
    const rows = ledgerRows(db);
    const waiting = rows.filter(
      (row) => row.source === "po" && row.status === "pending",
    );
    expect(waiting.length).toBeGreaterThan(0);
    expect(ledgerSummary(rows, "2026-09")).toMatchObject({
      waiting: waiting.length,
      reserved: waiting.reduce((a, row) => a + row.poAmount!, 0),
    });

    const jot = (d: Database, date: string, values: Record<string, string>) =>
      mutate(d, owner, "expense", { item: "x", ...values }, "", date);
    let d = jot(seed, "2026-01-05", { amount: "100" });
    d = jot(d, "2025-12-20", { amount: "50" });
    d = jot(d, "2026-01-06", { amount: "900", status: "cancelled" });
    // The month before January is December of the year before.
    expect(ledgerSummary(ledgerRows(d), "2026-01")).toEqual({
      reserved: 0,
      waiting: 0,
      paid: 100,
      paidBefore: 50,
    });
  });

  it("keeps a row saved with the retired เงินสดย่อย source, with no source", () => {
    const d = mutate(seed, owner, "expense", { item: "x" }, "", day);
    const old = {
      ...d,
      entries: d.entries.map((e) => ({
        ...e,
        values: { ...e.values, source: "petty" },
      })),
    };
    expect(ledgerRows(old)[0].source).toBe("");
    expect(() =>
      mutate(seed, owner, "expense", { item: "x", source: "petty" }, "", day),
    ).toThrow();
  });
});

describe("Inventory: what the project owns", () => {
  it("lists what the ledger bought for the project, an item once, by type", () => {
    const buy = (d: Database, values: Record<string, string>) =>
      mutate(
        d,
        owner,
        "expense",
        { purpose: "project", project: "Nerdnuea x LINE MAN", ...values },
        "",
        "2026-01-05",
      );
    let d = buy(seed, {
      itemType: "สินทรัพย์",
      item: "ตู้เย็น",
      amount: "9000",
    });
    d = buy(d, {
      itemType: "วัสดุบรรจุภัณฑ์",
      item: "กล่องพิมพ์ลาย",
      qty: "50",
      amount: "500",
    });
    d = buy(d, {
      itemType: "วัสดุบรรจุภัณฑ์",
      item: "กล่องพิมพ์ลาย",
      qty: "30",
      amount: "300",
    });
    // Not the project's: the office's, another project's, a cancelled one.
    d = buy(d, { itemType: "สินทรัพย์", item: "โต๊ะ", purpose: "company" });
    d = buy(d, { itemType: "สินทรัพย์", item: "ป้าย", project: "งานอื่น" });
    d = buy(d, { itemType: "สินทรัพย์", item: "พัดลม", status: "cancelled" });
    expect(projectAssets(d)).toMatchObject([
      {
        type: "วัสดุบรรจุภัณฑ์",
        // The material of Settings: its SKU.
        rows: [{ sku: "SKU-0001", qty: 80, paid: 800, times: 2 }],
      },
      { type: "สินทรัพย์", rows: [{ item: "ตู้เย็น", qty: null, paid: 9000 }] },
    ]);
  });
});

describe("central warehouse: stock per place", () => {
  const buy = (d: Database, values: Values, date = "2026-09-01") =>
    mutate(
      d,
      owner,
      "expense",
      { purpose: "project", project: "Nerdnuea x LINE MAN", ...values },
      "",
      date,
    );
  const send = (d: Database, values: Values, date = "2026-09-02") =>
    mutate(d, manager, "transfer", { from: "central", ...values }, "", date);
  const receive = (d: Database, by: Actor, transferId: string) =>
    mutate(d, by, "transferReceive", { transferId }, "", "2026-09-04");
  const edit = (d: Database, id: string, values: Values) =>
    mutate(
      d,
      owner,
      "entryEdit",
      { targetId: id, values: JSON.stringify(values) },
      "",
      day,
    );
  const line = (d: Database, sku: string) =>
    stockLines(d, day).find((row) => row.sku === sku)!;
  // The first item bought on the seed: the ten materials hold SKU-0001 to SKU-0010.
  const fridge = "SKU-0011";

  it("an expense of the project goes into its warehouse, the central one unless it names a branch", () => {
    let d = buy(seed, { item: "ตู้เย็น", qty: "3" });
    expect(last(d).branch).toBe("");
    d = buy(d, { item: "ตู้เย็น", qty: "2", warehouse: "มีนบุรี" });
    // Stamped with the branch, so its stock line reaches that branch's copy.
    expect(last(d).branch).toBe("มีนบุรี");
    // Not stock: the office's, another project's, a cancelled one, one with no quantity.
    d = buy(d, { item: "ตู้เย็น", qty: "9", purpose: "company" });
    expect(last(d).values.warehouse).toBeUndefined();
    d = buy(d, { item: "ตู้เย็น", qty: "9", project: "งานอื่น" });
    d = buy(d, { item: "ตู้เย็น", qty: "9", status: "cancelled" });
    d = buy(d, { item: "ตู้เย็น" });
    expect(line(d, fridge)).toEqual({
      sku: fridge,
      name: "ตู้เย็น",
      materialId: "",
      at: { central: 3, ศาลาแดง: 0, มีนบุรี: 2 },
      inTransit: 0,
    });
    // Every Settings material is a line, bought or not.
    expect(stockLines(seed, day)).toHaveLength(10);
    expect(line(seed, "SKU-0001")).toMatchObject({
      name: "กล่องพิมพ์ลาย",
      materialId: "m1",
      at: { central: 0, ศาลาแดง: 0, มีนบุรี: 0 },
    });
  });

  it("an edited, cancelled or deleted expense moves the balance with it", () => {
    let d = buy(seed, { item: "ตู้เย็น", qty: "3" });
    const id = last(d).id;
    d = edit(d, id, { qty: "5" });
    expect(line(d, fridge).at.central).toBe(5);
    // Into a branch it goes by a transfer: the entry's branch is fixed when it is saved.
    expect(() => edit(d, id, { warehouse: "มีนบุรี" })).toThrow(
      "แก้เป็นคลังของสาขาอื่นไม่ได้",
    );
    // A cancelled one bought nothing: no line is left of it.
    expect(line(edit(d, id, { status: "cancelled" }), fridge)).toBeUndefined();
    d = mutate(d, owner, "void", { targetId: id }, "", day);
    // Nothing names the SKU any more.
    expect(line(d, fridge)).toBeUndefined();
    // One bought into a branch may be edited back to the central warehouse.
    d = buy(seed, { item: "ตู้เย็น", qty: "2", warehouse: "มีนบุรี" });
    d = edit(d, last(d).id, { warehouse: "central" });
    expect(line(d, fridge).at).toMatchObject({ central: 2, มีนบุรี: 0 });
  });

  it("a transfer arrives at once, or when the branch confirms; a balance may go below zero", () => {
    let d = buy(seed, { item: "ตู้เย็น", qty: "3" });
    d = send(d, { item: "ตู้เย็น", to: "ศาลาแดง", qty: "1" });
    expect(last(d)).toMatchObject({
      role: "owner",
      branch: "",
      values: {
        item: "ตู้เย็น",
        itemName: "ตู้เย็น",
        sku: fridge,
        from: "central",
        to: "ศาลาแดง",
      },
    });
    expect(line(d, fridge).at).toEqual({ central: 2, ศาลาแดง: 1, มีนบุรี: 0 });
    // Over-allocated, and waiting for the branch: in neither place.
    d = send(d, {
      item: "ตู้เย็น",
      to: "มีนบุรี",
      qty: "4",
      receive: "confirm",
    });
    const sent = last(d).id;
    expect(line(d, fridge)).toMatchObject({
      at: { central: -2, ศาลาแดง: 1, มีนบุรี: 0 },
      inTransit: 4,
    });
    expect(pendingTransfers(d, "มีนบุรี").map((e) => e.id)).toEqual([sent]);
    expect(pendingTransfers(d, "ศาลาแดง")).toEqual([]);
    // Only the branch it was sent to confirms it, all of it, once.
    expect(() => receive(d, saladaeng, sent)).toThrow(
      "ไม่พบรายการจัดสรรที่รอสาขานี้ยืนยันรับ",
    );
    expect(() => receive(d, owner, sent)).toThrow(
      "บัญชีนี้ไม่มีสิทธิ์จดรายการนี้",
    );
    const got = receive(d, minburi, sent);
    expect(last(got)).toMatchObject({ role: "branch", branch: "มีนบุรี" });
    expect(line(got, fridge)).toMatchObject({
      at: { central: -2, ศาลาแดง: 1, มีนบุรี: 4 },
      inTransit: 0,
    });
    expect(pendingTransfers(got, "มีนบุรี")).toEqual([]);
    expect(() => receive(got, minburi, sent)).toThrow("รายการนี้ยืนยันรับแล้ว");
    // The receipt is the branch's to delete: the transfer waits again.
    const receipt = { targetId: last(got).id };
    expect(() => mutate(got, owner, "void", receipt, "", day)).toThrow(
      "บันทึกของสาขา · สาขาเป็นคนแก้",
    );
    expect(() => mutate(got, minburi, "entryEdit", receipt, "", day)).toThrow(
      "รายการชนิดนี้แก้ไขย้อนหลังไม่ได้",
    );
    const back = mutate(got, minburi, "void", receipt, "", day);
    expect(line(back, fridge)).toMatchObject({
      at: { มีนบุรี: 0 },
      inTransit: 4,
    });
    expect(pendingTransfers(back, "มีนบุรี").map((e) => e.id)).toEqual([sent]);
    // Branch to branch, and back to the central warehouse (there at once, whatever is asked).
    d = send(got, {
      item: "ตู้เย็น",
      from: "ศาลาแดง",
      to: "มีนบุรี",
      qty: "1",
    });
    d = send(d, {
      item: "ตู้เย็น",
      from: "มีนบุรี",
      to: "central",
      qty: "2",
      receive: "confirm",
    });
    expect(last(d).values.receive).toBeUndefined();
    expect(line(d, fridge)).toMatchObject({
      at: { central: 0, ศาลาแดง: 0, มีนบุรี: 3 },
      inTransit: 0,
    });
    // The Owner and the Account Manager edit and delete one; it holds nothing the Manager may not see.
    expect(visibleNotes(d, manager).map((e) => e.id)).toContain(last(d).id);
    expect(line(edit(d, last(d).id, { qty: "3" }), fridge).at.central).toBe(1);
    const gone = mutate(d, manager, "void", { targetId: last(d).id }, "", day);
    expect(line(gone, fridge).at).toMatchObject({ central: -2, มีนบุรี: 5 });
  });

  it("a material's count takes in the transfers before it, and later ones move it", () => {
    const count = (d: Database, n: string, date: string) =>
      mutate(d, saladaeng, "materials", { "count.m1": n }, "", date);
    // The material's name: its SKU.
    let d = buy(seed, { item: "กล่องพิมพ์ลาย", qty: "100" });
    expect(last(d).values.sku).toBe("SKU-0001");
    d = count(d, "10", "2026-09-01");
    d = send(
      d,
      { item: "กล่องพิมพ์ลาย", to: "ศาลาแดง", qty: "40" },
      "2026-09-02",
    );
    const m1 = (x: Database) => branchMaterial(x, "ศาลาแดง", "m1", day);
    expect(m1(d).qty).toBe(50);
    d = count(d, "45", "2026-09-03");
    expect(m1(d)).toMatchObject({
      qty: 45,
      variance: { expected: 50, counted: 45, diff: -5 },
    });
    d = send(
      d,
      { item: "กล่องพิมพ์ลาย", from: "ศาลาแดง", to: "central", qty: "5" },
      "2026-09-04",
    );
    d = buy(
      d,
      { item: "กล่องพิมพ์ลาย", qty: "20", warehouse: "ศาลาแดง" },
      "2026-09-05",
    );
    // Sent with "confirm": not in the branch until it says so.
    d = send(
      d,
      { item: "กล่องพิมพ์ลาย", to: "ศาลาแดง", qty: "7", receive: "confirm" },
      "2026-09-05",
    );
    expect(m1(d).qty).toBe(60);
    expect(line(d, "SKU-0001")).toMatchObject({
      materialId: "m1",
      at: { central: 58, ศาลาแดง: 60, มีนบุรี: 0 },
      inTransit: 7,
    });
    expect(branchMaterial(d, "มีนบุรี", "m1", day).qty).toBe(0);
  });

  it("mutate refuses a place or an item that is not there, the same place twice, and the wrong account", () => {
    const d = buy(seed, { item: "ตู้เย็น", qty: "3" });
    const refused: [Values, string][] = [
      [{ item: "โต๊ะ", to: "มีนบุรี" }, "ไม่พบรายการนี้"],
      [
        { item: "ตู้เย็น", from: "ลาดพร้าว", to: "มีนบุรี" },
        "ไม่พบคลังต้นทางที่เลือก",
      ],
      [{ item: "ตู้เย็น", to: "ลาดพร้าว" }, "ไม่พบคลังปลายทางที่เลือก"],
      [
        { item: "ตู้เย็น", to: "central" },
        "คลังต้นทางและปลายทางเป็นที่เดียวกันไม่ได้",
      ],
      [{ item: "ตู้เย็น", to: "มีนบุรี", qty: "x" }, "จำนวน"],
    ];
    for (const [values, message] of refused)
      expect(() => send(d, values), JSON.stringify(values)).toThrow(message);
    expect(() =>
      mutate(
        d,
        minburi,
        "transfer",
        { item: "ตู้เย็น", to: "มีนบุรี" },
        "",
        day,
      ),
    ).toThrow("บัญชีนี้ไม่มีสิทธิ์จดรายการนี้");
    // An empty core field is saved and listed, and moves nothing.
    const empty = mutate(d, owner, "transfer", {}, "", day);
    expect(last(empty).values.missing).toBe("item,from,to,qty");
    // Matched as a ledger item is: outer spaces and case aside.
    expect(
      last(send(d, { item: " ตู้เย็น ", to: "มีนบุรี" })).values,
    ).toMatchObject({ item: "ตู้เย็น", sku: fridge });
    // An edit that changes the item takes its SKU and name along; a rename does not stop one.
    let other = buy(d, { item: "เก้าอี้", qty: "1" });
    other = send(other, { item: "ตู้เย็น", to: "มีนบุรี", qty: "1" });
    const moved = last(other).id;
    other = edit(other, moved, { item: "เก้าอี้" });
    expect(entries(other, "transfer")[0].values).toMatchObject({
      item: "เก้าอี้",
      itemName: "เก้าอี้",
      sku: "SKU-0012",
    });
    other = mutate(
      other,
      owner,
      "config",
      { skuNames: JSON.stringify([{ sku: "SKU-0012", name: "เก้าอี้พับ" }]) },
      "",
      day,
    );
    other = edit(other, moved, { qty: "2" });
    expect(entries(other, "transfer")[0].values).toMatchObject({
      itemName: "เก้าอี้พับ",
      sku: "SKU-0012",
      qty: "2",
    });
    expect(() => edit(other, moved, { item: "ไม่มี" })).toThrow(
      "ไม่พบรายการนี้",
    );
    expect(stockLines(empty, day)).toEqual(stockLines(d, day));
    // One that came in at once has nothing to confirm; nor has one that is not there.
    const now = send(d, { item: "ตู้เย็น", to: "มีนบุรี", qty: "1" });
    for (const transferId of [last(now).id, "nope", ""])
      expect(() => receive(now, minburi, transferId)).toThrow(
        "ไม่พบรายการจัดสรรที่รอสาขานี้ยืนยันรับ",
      );
  });

  it("a branch's copy works out its own stock and names what it was sent", () => {
    let d = buy(seed, { item: "ตู้เย็น", qty: "3", amount: "9000" });
    d = buy(d, {
      item: "เก้าอี้",
      qty: "4",
      warehouse: "มีนบุรี",
      amount: "800",
    });
    d = send(d, { item: "ตู้เย็น", to: "มีนบุรี", qty: "1" });
    d = send(d, {
      item: "ตู้เย็น",
      to: "มีนบุรี",
      qty: "2",
      receive: "confirm",
    });
    d = send(d, { item: "ตู้เย็น", to: "ศาลาแดง", qty: "1" });
    const copy = scopeDatabase(d, ["มีนบุรี"]);
    expect(JSON.stringify(copy)).not.toMatch(/9000|800|ศาลาแดง/);
    const own = (x: Database) =>
      stockLines(x, day)
        .filter((row) => !row.materialId)
        .map((row) => [row.name, row.at["มีนบุรี"], row.inTransit]);
    expect(own(copy)).toEqual([
      ["เก้าอี้", 4, 0],
      ["ตู้เย็น", 1, 2],
    ]);
    expect(own(d).sort()).toEqual(own(copy).sort());
    expect(pendingTransfers(copy, "มีนบุรี")).toHaveLength(1);
    // Its receipt is checked on its copy.
    const got = receive(copy, minburi, pendingTransfers(copy, "มีนบุรี")[0].id);
    expect(line(got, fridge).at["มีนบุรี"]).toBe(3);
  });
});
