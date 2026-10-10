import { describe, expect, it } from "vitest";
import {
  advances,
  boxCost,
  cashBetween,
  branchItem,
  entries,
  giftBoxes,
  kindsForPage,
  legacySale,
  ledgerRows,
  ledgerSummary,
  projectAssets,
  receivables,
  shopProject,
  liveEntries,
  lotInfo,
  materialList,
  meatStock,
  monthPl,
  payCategories,
  plBetween,
  mutate,
  netSalesByBranch,
  pendingTransfers,
  poInfo,
  productCosts,
  pieceUnit,
  products,
  purchaseLots,
  rawRiceBranches,
  saleDue,
  saleMoney,
  salePreview,
  salesChannels,
  seed,
  sheetNote,
  shipments,
  sheetItems,
  skuCatalogue,
  skuFor,
  stockLines,
  supplierBalances,
  todoOpens,
  todos,
  visibleEntries,
  visibleNotes,
  wasteWeek,
  type Actor,
  type Database,
  type Entry,
  type NoteKind,
  type Values,
} from "@/lib/store";
import { defaults, fields } from "@/lib/forms";
import { navFor } from "@/lib/nav";
import { scopeDatabase } from "@/lib/role-scope";
import { sampleData } from "@/lib/store/demo";
import { outflows } from "@/lib/store/derived";

// Smoke checks of the domain on the approved sample. The figures do not depend on the date.
const day = "2026-09-09";
const db = sampleData(day);
const owner: Actor = { role: "owner" };
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
      "ยอด: ใส่เป็นตัวเลข 0 ขึ้นไป",
    );
    expect(() =>
      pay(owner, { category: "other", amount: "5" }, "2999-01-01"),
    ).toThrow("วันที่อยู่ในอนาคต เลือกวันนี้หรือวันก่อนหน้า");
    const forbidden = "บัญชีนี้ไม่มีสิทธิ์จดรายการนี้";
    expect(() =>
      mutate(db, owner, "sale", { branch: "ศาลาแดง", boxes: "1" }, "", day),
    ).toThrow(forbidden);
    expect(() => pay(saladaeng, { category: "meat", amount: "1" })).toThrow(
      forbidden,
    );
    expect(() => mutate(db, owner, "closeDay", {}, "", day)).toThrow(
      "รายการชนิดนี้เลิกใช้แล้ว",
    );
    // V2-RUL-01: what is not a plain number, and a day that is not on the calendar.
    for (const amount of ["abc", "1e3", "0x10", "1,000"])
      expect(() => pay(owner, { category: "other", amount })).toThrow(
        "ใส่เป็นตัวเลข 0 ขึ้นไป",
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
    // V2-ACC-02: the Owner pays payroll.
    expect(
      jot(owner, "pay", { category: "payroll", amount: "1", employee: "x" })
        .values,
    ).toMatchObject({ category: "payroll", employee: "x" });
    // V2-ACC-03, 04: a branch's kinds are the branch's alone, the Owner jots none for it.
    for (const [kind, values] of [
      ["sale", { boxes: "1", lineMan: "350" }],
      ["receive", { kg: "1" }],
      ["influencerBox", { influencer: "x", boxes: "1" }],
      ["daily", { sheet: "meat", "used.meat": "1" }],
      ["opening", { sheet: "materials", "qty.m1": "1" }],
      ["stockItem", { name: "ช้อนพลาสติก", unit: "แพ็ค" }],
    ] as const) {
      expect(() => jot(owner, kind, { ...values, branch: "มีนบุรี" })).toThrow(
        forbidden,
      );
      expect(jot(minburi, kind, values)).toMatchObject({
        role: "branch",
        branch: "มีนบุรี",
      });
    }
    // The counts are retired: nobody jots one any more.
    for (const kind of ["meatCount", "materials"] as const)
      expect(() => mutate(db, minburi, kind, { kg: "1" }, "", day)).toThrow(
        "รายการชนิดนี้เลิกใช้แล้ว",
      );
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
    // Changes: a branch none of the centre's.
    const pays = entries(db, "pay");
    const payroll = pays.find((e) => e.values.category === "payroll")!;
    const transport = pays.find((e) => e.values.category === "transport")!;
    const edit = (by: Actor, targetId: string, values = '{"amount":"9"}') =>
      mutate(db, by, "entryEdit", { targetId, values }, "", day);
    expect(() => edit(saladaeng, transport.id)).toThrow(
      "แก้ไขได้เฉพาะรายการของบัญชีนี้",
    );
    expect(() =>
      mutate(db, saladaeng, "void", { targetId: transport.id }, "", day),
    ).toThrow("ลบได้เฉพาะรายการของบัญชีนี้");
    // No payment moves into or out of payroll.
    const capex = pays.find((e) => e.values.category === "capex")!;
    expect(() => edit(owner, capex.id, '{"category":"payroll"}')).toThrow(
      "แก้หมวดค่าแรงไม่ได้ ให้ลบแล้วจดใหม่",
    );
    expect(() => edit(owner, payroll.id, '{"category":"other"}')).toThrow(
      "แก้หมวดค่าแรงไม่ได้ ให้ลบแล้วจดใหม่",
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
        "daily",
        { sheet: "meat", "used.meat": "5", branch: "มีนบุรี" },
        "",
        day,
      ),
    );
    expect(own).toMatchObject({ role: "branch", branch: "ศาลาแดง" });
    expect(own.actor).toBeUndefined();
  });

  it("a payment with a quantity goes into the branch's stock", () => {
    const before = branchItem(db, "มีนบุรี", "m1", day);
    const paid = pay(owner, {
      category: "packaging",
      amount: "100",
      item: "m1",
      qty: "50",
      branch: "มีนบุรี",
    });
    expect(last(paid)).toMatchObject({ role: "owner", branch: "มีนบุรี" });
    expect(branchItem(paid, "มีนบุรี", "m1", day)).toMatchObject({
      opening: before.opening,
      autoReceived: 50,
      remaining: before.remaining + 50,
    });
    // Not a stock category: the item, the quantity and the branch are not saved.
    const other = last(
      pay(owner, { category: "other", amount: "1", item: "m1", qty: "5" }),
    );
    expect(other.branch).toBe("");
    expect(other.values.qty).toBeUndefined();
  });

  it("edits, deletes and undoes", () => {
    // The sample's sale with no money typed: the edit fills it and clears `missing`.
    const sale = visibleNotes(db, owner).find(
      (e) => e.kind === "sale" && e.values.missing,
    )!;
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

    // A daily sheet deleted gives back what it used; put back, it takes it again.
    const meat = (d: Database) => branchItem(d, "ศาลาแดง", "meat", day).opening;
    const before = meat(db);
    const count = sheetNote(db, "daily", "ศาลาแดง", "meat", "2026-09-08")!;
    const deleted = mutate(
      db,
      saladaeng,
      "void",
      { targetId: count.id },
      "",
      day,
    );
    expect(meat(deleted)).toBeCloseTo(
      before + Number(count.values["used.meat"]),
      10,
    );
    const back = mutate(
      deleted,
      saladaeng,
      "void",
      { targetId: last(deleted).id },
      "",
      day,
    );
    expect(meat(back)).toBe(before);
    // Another branch's entry.
    expect(() =>
      mutate(db, minburi, "void", { targetId: count.id }, "", day),
    ).toThrow();
    // A branch's note is the branch's to change: the Owner neither edits nor deletes it, nor
    // undoes a change of it.
    const branchOnly = "บันทึกนี้เป็นของสาขา ให้สาขาเป็นคนแก้";
    expect(() =>
      mutate(
        db,
        owner,
        "entryEdit",
        { targetId: count.id, values: '{"used.meat":"1"}' },
        "",
        day,
      ),
    ).toThrow(branchOnly);
    expect(() =>
      mutate(db, owner, "void", { targetId: count.id }, "", day),
    ).toThrow(branchOnly);
    // The branch's delete of the sheet: not the Owner's to undo.
    expect(() =>
      mutate(deleted, owner, "void", { targetId: last(deleted).id }, "", day),
    ).toThrow(branchOnly);
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
    // The key of the old books' money is no channel's.
    expect(() =>
      channels({ key: legacySale.key, name: "Grab", gp: "0" }),
    ).toThrow("ช่องทางขาย: อ่านรายการไม่ได้");
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
      "SO-2026-0002 รอบ TR-2026-0002: ยังไม่ได้จด น้ำหนักหลังรมควัน",
      "รอรับ Waste PO-2026-0002 15 กก.",
    ]),
  );
  // V2-PAY-04: the sample's rent is dated the month before.
  expect(texts(owner)).toContain("ค่าเช่า/น้ำไฟ ของกันยายน 2569");
  const branch = texts(saladaeng);
  expect(branch).toContain("ยอดขาย วันนี้");
  expect(branch.join()).not.toMatch(/SO-|PO-|มีนบุรี|ศาลาแดง|ค่าเช่า/);
  // มีนบุรี: no note today, and closed two days before (no note at all): no sale is due. Its
  // sheet of the day before has a waste with no reason. A sheet not saved today is no line.
  expect(texts(minburi)).toEqual(["ใบสต๊อกรายวัน 8 ก.ย.: ยังไม่ได้จด 1 ช่อง"]);
  expect(texts(owner).join()).not.toMatch(/มีนบุรี: ยอดขาย|ยังไม่ได้บันทึก/);
  // A sale is due only for a day the branch jotted something else on: nothing jotted in the
  // last 7 days is nothing to do, and the Owner's own notes are no trace of a branch.
  const sales = (from: Database, by: Actor = saladaeng) =>
    todos(from, by, day)
      .map((todo) => todo.text)
      .filter((text) => /ยอดขาย/.test(text));
  expect(todos(seed, saladaeng, day)).toEqual([]);
  const paid = mutate(
    seed,
    owner,
    "pay",
    { category: "ingredient", amount: "100", branch: "ศาลาแดง" },
    "",
    day,
  );
  expect(sales(paid, owner)).toEqual([]);
  // The day's sheet saved is a trace: that day's sale is due, for the branch and the Owner,
  // and for no other day or branch.
  const open = mutate(
    seed,
    saladaeng,
    "daily",
    { sheet: "meat", reporter: "ฝน" },
    "",
    "2026-09-07",
  );
  expect(saleDue(open, "ศาลาแดง", "2026-09-07")).toBe(true);
  expect(saleDue(open, "ศาลาแดง", day)).toBe(false);
  expect(saleDue(open, "มีนบุรี", "2026-09-07")).toBe(false);
  expect(sales(open)).toEqual(["ยอดขาย 7 ก.ย."]);
  expect(sales(open, owner)).toEqual(["ศาลาแดง: ยอดขาย 7 ก.ย."]);
  expect(sales(open, minburi)).toEqual([]);
  // The sale jotted, or the trace deleted, takes the line away.
  const sold = mutate(
    open,
    saladaeng,
    "sale",
    { boxes: "20" },
    "",
    "2026-09-07",
  );
  expect(saleDue(sold, "ศาลาแดง", "2026-09-07")).toBe(false);
  expect(sales(sold)).toEqual(["ยอดขาย 7 ก.ย.: ยังไม่ได้จด 1 ช่อง"]);
  const closed = mutate(
    open,
    saladaeng,
    "void",
    { targetId: last(open).id },
    "",
    day,
  );
  expect(saleDue(closed, "ศาลาแดง", "2026-09-07")).toBe(false);
  // The delete is dated today and is no note of today.
  expect(todos(closed, saladaeng, day)).toEqual([]);
  // A sheet with something not jotted opens its page for the branch, nothing for the Owner.
  expect(
    todos(db, minburi, day).find((todo) =>
      todo.text.startsWith("ใบสต๊อกรายวัน 8 ก.ย."),
    ),
  ).toMatchObject({ page: "meatStock" });
  expect(branch.some((text) => text.endsWith("ยังไม่ได้จด 1 ช่อง"))).toBe(true);
  // A branch's line opens its form; for the Owner the same line is a status and opens nothing.
  const line = (by: Actor, text: string) =>
    todos(db, by, day).find((todo) => todo.text === text)!;
  expect(line(saladaeng, "ยอดขาย วันนี้")).toMatchObject({
    kind: "sale",
    date: day,
  });
  expect(todoOpens(line(owner, "ศาลาแดง: ยอดขาย วันนี้"))).toBe(false);
  expect(
    todos(db, owner, day)
      .filter((todo) => todo.text.endsWith("ยังไม่ได้จด 1 ช่อง"))
      .some(todoOpens),
  ).toBe(false);
});

it("kindsForPage: the jot buttons of each page, per account", () => {
  // A branch: its Stock and its Inventory, with `pay` on both (it has no Finance), and its
  // Sales, the Owner's of which offers nothing.
  expect(kindsForPage(saladaeng, "meatStock")).toEqual(["receive", "pay"]);
  expect(kindsForPage(saladaeng, "sales")).toEqual(["sale", "influencerBox"]);
  expect(kindsForPage(owner, "sales")).toEqual([]);
  expect(navFor(saladaeng)).toEqual(["meatStock", "stock", "sales", "log"]);
  expect(navFor(owner)).not.toContain("sales");
  // The receipt of a transfer is on no page's buttons; nor are the daily sheet, the opening
  // stock and a list item, which the sheet on the page saves.
  expect(kindsForPage(saladaeng, "stock")).toEqual(["pay"]);
  expect(kindsForPage(owner, "meatStock")).toEqual([]);
  // Inventory: stock moves between the warehouses.
  expect(kindsForPage(owner, "stock")).toEqual(["transfer"]);
  expect(kindsForPage(owner, "finance")).toEqual([
    "pay",
    "reimburse",
    "income",
  ]);
  expect(kindsForPage(owner, "accounting")).toEqual(["expense", "income"]);
  expect(kindsForPage(owner, "lots")).toHaveLength(11);
  // Daily Log is for looking: no account jots from it.
  for (const by of [owner, saladaeng])
    expect(kindsForPage(by, "log")).toEqual([]);
});

it("edit, undo, delete and put back: one kind of each group", () => {
  const cases: [NoteKind, string, string, Actor][] = [
    ["smoked", "smokedKg", "100", owner], // Lot
    ["pay", "amount", "999", owner], // เงิน
    ["cmReceive", "receivedKg", "198", owner], // จดเพิ่มได้
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
      "รายการนี้ย้อนกลับไม่ได้ ให้แก้ไขหรือลบใหม่แทน",
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
  ).toThrow("บันทึกนี้เป็นของสาขา ให้สาขาเป็นคนแก้");
  changed = mutate(changed, owner, "void", { targetId: payroll.id }, "", day);
  changed = mutate(changed, owner, "void", { targetId: transport.id }, "", day);
  const transportVoid = last(changed).id;
  const ids = (by: Actor) => visibleEntries(changed, by).map((e) => e.id);

  expect(visibleEntries(changed, owner)).toBe(changed.entries);
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
  // What the Owner paid for the branch (stock only) is not in the branch's log.
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
  jot(saladaeng, "opening", "2026-09-08", {
    sheet: "meat",
    "qty.meat": "8",
    "qty.chili": "50",
  });
  jot(saladaeng, "receive", "2026-09-09", { kg: "5" });
  jot(saladaeng, "opening", "2026-09-09", {
    sheet: "materials",
    "qty.m1": "50",
    "qty.m2": "20",
  });
  const sale = jot(saladaeng, "sale", "2026-09-10", {
    boxes: "10",
    lineMan: "1000",
    "sales.grab": "500",
    expense: "100",
    payer: "น้องฝน",
  });
  const sheet10 = jot(saladaeng, "daily", "2026-09-10", {
    sheet: "meat",
    "used.meat": "1.5",
    "waste.meat": "0.3",
    "reason.meat": "ตกพื้น",
    "used.chili": "4",
    reporter: "ฝน",
  });
  jot(saladaeng, "daily", "2026-09-10", {
    sheet: "materials",
    "used.m1": "10",
    "received.m2": "5",
    "used.m2": "3",
    reporter: "ฝน",
  });
  jot(saladaeng, "sale", "2026-09-11", { boxes: "5" });
  const sheet11 = jot(saladaeng, "daily", "2026-09-11", {
    sheet: "meat",
    "used.meat": "1",
    "used.chili": "2",
    "waste.chili": "2",
    reporter: "ฝน",
  });
  const gift = jot(saladaeng, "influencerBox", "2026-09-12", {
    influencer: "@x",
    boxes: "2",
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
  /** `from` with `chiliAddons` laid on the notes of `tubes` (by entry id) by hand: the forms
   *  had a field for tubes sold apart once, and the notes saved then still hold it. */
  const withTubes = (from: Database, tubes: Record<string, string>) => ({
    ...from,
    entries: from.entries.map((e) =>
      tubes[e.id]
        ? { ...e, values: { ...e.values, chiliAddons: tubes[e.id] } }
        : e,
    ),
  });
  const built = withTubes(d, { [sale.id]: "4", [gift.id]: "3" });

  it("CAL-01: GP is each channel's sales × its GP %", () => {
    expect(saleMoney(built.config, sale)).toEqual({ sales: 1500, gp: 250 });
  });

  it("CAL-01: money from the old books counts in the sales with no GP, with or without a branch", () => {
    // Nobody jots one (the form has no such field): laid in as the import does.
    const old = (id: string, branch: string, money: string): Entry => ({
      id,
      at: "2026-08-01T10:00:00.000Z",
      kind: "sale",
      role: "branch",
      lotId: "",
      branch,
      date: "2026-08-01",
      values: { boxes: "2", [legacySale.key]: money },
    });
    const none = old("old-none", "", "900");
    const own = old("old-own", "ศาลาแดง", "100");
    const withOld = { ...built, entries: [...built.entries, none, own] };
    expect(saleMoney(built.config, none)).toEqual({ sales: 900, gp: 0 });
    expect(monthPl(withOld, "2026-08")).toMatchObject({
      sales: 1000,
      gp: 0,
      boxes: 4,
      byBranch: { "": 900, ศาลาแดง: 100 },
      byChannel: { [legacySale.key]: 1000 },
    });
    // After GP per branch: the old money whole, a channel's sale less its GP.
    expect(netSalesByBranch(withOld, "2026-08", "2026-08~")).toEqual({
      "": 900,
      ศาลาแดง: 100,
    });
    expect(netSalesByBranch(built, sale.date, sale.date)).toEqual({
      [sale.branch]: 1250,
    });
    // The form's `sales.legacy` is dropped from a new note; a branch's edit keeps the money
    // and does not list the channel's as missing.
    const jotted = mutate(
      built,
      saladaeng,
      "sale",
      { boxes: "1", [legacySale.key]: "5" },
      "",
      "2026-08-02",
    );
    expect(last(jotted).values[legacySale.key]).toBeUndefined();
    const edited = mutate(
      withOld,
      saladaeng,
      "entryEdit",
      { targetId: own.id, values: JSON.stringify({ boxes: "3" }) },
      "",
      "2026-08-02",
    );
    expect(
      entries(edited, "sale").find((e) => e.id === own.id)?.values,
    ).toMatchObject({
      boxes: "3",
      [legacySale.key]: "100",
    });
    expect(last(edited).values["to.missing"]).toBeUndefined();
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
      salesReceived: 0,
      otherReceived: 0,
      received: 0,
      net: -28150,
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
      net: -28300,
    });
    // The P&L counted the expense when she paid: it does not move.
    expect(monthPl(repaid, "2026-09")).toEqual(monthPl(built, "2026-09"));
    expect(cashBetween(repaid, "2026-08", "2026-08~").repaid).toBe(0);
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

  const item = (id: string, date: string, from = built) =>
    branchItem(from, "ศาลาแดง", id, date);

  it("CAL-10: remaining = opening + auto received + typed received − used, and waste is part of used", () => {
    // Before any opening an item starts from 0; a receipt comes in by itself.
    expect(item("meat", "2026-09-07")).toEqual({
      opening: 0,
      autoReceived: 10,
      received: 0,
      used: 0,
      waste: 0,
      reason: "",
      remaining: 10,
      saved: false,
      sold: 0,
      set: true,
    });
    // The opening of the 8th sets 8 (whatever was there), the 9th takes in 5.
    expect(item("meat", "2026-09-09")).toMatchObject({
      opening: 8,
      autoReceived: 5,
      remaining: 13,
    });
    // 13 − 1.5 used: the 0.3 wasted is in the 1.5, not taken off again.
    expect(item("meat", "2026-09-10")).toEqual({
      opening: 13,
      autoReceived: 0,
      received: 0,
      used: 1.5,
      waste: 0.3,
      reason: "ตกพื้น",
      remaining: 11.5,
      saved: true,
      sold: 0,
      set: true,
    });
    // The next day opens with what the day before left.
    expect(item("meat", "2026-09-11")).toMatchObject({
      opening: 11.5,
      used: 1,
      remaining: 10.5,
    });
    expect(item("meat", "2026-09-13")).toMatchObject({
      opening: 10.5,
      remaining: 10.5,
      saved: false,
    });
    // Typed on the sheet: 20 + 5 received − 3 used.
    expect(item("m2", "2026-09-10")).toMatchObject({
      opening: 20,
      received: 5,
      used: 3,
      remaining: 22,
      saved: true,
    });
    expect(branchItem(built, "มีนบุรี", "meat", "2026-09-13")).toMatchObject({
      opening: 0,
      remaining: 0,
      saved: false,
    });
  });

  it("CAL-10: a payment with a quantity comes in by itself, the Owner's and the branch's own", () => {
    // 50 − 10 used, then the 100 the Owner bought for the branch on the 12th.
    expect(item("m1", "2026-09-12")).toMatchObject({
      opening: 40,
      autoReceived: 100,
      remaining: 140,
      saved: false,
    });
    expect(item("m1", "2026-09-13").opening).toBe(140);
    // 50 − 4 − 2 used and the 4 + 3 tubes sold and given beside the boxes, then the 10 tubes
    // the branch bought on the 13th.
    expect(item("chili", "2026-09-13")).toMatchObject({
      opening: 37,
      autoReceived: 10,
      remaining: 47,
    });
    expect(branchItem(built, "มีนบุรี", "m1", "2026-09-13").remaining).toBe(0);
  });

  /** `from` with the old 「สูตรต่อกล่อง」 stored and no 「รายการสินค้า」 saved yet: [item id,
   *  quantity a box] rows. Nothing writes the key any more, so it is laid in by hand. */
  const withRecipe = (
    from: Database,
    ...rows: [string, string][]
  ): Database => ({
    ...from,
    config: {
      ...from.config,
      boxRecipe: JSON.stringify(rows.map(([id, qty]) => ({ id, qty }))),
    },
  });
  type Row = {
    id: string;
    name: string;
    unit?: string;
    items?: [string, string][];
  };
  /** `from` with 「รายการสินค้า」 saved: each product with its [item id, quantity] components. */
  const withProducts = (from: Database, rows: Row[], money?: Values[]) =>
    mutate(
      from,
      owner,
      "config",
      {
        products: JSON.stringify(
          rows.map(({ items = [], ...row }) => ({
            ...row,
            items: items.map(([id, qty]) => ({ id, qty })),
          })),
        ),
        ...(money && { productMoney: JSON.stringify(money) }),
      },
      "",
      day,
    );
  const box: Row = { id: "box", name: "กล่องมาตรฐาน" };

  it("CAL-10: with no product list saved it is the standard box alone, which takes nothing; tubes of an old note are taken all the same", () => {
    expect(products(built.config)).toEqual([
      { ...box, unit: "กล่อง", items: new Map() },
    ]);
    const jotted = (
      [
        ["sale", { boxes: "30", chiliAddons: "9", lineMan: "1" }],
        ["influencerBox", { influencer: "@y", boxes: "8", chiliAddons: "8" }],
      ] as const
    ).reduce(
      (next, [kind, values]) =>
        mutate(next, saladaeng, kind, values, "", "2026-09-12"),
      built,
    );
    // The forms have no such field any more: a new note saves no tubes.
    const [a, b] = jotted.entries.slice(-2);
    expect([a.values.chiliAddons, b.values.chiliAddons]).toEqual([
      undefined,
      undefined,
    ]);
    const more = withTubes(jotted, { [a.id]: "9", [b.id]: "8" });
    for (const id of ["meat", "m1", "m2"]) {
      expect(item(id, "2026-09-12", more).sold).toBe(0);
      expect(item(id, "2026-09-13", more)).toEqual(item(id, "2026-09-13"));
    }
    // The 3 tubes of the gift box already there, then 9 + 8.
    expect(item("chili", "2026-09-12", more).sold).toBe(20);
    expect(item("chili", "2026-09-13", more).opening).toBe(20);
    // An edit of such a note keeps its tubes.
    const edited = mutate(
      more,
      saladaeng,
      "entryEdit",
      { targetId: a.id, boxes: "31", lineMan: "1" },
      "",
      "2026-09-12",
    );
    expect(item("chili", "2026-09-12", edited).sold).toBe(20);
    // A row at 0 or left empty is not in the recipe.
    const none = withRecipe(built, ["m1", "0"], ["meat", ""]);
    expect(item("m1", "2026-09-10", none).sold).toBe(0);
    expect(item("meat", "2026-09-10", none).sold).toBe(0);
    // The sale form no longer asks for what the sheet holds.
    expect(fields("sale", built, saladaeng).map((f) => f.key)).toEqual([
      "boxes",
      "lineMan",
      "sales.grab",
      "expense",
      "payer",
      "attachment",
      "note",
    ]);
  });

  it("a product is counted in the unit the Owner typed, กล่อง for the standard box and ชิ้น for another with none; the sale form's field says it", () => {
    const set = withProducts(built, [
      box,
      { id: "pack", name: "น้ำพริกแพ็กคู่" },
      { id: "tube", name: "น้ำพริกหลอด", unit: " หลอด " },
    ]);
    expect(products(set.config).map((p) => p.unit)).toEqual([
      "กล่อง",
      "ชิ้น",
      "หลอด",
    ]);
    expect(
      fields("sale", set, saladaeng)
        .slice(0, 3)
        .map((f) => [f.key, f.unit]),
    ).toEqual([
      ["boxes", "กล่อง"],
      ["product.pack", "ชิ้น"],
      ["product.tube", "หลอด"],
    ]);
    // The box's unit is the Owner's too, and one product alone names every total.
    const tubes = withProducts(built, [{ ...box, unit: "หลอด" }]);
    expect(fields("sale", tubes, saladaeng)[0].unit).toBe("หลอด");
    expect(pieceUnit(products(tubes.config))).toBe("หลอด");
    expect(pieceUnit(products(set.config))).toBe("ชิ้น");
  });

  it("BR-13: the sale form's preview says what the typed products take of each item and what is left; an edited sale is not counted twice; a sale lacks its products only when none has a count", () => {
    const set = withProducts(built, [
      {
        ...box,
        items: [
          ["m1", "2"],
          ["meat", "120"],
          ["chili", "1"],
        ],
      },
      { id: "pack", name: "น้ำพริกแพ็กคู่", items: [["chili", "2"]] },
    ]);
    const preview = (values: Values, date: string, saved?: Entry) =>
      salePreview(set, "ศาลาแดง", values, date, saved);
    const left = (id: string, date: string) => item(id, date, set).remaining;
    // Nothing typed, or a product with no component: no line.
    expect(preview({}, "2026-09-13")).toEqual([]);
    expect(salePreview(built, "ศาลาแดง", { boxes: "5" }, "2026-09-13")).toEqual(
      [],
    );
    // 5 boxes and 3 packs: 5 × 120 g, 5 + 3 × 2 tubes, 5 × 2 of the material; sheet order.
    const lines = preview({ boxes: "5", "product.pack": "3" }, "2026-09-13");
    expect(lines.map((l) => [l.id, l.unit, l.take])).toEqual([
      ["meat", "กก.", 0.6],
      ["chili", "หลอด", 11],
      ["m1", lines[2].unit, 10],
    ]);
    for (const l of lines)
      expect(l.left).toBeCloseTo(left(l.id, "2026-09-13") - l.take);
    // More than the branch holds is told, below zero.
    expect(preview({ boxes: "1000" }, "2026-09-13")[2].left).toBeLessThan(0);
    // The sale of the 10th, opened to edit: the stock already counts its 10 boxes.
    const sold = entries(set, "sale", undefined, "ศาลาแดง").find(
      (e) => e.date === "2026-09-10",
    )!;
    expect(sold.values.boxes).toBe("10");
    const m1 = (values: Values, date: string) =>
      preview(values, date, sold).find((l) => l.id === "m1")!.left;
    expect(m1(sold.values, "2026-09-10")).toBe(left("m1", "2026-09-10"));
    expect(m1({ boxes: "12" }, "2026-09-10")).toBe(
      left("m1", "2026-09-10") - 4,
    );
    // Moved to the day before, where the stock does not count it yet.
    expect(m1({ boxes: "12" }, "2026-09-09")).toBe(
      left("m1", "2026-09-09") - 24,
    );
    // The packs alone: no product is missing. No count at all: the first product is.
    const missing = (values: Values) =>
      mutate(set, saladaeng, "sale", values, "", day).entries.at(-1)!.values
        .missing;
    expect(missing({ "product.pack": "3", lineMan: "1" })).toBeUndefined();
    expect(missing({ lineMan: "1" })).toBe("boxes");
    // A gift box still asks for the first product.
    expect(
      mutate(
        set,
        saladaeng,
        "influencerBox",
        { influencer: "@a", "product.pack": "1" },
        "",
        day,
      ).entries.at(-1)!.values.missing,
    ).toBe("boxes");
  });

  it("CAL-10: the old box recipe stands as the box's components until a product list is saved: a sale and a gift box take boxes × it, beside what the sheet says was used, and the next day opens without it", () => {
    const set = withRecipe(
      built,
      ["m1", "2"],
      ["meat", "120"],
      ["rice", "80"],
      ["chili", "1"],
    );
    // 10 boxes on the 10th: 50 − 10 used − 20 sold.
    expect(item("m1", "2026-09-10", set)).toMatchObject({
      opening: 50,
      used: 10,
      sold: 20,
      remaining: 20,
    });
    // The 11th has a sale (5 boxes) and no materials sheet: it counts all the same.
    expect(item("m1", "2026-09-11", set)).toMatchObject({
      opening: 20,
      sold: 10,
      remaining: 10,
      saved: false,
    });
    // A gift box takes as a sale does: 2 boxes, beside the 100 bought that day.
    expect(item("m1", "2026-09-12", set)).toMatchObject({
      opening: 10,
      autoReceived: 100,
      sold: 4,
      remaining: 106,
    });
    expect(item("m1", "2026-09-13", set).opening).toBe(106);
    // Meat and raw rice are typed in grams a box and taken in kg: 10 × 120 g, 10 × 80 g.
    expect(item("meat", "2026-09-10", set)).toMatchObject({
      opening: 13,
      used: 1.5,
      sold: 1.2,
    });
    expect(item("meat", "2026-09-10", set).remaining).toBeCloseTo(10.3);
    expect(item("rice", "2026-09-10", set).sold).toBe(0.8);
    // Chili: a tube a box, and the tubes sold beside them: 10 + 4, then 2 + 3.
    expect(item("chili", "2026-09-10", set).sold).toBe(14);
    expect(item("chili", "2026-09-12", set).sold).toBe(5);
    // 50 − (4 + 14) − (2 + 5) − 5.
    expect(item("chili", "2026-09-13", set).opening).toBe(20);
    // The same components saved as the box of 「รายการสินค้า」 give the same sheet.
    const saved = withProducts(built, [
      {
        ...box,
        items: [
          ["m1", "2"],
          ["meat", "120"],
          ["rice", "80"],
          ["chili", "1"],
        ],
      },
    ]);
    for (const id of ["m1", "meat", "rice", "chili"])
      for (const date of ["2026-09-10", "2026-09-12", "2026-09-13"])
        expect(item(id, date, saved)).toEqual(item(id, date, set));
    // A branch's copy holds the recipe: its sheet reads as the Owner's.
    expect(item("m1", "2026-09-10", scopeDatabase(set, ["ศาลาแดง"])).sold).toBe(
      20,
    );
    // An item out of the recipe is not taken.
    expect(item("m2", "2026-09-10", set).sold).toBe(0);
    // The other branch sold nothing.
    expect(branchItem(set, "มีนบุรี", "m1", "2026-09-13")).toMatchObject({
      sold: 0,
      remaining: 0,
    });
  });

  const tube: Row = { id: "p1", name: "น้ำพริกหลอด", items: [["chili", "1"]] };
  const two = withProducts(
    built,
    [
      {
        ...box,
        name: "กล่องใหญ่",
        items: [
          ["meat", "200"],
          ["chili", "1"],
          ["m1", "1"],
        ],
      },
      { ...tube, items: [...tube.items!, ["m2", "0.5"]] },
    ],
    [
      { id: "box", price: "400", cost: "30" },
      { id: "p1", price: "30", cost: "12" },
    ],
  );

  it("CAL-10: each product has its own count field, and takes stock by its own components", () => {
    expect(fields("sale", two, saladaeng).map((f) => [f.key, f.label])).toEqual(
      expect.arrayContaining([
        ["boxes", "กล่องใหญ่"],
        ["product.p1", "น้ำพริกหลอด"],
      ]),
    );
    // Only the first product's field is core, on the gift form as well.
    expect(
      fields("influencerBox", two, saladaeng)
        .filter((f) => f.core)
        .map((f) => f.key),
    ).toEqual(["influencer", "boxes"]);
    const sold = mutate(
      two,
      saladaeng,
      "sale",
      { boxes: "3", "product.p1": "5", lineMan: "1" },
      "",
      "2026-09-14",
    );
    const on = (id: string) => item(id, "2026-09-14", sold).sold;
    // 3 boxes of 200 g; a tube a box and a tube a tube; a box each; half a bag a tube.
    expect(on("meat")).toBeCloseTo(0.6);
    expect(on("chili")).toBe(8);
    expect(on("m1")).toBe(3);
    expect(on("m2")).toBe(2.5);
    // Pieces sold count every product.
    expect(plBetween(sold, "2026-09-14", "2026-09-14").boxes).toBe(8);
    // A product removed: what the notes hold of it is counted nowhere.
    const removed = withProducts(sold, [box]);
    expect(plBetween(removed, "2026-09-14", "2026-09-14").boxes).toBe(3);
    expect(item("chili", "2026-09-14", removed).sold).toBe(0);
  });

  it("CAL-06: a product costs its meat at the newest PO รมควัน's cost per kg plus its own other cost", () => {
    // Nothing saved: the box at the old settings, 0.12 kg (packKg) × 1,200 + ฿25, sold at ฿350.
    expect(productCosts(built)).toEqual([
      {
        id: "box",
        name: "กล่องมาตรฐาน",
        price: 350,
        meat: 144,
        other: 25,
        total: 169,
        lotId: lot,
      },
    ]);
    // Components with no meat among them: the box still falls back to packKg.
    expect(
      productCosts(withProducts(built, [{ ...box, items: [["m1", "1"]] }]))[0],
    ).toMatchObject({ meat: 144, other: 25, total: 169 });
    // Its own meat (200 g) and its own money; a product with no meat costs its other cost.
    expect(productCosts(two)).toMatchObject([
      { id: "box", price: 400, meat: 240, other: 30, total: 270 },
      { id: "p1", price: 30, meat: 0, other: 12, total: 12, lotId: null },
    ]);
    // The Lots page's cost per box and boxCost stay about the box.
    expect(lotInfo(two, lot)).toMatchObject({
      meatPerBox: 240,
      costPerBox: 270,
    });
    expect(boxCost(two)).toMatchObject({ meat: 240, pack: 30, total: 270 });
    // A price or a cost left empty is not set: no price, and no other cost.
    const bare = withProducts(
      two,
      [box, tube],
      [{ id: "p1", price: "", cost: "" }],
    );
    expect(productCosts(bare)[1]).toMatchObject({
      price: null,
      other: 0,
      total: 0,
    });
    // With no PO รมควัน to cost the meat from, a product with meat has no cost.
    const none = withProducts(seed, [box, tube]);
    expect(productCosts(none)).toMatchObject([
      { id: "box", meat: null, total: null },
      { id: "p1", meat: 0, total: 0 },
    ]);
  });

  it("CAL-14: the gift value is each product given away at its own cost", () => {
    const given = mutate(
      two,
      saladaeng,
      "influencerBox",
      { influencer: "@y", boxes: "1", "product.p1": "4" },
      "",
      "2026-09-14",
    );
    // The 2 boxes already given and this one at ฿270, the 4 tubes at ฿12.
    expect(giftBoxes(given, "2026-09")).toEqual({ boxes: 7, value: 858 });
    expect(giftBoxes(seed, "2026-09")).toEqual({ boxes: 0, value: null });
  });

  it("Settings refuses a product list no form or figure could read", () => {
    const refused = (rows: Row[], message: string, money?: Values[]) =>
      expect(() => withProducts(built, rows, money)).toThrow(
        `รายการสินค้า: ${message}`,
      );
    // The standard box is never removed.
    refused([tube], "อ่านรายการไม่ได้");
    refused([box, tube, tube], "อ่านรายการไม่ได้");
    refused(
      [
        {
          ...box,
          items: [
            ["m1", "1"],
            ["m1", "2"],
          ],
        },
      ],
      "อ่านรายการไม่ได้",
    );
    refused([box, { ...tube, name: " " }], "มีสินค้าที่ยังไม่ได้ใส่ชื่อ");
    refused(
      [
        { ...box, name: "Box" },
        { ...tube, name: "box " },
      ],
      "ชื่อ「box」ซ้ำกัน",
    );
    for (const qty of ["-1", "สอง"])
      refused(
        [{ ...box, items: [["m1", qty]] }],
        "จำนวนส่วนประกอบของ「กล่องมาตรฐาน」ใส่เป็นตัวเลข 0 ขึ้นไป",
      );
    for (const price of ["-1", "x"])
      refused([box], "ราคาและต้นทุนใส่เป็นตัวเลข 0 ขึ้นไป", [
        { id: "box", price, cost: "" },
      ]);
    refused([box], "อ่านรายการไม่ได้", [
      { id: "box", price: "1", cost: "" },
      { id: "box", price: "2", cost: "" },
    ]);
    // A branch may not save one.
    expect(() =>
      mutate(built, saladaeng, "config", { products: "[]" }, "", day),
    ).toThrow();
  });

  it("a branch's copy holds the products and never their prices or costs", () => {
    const scoped = scopeDatabase(two, ["ศาลาแดง"]);
    expect(scoped.config.products).toBe(two.config.products);
    expect(scoped.config.productMoney).toBeUndefined();
    expect(JSON.stringify(scoped.config)).not.toContain("price");
    expect(item("m1", "2026-09-10", scoped).sold).toBe(10);
  });

  it("CAL-10: an edited sale takes what it now says, a deleted one nothing", () => {
    const set = withRecipe(built, ["m1", "2"]);
    const edited = mutate(
      set,
      saladaeng,
      "entryEdit",
      { targetId: sale.id, values: JSON.stringify({ boxes: "20" }) },
      "",
      day,
    );
    expect(item("m1", "2026-09-10", edited)).toMatchObject({
      sold: 40,
      remaining: 0,
    });
    const gone = mutate(set, saladaeng, "void", { targetId: sale.id }, "", day);
    expect(item("m1", "2026-09-10", gone)).toMatchObject({
      sold: 0,
      remaining: 40,
    });
    expect(item("m1", "2026-09-11", gone).opening).toBe(40);
  });

  it("CAL-10: an item is set once an opening is typed for it or anything moved it", () => {
    // No opening of the materials sheet names m3, and nothing moved it.
    expect(item("m3", "2026-09-13")).toMatchObject({
      set: false,
      remaining: 0,
    });
    expect(branchItem(built, "มีนบุรี", "m1", "2026-09-13").set).toBe(false);
    // Before the receipt of the 7th the meat was not there either.
    expect(item("meat", "2026-09-06").set).toBe(false);
    expect(item("meat", "2026-09-07").set).toBe(true);
    // m1: nothing by the 8th, its opening on the 9th.
    expect(item("m1", "2026-09-08").set).toBe(false);
    expect(item("m1", "2026-09-09").set).toBe(true);
    // An opening typed at 0 sets it; used up, it stays set (หมด, not ยังไม่ตั้งยอด).
    const zero = mutate(
      built,
      saladaeng,
      "entryEdit",
      {
        targetId: entries(built, "opening", undefined, "ศาลาแดง").at(-1)!.id,
        values: JSON.stringify({ "qty.m3": "0" }),
      },
      "",
      day,
    );
    expect(item("m3", "2026-09-13", zero)).toMatchObject({
      set: true,
      remaining: 0,
    });
    // A box sold moved it.
    expect(
      item("m3", "2026-09-13", withRecipe(built, ["m3", "1"])),
    ).toMatchObject({ set: true, remaining: -17 });
  });

  it("CAL-10: saving a day again changes that day, it does not take stock twice", () => {
    // The sheet finds the day's note and edits it.
    expect(sheetNote(built, "daily", "ศาลาแดง", "meat", "2026-09-10")?.id).toBe(
      sheet10.id,
    );
    expect(
      sheetNote(built, "daily", "ศาลาแดง", "materials", "2026-09-11"),
    ).toBeUndefined();
    expect(
      sheetNote(built, "daily", "มีนบุรี", "meat", "2026-09-10"),
    ).toBeUndefined();
    const again = mutate(
      built,
      saladaeng,
      "entryEdit",
      { targetId: sheet10.id, values: JSON.stringify({ "used.meat": "2" }) },
      "",
      "2026-09-10",
    );
    expect(item("meat", "2026-09-10", again)).toMatchObject({
      used: 2,
      waste: 0.3,
      remaining: 11,
    });
    expect(item("meat", "2026-09-11", again).opening).toBe(11);
    // The change stays in the log, and its undo puts the day back.
    expect(last(again)).toMatchObject({
      kind: "entryEdit",
      values: { "from.used.meat": "1.5", "to.used.meat": "2" },
    });
    const undone = mutate(
      again,
      saladaeng,
      "void",
      { targetId: last(again).id },
      "",
      "2026-09-10",
    );
    expect(item("meat", "2026-09-10", undone).remaining).toBe(11.5);
    // A second note of the same day is not refused: the later one is the day's.
    const twice = mutate(
      built,
      saladaeng,
      "daily",
      { sheet: "meat", "used.meat": "3", reporter: "ฝน" },
      "",
      "2026-09-10",
    );
    expect(item("meat", "2026-09-10", twice)).toMatchObject({
      used: 3,
      waste: 0,
      remaining: 10,
    });
    expect(sheetNote(twice, "daily", "ศาลาแดง", "meat", "2026-09-10")?.id).toBe(
      last(twice).id,
    );
  });

  it("CAL-10: an opening sets the balance before its day's sheet, a later one sets it again, and each is in the log", () => {
    const set = (from: Database, date: string, qty: string) =>
      mutate(
        from,
        saladaeng,
        "opening",
        { sheet: "meat", "qty.meat": qty },
        "",
        date,
      );
    // Jotted after the day's sheet, it still applies first: 20 − 1.5.
    const same = set(built, "2026-09-10", "20");
    expect(item("meat", "2026-09-10", same)).toMatchObject({
      opening: 20,
      used: 1.5,
      remaining: 18.5,
    });
    expect(item("meat", "2026-09-11", same).opening).toBe(18.5);
    // A row it leaves empty is not set.
    expect(item("chili", "2026-09-10", same).opening).toBe(50);
    // A later one resets the balance from its date; the days before read as they did.
    const later = set(same, "2026-09-12", "4");
    expect(item("meat", "2026-09-11", later).remaining).toBe(17.5);
    expect(item("meat", "2026-09-12", later)).toMatchObject({
      opening: 4,
      remaining: 4,
    });
    // The branch changes its opening: an edit, kept in the log.
    const opened = sheetNote(same, "opening", "ศาลาแดง", "meat", "2026-09-10")!;
    const changed = mutate(
      same,
      saladaeng,
      "entryEdit",
      { targetId: opened.id, values: JSON.stringify({ "qty.meat": "25" }) },
      "",
      "2026-09-10",
    );
    expect(item("meat", "2026-09-10", changed).opening).toBe(25);
    expect(last(changed).values).toMatchObject({
      targetKind: "opening",
      "from.qty.meat": "20",
      "to.qty.meat": "25",
    });
    // The Owner sees it and changes none of it.
    expect(visibleNotes(changed, owner).map((e) => e.id)).toContain(opened.id);
    expect(() =>
      mutate(
        same,
        owner,
        "entryEdit",
        { targetId: opened.id, values: '{"qty.meat":"1"}' },
        "",
        "2026-09-10",
      ),
    ).toThrow("บันทึกนี้เป็นของสาขา ให้สาขาเป็นคนแก้");
    expect(() =>
      mutate(built, saladaeng, "opening", { "qty.meat": "1" }, "", day),
    ).toThrow("เลือกใบสต๊อก");
  });

  it("RUL-05: a sheet refuses nothing: a waste with no reason and an empty reporter are listed as missing, and remaining may go below zero", () => {
    expect(sheet10.values.missing).toBeUndefined();
    expect(sheet11.values.missing).toBe("reason.chili");
    const bare = mutate(
      built,
      saladaeng,
      "daily",
      { sheet: "meat", "used.meat": "99", "waste.meat": "0" },
      "",
      "2026-09-13",
    );
    expect(last(bare).values.missing).toBe("reporter");
    expect(item("meat", "2026-09-13", bare).remaining).toBe(-88.5);
    expect(() =>
      mutate(built, saladaeng, "daily", { "used.meat": "1" }, "", day),
    ).toThrow("เลือกใบสต๊อก");
    expect(() =>
      mutate(
        built,
        saladaeng,
        "daily",
        { sheet: "meat", "used.meat": "-1" },
        "",
        day,
      ),
    ).toThrow("ใส่เป็นตัวเลข 0 ขึ้นไป");
  });

  it("the Overview's waste: a branch's 7 days, per item with dates and reasons, and the days with a saved sheet", () => {
    expect(wasteWeek(built, "ศาลาแดง", "2026-09-13")).toEqual({
      saved: { meat: 2, materials: 1 },
      items: [
        {
          id: "meat",
          sku: "",
          name: "เนื้อ",
          unit: "กก.",
          total: 0.3,
          days: [{ date: "2026-09-10", waste: 0.3, reason: "ตกพื้น" }],
        },
        {
          id: "chili",
          sku: "",
          name: "น้ำพริก",
          unit: "หลอด",
          total: 2,
          days: [{ date: "2026-09-11", waste: 2, reason: "" }],
        },
      ],
    });
    // The 7 days end on the date: the 10th and 11th are out of the week of the 18th.
    expect(wasteWeek(built, "ศาลาแดง", "2026-09-18")).toEqual({
      saved: { meat: 0, materials: 0 },
      items: [],
    });
    expect(wasteWeek(built, "มีนบุรี", "2026-09-13").items).toEqual([]);
    // A material's waste, newest day first.
    const more = (
      [
        ["2026-09-12", "4", "เปียกน้ำ"],
        ["2026-09-13", "1", "ขาด"],
      ] as const
    ).reduce(
      (next, [date, waste, reason]) =>
        mutate(
          next,
          saladaeng,
          "daily",
          { sheet: "materials", "waste.m4": waste, "reason.m4": reason },
          "",
          date,
        ),
      built,
    );
    expect(wasteWeek(more, "ศาลาแดง", "2026-09-13")).toMatchObject({
      saved: { meat: 2, materials: 3 },
      items: [
        {},
        {},
        {
          id: "m4",
          name: "ถุงกระดาษ",
          unit: "ถุง",
          total: 5,
          days: [
            { date: "2026-09-13", waste: 1, reason: "ขาด" },
            { date: "2026-09-12", waste: 4, reason: "เปียกน้ำ" },
          ],
        },
      ],
    });
  });

  it("BR-08: only a branch that uses raw rice has it on its sheet, and only the Owner says which", () => {
    const saved = (d: Database, by: Actor) =>
      last(
        mutate(
          d,
          by,
          "daily",
          { sheet: "meat", "used.rice": "3", "used.meat": "1" },
          "",
          day,
        ),
      ).values;
    expect(rawRiceBranches(seed.config)).toEqual(["ศาลาแดง"]);
    expect(sheetItems(seed, "meat", "ศาลาแดง").map((row) => row.id)).toEqual([
      "meat",
      "rice",
      "chili",
    ]);
    expect(sheetItems(seed, "meat", "มีนบุรี").map((row) => row.id)).toEqual([
      "meat",
      "chili",
    ]);
    // Any other reader (the Owner looking at a branch's sheet) gets the row.
    expect(sheetItems(seed, "meat")).toHaveLength(3);
    expect(sheetItems(seed, "materials")).toEqual(materialList(seed));
    expect(saved(seed, saladaeng)["used.rice"]).toBe("3");
    // มีนบุรี buys its rice cooked: the row is not on its sheet, so it is not saved.
    expect(saved(seed, minburi)["used.rice"]).toBeUndefined();
    const set = (by: Actor, value: string) =>
      mutate(seed, by, "config", { rawRiceBranches: value }, "", day);
    const both = set(owner, '["ศาลาแดง","มีนบุรี"]');
    expect(saved(both, minburi)["used.rice"]).toBe("3");
    expect(saved(set(owner, "[]"), saladaeng)["used.rice"]).toBeUndefined();
    for (const bad of [
      '["เชียงใหม่"]',
      '["มีนบุรี","มีนบุรี"]',
      "มีนบุรี",
      '"x"',
    ])
      expect(() => set(owner, bad)).toThrow("สาขาที่ใช้ข้าวเหนียวดิบ");
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
  const jot = (d: Database, item: string, by: Actor = owner) =>
    mutate(d, by, "expense", { item, amount: "10" }, "", day);
  const sku = (d: Database) => last(d).values.sku;
  const config = (d: Database, input: Values, by: Actor = owner) =>
    mutate(d, by, "config", input, "", day);
  const edit = (d: Database, id: string, values: Values) =>
    mutate(
      d,
      owner,
      "entryEdit",
      { targetId: id, values: JSON.stringify(values) },
      "",
      day,
    );
  const skuOf = (d: Database, id: string) =>
    entries(d, "expense").find((e) => e.id === id)!.values.sku;
  const name = (d: Database, code: string) =>
    skuCatalogue(d).find((item) => item.sku === code)?.name;

  it("the seed's materials are SKU-0001 to SKU-0023, each with its unit, and a new ledger item is the next", () => {
    expect(materialList(seed).map((m) => m.sku)).toEqual(
      Array.from(
        { length: 23 },
        (_, i) => `SKU-${String(i + 1).padStart(4, "0")}`,
      ),
    );
    expect(materialList(seed)[0]).toEqual({
      id: "m1",
      sku: "SKU-0001",
      name: "กล่องบรรจุ",
      unit: "กล่อง",
    });
    expect(materialList(seed).at(-1)).toMatchObject({
      name: "ถุงหิ้วพลาสติกใส 12x20",
      unit: "ห่อ",
    });
    let d = jot(seed, "กระดาษ A4");
    expect(sku(d)).toBe("SKU-0024");
    d = jot(d, "ปากกา", owner);
    expect(sku(d)).toBe("SKU-0025");
    // The same name, trimmed, any case: the same item.
    d = jot(d, "  กระดาษ a4 ");
    expect(sku(d)).toBe("SKU-0024");
    expect(skuFor(d, "ยางลบ")).toEqual({ sku: "SKU-0026", isNew: true });
    expect(skuFor(d, " ")).toEqual({ sku: "", isNew: false });
  });

  it("an expense named as a material carries the material's SKU and moves no stock", () => {
    const before = branchItem(seed, "ศาลาแดง", "m3", day);
    const d = mutate(
      seed,
      owner,
      "expense",
      { item: " ซองข้าวเหนียว", qty: "500", amount: "900" },
      "",
      day,
    );
    expect(sku(d)).toBe("SKU-0003");
    expect(skuFor(d, "ซองข้าวเหนียว")).toEqual({
      sku: "SKU-0003",
      isNew: false,
    });
    expect(branchItem(d, "ศาลาแดง", "m3", day)).toEqual(before);
    // The form offers every item, the materials included, each under its SKU.
    expect(
      fields("expense", d, owner).find((f) => f.key === "item")!.options,
    ).toContainEqual({ value: "ซองข้าวเหนียว", label: "SKU-0003" });
  });

  it("never gives a number twice: not a deleted entry's, an edited-away one's or a removed material's", () => {
    let d = jot(seed, "กระดาษ A4");
    d = jot(d, "ปากกา");
    d = mutate(d, owner, "void", { targetId: last(d).id }, "", day);
    d = jot(d, "ยางลบ");
    expect(sku(d)).toBe("SKU-0026");
    // The deleted item is no longer in the catalogue: its name is a new item.
    expect(skuFor(d, "ปากกา")).toEqual({ sku: "SKU-0027", isNew: true });
    const id = last(d).id;
    // An edit that keeps the name keeps the SKU; a new name gets a new one; a name that
    // exists gets that item's.
    d = edit(d, id, { item: "ยางลบ", qty: "2" });
    expect(skuOf(d, id)).toBe("SKU-0026");
    d = edit(d, id, { item: "คลิปหนีบ" });
    expect(skuOf(d, id)).toBe("SKU-0027");
    d = edit(d, id, { item: "กระดาษ a4" });
    expect(skuOf(d, id)).toBe("SKU-0024");
    expect(skuFor(d, "ลวดเย็บ").sku).toBe("SKU-0028");
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
    expect(materialList(d).slice(-3)).toMatchObject([
      { id: "m23", sku: "SKU-0023" },
      { id: "mx", sku: "SKU-0028" },
      { id: "my", sku: "SKU-0029" },
    ]);
    d = config(d, { materialList: JSON.stringify(rows) });
    expect(jot(d, "ลวดเย็บ").entries.at(-1)!.values.sku).toBe("SKU-0030");
  });

  it("a rename keeps the SKU: a material in its list, a ledger item in skuNames", () => {
    let d = jot(seed, "กระดาษ A4");
    const id = last(d).id;
    const rows: Values[] = JSON.parse(d.config.materialList);
    d = config(d, {
      materialList: JSON.stringify(
        rows.map((row) =>
          row.id === "m3" ? { ...row, name: "ซองข้าว", sku: "" } : row,
        ),
      ),
    });
    expect(materialList(d)[2]).toMatchObject({
      id: "m3",
      sku: "SKU-0003",
      name: "ซองข้าว",
    });
    d = config(d, {
      skuNames: JSON.stringify([{ sku: "SKU-0024", name: " A4 80 แกรม " }]),
    });
    expect(name(d, "SKU-0024")).toBe("A4 80 แกรม");
    // The old row shows the new name; its entry keeps what was typed.
    expect(ledgerRows(d).find((row) => row.id === id)).toMatchObject({
      item: "A4 80 แกรม",
      sku: "SKU-0024",
    });
    // The new name is that item; the old name is now a new one.
    expect(sku(jot(d, "a4 80 แกรม"))).toBe("SKU-0024");
    expect(sku(jot(d, "กระดาษ A4"))).toBe("SKU-0025");
    // An edit that leaves the item as typed keeps its SKU.
    expect(skuOf(edit(d, id, { qty: "3" }), id)).toBe("SKU-0024");
  });

  it("refuses a name used twice in the catalogue, an empty one, and a rename by anyone but the Owner", () => {
    const d = jot(jot(seed, "กระดาษ A4"), "ปากกา");
    const rename = (to: string, by?: Actor) =>
      config(
        d,
        { skuNames: JSON.stringify([{ sku: "SKU-0024", name: to }]) },
        by,
      );
    expect(() => rename("ปากกา")).toThrow("ซ้ำกัน");
    // A material's name is taken too, in any case.
    expect(() => rename("ซองข้าวเหนียว")).toThrow("ซ้ำกัน");
    expect(() => rename(" ")).toThrow("ยังไม่ได้ใส่ชื่อ");
    expect(() => config(d, { skuNames: "x" })).toThrow("อ่านรายการไม่ได้");
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
    expect(materialList(old)[0].sku).toBe("");
    const saved = config(old, { materialList: old.config.materialList });
    expect(materialList(saved)[0].sku).toBe("SKU-0001");
  });

  it("is jotted by the Owner only", () => {
    expect(() => jot(seed, "กระดาษ", saladaeng)).toThrow();
  });

  it("a branch adds a row to the material list, with its unit and the next SKU, and renames one", () => {
    const item = (d: Database, by: Actor, values: Values) =>
      mutate(d, by, "stockItem", values, "", day);
    const added = item(seed, saladaeng, {
      name: " ช้อนพลาสติก ",
      unit: "แพ็ค",
    });
    const row = materialList(added).at(-1)!;
    expect(row).toEqual({
      id: last(added).values.id,
      sku: "SKU-0024",
      name: "ช้อนพลาสติก",
      unit: "แพ็ค",
    });
    expect(row.id).toBeTruthy();
    expect(materialList(added)).toHaveLength(24);
    // One sequence with the ledger items, and the row is a line of the stock and of a sheet.
    expect(sku(jot(added, "กระดาษ A4"))).toBe("SKU-0025");
    expect(stockLines(added, day).at(-1)).toMatchObject({
      sku: "SKU-0024",
      materialId: row.id,
    });
    expect(fields("daily", added, minburi).map((f) => f.key)).toContain(
      `used.${row.id}`,
    );
    // The other branch renames it and changes its unit: the list is one for both.
    const renamed = item(added, minburi, {
      id: row.id,
      name: "ช้อน",
      unit: "กล่อง",
    });
    expect(materialList(renamed).at(-1)).toEqual({
      ...row,
      name: "ช้อน",
      unit: "กล่อง",
    });
    expect(materialList(renamed)).toHaveLength(24);
    // A seeded row too; a unit left empty stays as it was.
    const first = item(renamed, saladaeng, { id: "m1", name: "กล่องอาหาร" });
    expect(materialList(first)[0]).toEqual({
      id: "m1",
      sku: "SKU-0001",
      name: "กล่องอาหาร",
      unit: "กล่อง",
    });
    // Refused as a Settings row is: no name, a name twice, a row that is not there.
    expect(() => item(added, minburi, { name: " " })).toThrow(
      "รายชื่อวัสดุ: มีแถวที่ยังไม่ได้ใส่ชื่อ",
    );
    expect(() => item(added, minburi, { name: "ช้อนพลาสติก" })).toThrow(
      "รายชื่อวัสดุ: ชื่อ「ช้อนพลาสติก」ซ้ำกัน",
    );
    expect(() => item(added, minburi, { id: "m1", name: "ซองเนื้อ" })).toThrow(
      "ซ้ำกัน",
    );
    expect(() =>
      item(jot(added, "กระดาษ A4"), minburi, { name: "กระดาษ a4" }),
    ).toThrow("ซ้ำกัน");
    expect(() => item(added, minburi, { id: "nope", name: "x" })).toThrow(
      "ไม่พบรายการนี้ในรายชื่อวัสดุ",
    );
    expect(() => item(seed, owner, { name: "x" })).toThrow(
      "บัญชีนี้ไม่มีสิทธิ์จดรายการนี้",
    );
    // Its own branch deletes the note: the row is gone, its number is not given again.
    const gone = mutate(
      added,
      saladaeng,
      "void",
      { targetId: last(added).id },
      "",
      day,
    );
    expect(materialList(gone)).toHaveLength(23);
    expect(last(item(gone, saladaeng, { name: "ตะเกียบ" })).values.sku).toBe(
      "SKU-0025",
    );
  });

  it("a Settings save is the material list from then on, and later rows of a branch go on top of it", () => {
    const item = (d: Database, by: Actor, values: Values) =>
      mutate(d, by, "stockItem", values, "", day);
    let d = item(seed, saladaeng, { name: "ช้อน", unit: "แพ็ค" });
    const id = last(d).values.id;
    d = item(d, minburi, { id: "m2", name: "ซองเนื้อใหญ่" });
    // The Owner saves the list it sees, less a row, with the branch's row renamed.
    d = config(d, {
      materialList: JSON.stringify(
        materialList(d)
          .filter((m) => m.id !== "m3")
          .map((m) => (m.id === id ? { ...m, name: "ช้อนส้อม" } : m)),
      ),
    });
    expect(materialList(d)).toHaveLength(23);
    expect(materialList(d).map((m) => m.id)).not.toContain("m3");
    expect(materialList(d).find((m) => m.id === id)).toEqual({
      id,
      sku: "SKU-0024",
      name: "ช้อนส้อม",
      unit: "แพ็ค",
    });
    expect(materialList(d)[1].name).toBe("ซองเนื้อใหญ่");
    // A row jotted after the save applies again.
    d = item(d, minburi, { id, name: "ช้อนไม้" });
    d = item(d, minburi, { name: "หลอด", unit: "ห่อ" });
    expect(materialList(d).slice(-2)).toMatchObject([
      { id, name: "ช้อนไม้", sku: "SKU-0024" },
      { name: "หลอด", unit: "ห่อ", sku: "SKU-0025" },
    ]);
    // A branch's copy holds the same list.
    expect(materialList(scopeDatabase(d, ["ศาลาแดง"]))).toEqual(
      materialList(d),
    );
  });

  it("a branch's copy never issues a SKU the Owner's ledger already gave", () => {
    // SKU-0024 is a ledger item of the office's, which no branch receives.
    const d = jot(seed, "กระดาษ A4");
    const copy = scopeDatabase(d, ["มีนบุรี"]);
    expect(JSON.stringify(copy.entries)).not.toContain("SKU-0024");
    expect(
      last(mutate(copy, minburi, "stockItem", { name: "หลอด" }, "", day)).values
        .sku,
    ).toBe("SKU-0025");
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

describe("ledger: Finance rows (V2-LED-18)", () => {
  const finance = (d: Database) =>
    ledgerRows(d).filter((row) => row.origin === "finance");
  /** What the PO rows and the Finance rows say was paid, against the money out. */
  const paid = (d: Database) =>
    ledgerRows(d)
      .filter((row) => row.origin !== "manual")
      .reduce((a, row) => a + row.paid!, 0);
  const out = (d: Database) => outflows(d).reduce((a, o) => a + o.amount, 0);
  const pay = (d: Database, values: Record<string, string>, by = owner) =>
    mutate(d, by, "pay", values, "", day);

  it("puts every money-out line on a row, none of it twice", () => {
    expect(finance(db).length).toBeGreaterThan(0);
    expect(paid(db)).toBe(out(db));
    expect(
      finance(db).every((row) => !row.entry && row.status === "paid"),
    ).toBe(true);
    // Only a row of a `pay` note carries it (its attached file).
    expect(finance(db).some((row) => row.payNote)).toBe(true);
    expect(
      finance(db).every((row) => (row.payNote?.kind ?? "pay") === "pay"),
    ).toBe(true);
    // A branch's payment and a gift box's shipping fee are the shop project's.
    const d = mutate(
      pay(db, { category: "other", amount: "40" }, saladaeng),
      saladaeng,
      "influencerBox",
      { influencer: "ช่อง ก", boxes: "1", shippingFee: "60" },
      "",
      day,
    );
    expect(paid(d)).toBe(out(d));
    expect(finance(d).slice(0, 2)).toMatchObject([
      { item: "ค่าส่งกล่องแจก", itemType: "การตลาด", paid: 60 },
      { itemType: "อื่นๆ", paid: 40, purpose: "project", detail: "ศาลาแดง" },
    ]);
  });

  it("fills the supplier's POs first: only what they did not take is a row", () => {
    let d = mutate(
      seed,
      owner,
      "purchase",
      { supplier: "Foodiva", orderedKg: "10", price: "100" },
      "",
      day,
    );
    d = pay(d, { category: "meat", amount: "600", supplier: "Foodiva" });
    expect(finance(d)).toEqual([]);
    d = pay(d, { category: "meat", amount: "700", supplier: "Foodiva" });
    // A supplier with no PO, and no supplier at all: the whole payment.
    d = pay(d, { category: "meat", amount: "50", supplier: "ร้านอื่น" });
    d = pay(d, { category: "rent", amount: "20", detail: "ค่าไฟ" });
    expect(ledgerRows(d).find((row) => row.source === "po")).toMatchObject({
      paid: 1000,
      status: "paid",
    });
    expect(finance(d)).toMatchObject([
      { paid: 20, item: "ค่าเช่า/น้ำไฟ", detail: "ค่าไฟ", purpose: "project" },
      { paid: 50, vendor: "ร้านอื่น", detail: "" },
      { paid: 300, vendor: "Foodiva", itemType: "เนื้อ" },
    ]);
    expect(finance(d)[2].detail).toContain("700");
    expect(paid(d)).toBe(out(d));
    expect(ledgerSummary(ledgerRows(d), day.slice(0, 7))).toEqual({
      reserved: 0,
      waiting: 0,
      paid: 1370,
      paidBefore: 0,
      received: 0,
      receivedBefore: 0,
      pendingIn: { count: 0, amount: 0 },
    });
  });

  it("names the type after the pay category", () => {
    const custom = { id: "consult", name: "ค่าที่ปรึกษา" };
    const d0 = {
      ...seed,
      config: {
        ...seed.config,
        payCategories: JSON.stringify([...payCategories(seed.config), custom]),
      },
    };
    const types = Object.fromEntries(
      payCategories(d0.config).map((c) => [
        c.id,
        finance(pay(d0, { category: c.id, amount: "1" }))[0].itemType,
      ]),
    );
    expect(types).toEqual({
      meat: "เนื้อ",
      smoke: "ค่ารม",
      packaging: "วัสดุบรรจุภัณฑ์",
      ingredient: "วัตถุดิบ",
      payroll: "ค่าแรง",
      rent: "ค่าเช่า/น้ำไฟ",
      transport: "ขนส่ง",
      marketing: "การตลาด",
      capex: "สินทรัพย์",
      other: "อื่นๆ",
      consult: "ค่าที่ปรึกษา",
    });
    // The hand-jotted form suggests them; it does not offer the PO source.
    const form = fields("expense", seed, owner);
    expect(
      form.find((f) => f.key === "itemType")!.options!.map((o) => o.value),
    ).toEqual(expect.arrayContaining(["อื่นๆ", "ค่าแรง", "การตลาด"]));
    expect(
      form.find((f) => f.key === "source")!.options!.map((o) => o.value),
    ).toEqual(["advance", "transfer", "credit"]);
  });

  it("reads the pay note's source, เงินโอน when it has none, always the project's", () => {
    // The pay form offers the expense form's sources, starts at เงินโอน, and none is fine.
    const source = (kind: "pay" | "expense") =>
      fields(kind, seed, owner).find((f) => f.key === "source");
    expect(source("pay")).toEqual(source("expense"));
    expect(defaults("pay")).toEqual({ source: "transfer" });
    let d = pay(seed, { category: "rent", amount: "1", source: "credit" });
    expect(d.entries.at(-1)!.values.missing).toBeUndefined();
    d = pay(
      d,
      { category: "other", amount: "2", source: "advance" },
      saladaeng,
    );
    d = pay(d, { category: "rent", amount: "3" });
    expect(d.entries.at(-1)!.values).toMatchObject({ source: "" });
    expect(d.entries.at(-1)!.values.missing).toBeUndefined();
    d = mutate(d, saladaeng, "sale", { boxes: "1", expense: "4" }, "", day);
    expect(
      finance(d).map((row) => [row.paid, row.source, row.sourceLabel]),
    ).toEqual([
      [4, "transfer", "เงินโอน"],
      [3, "transfer", "เงินโอน"],
      [2, "advance", "พนักงานสำรองจ่าย"],
      [1, "credit", "บัตรเครดิต"],
    ]);
    expect(
      finance(d).every(
        (row) =>
          row.purpose === "project" && row.project === "Nerdnuea x LINE MAN",
      ),
    ).toBe(true);
    expect(() => pay(seed, { category: "rent", source: "po" })).toThrow();
  });

  it("stays out of Inventory", () => {
    const d = pay(seed, {
      category: "packaging",
      amount: "500",
      item: "m1",
      qty: "10",
      branch: "ศาลาแดง",
    });
    expect(finance(d)).toMatchObject([
      { item: "กล่องบรรจุ", qty: 10, project: "Nerdnuea x LINE MAN" },
    ]);
    expect(projectAssets(d)).toEqual([]);
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
      received: 0,
      receivedBefore: 0,
      pendingIn: { count: 0, amount: 0 },
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
      item: "กล่องบรรจุ",
      qty: "50",
      amount: "500",
    });
    d = buy(d, {
      itemType: "วัสดุบรรจุภัณฑ์",
      item: "กล่องบรรจุ",
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
    mutate(d, owner, "transfer", { from: "central", ...values }, "", date);
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
  // The first item bought on the seed: the materials hold SKU-0001 to SKU-0023.
  const fridge = "SKU-0024";

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
    expect(stockLines(seed, day)).toHaveLength(23);
    expect(line(seed, "SKU-0001")).toMatchObject({
      name: "กล่องบรรจุ",
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
      "บันทึกนี้เป็นของสาขา ให้สาขาเป็นคนแก้",
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
    // The Owner edits and deletes one.
    expect(line(edit(d, last(d).id, { qty: "3" }), fridge).at.central).toBe(1);
    const gone = mutate(d, owner, "void", { targetId: last(d).id }, "", day);
    expect(line(gone, fridge).at).toMatchObject({ central: -2, มีนบุรี: 5 });
  });

  it("a material's transfers come in by themselves on its sheet, a waiting one on the day the branch confirms", () => {
    const m1 = (x: Database, date = day) =>
      branchItem(x, "ศาลาแดง", "m1", date);
    // The material's name: its SKU.
    let d = buy(seed, { item: "กล่องบรรจุ", qty: "100" });
    expect(last(d).values.sku).toBe("SKU-0001");
    d = mutate(
      d,
      saladaeng,
      "opening",
      { sheet: "materials", "qty.m1": "10" },
      "",
      "2026-09-01",
    );
    d = send(d, { item: "กล่องบรรจุ", to: "ศาลาแดง", qty: "40" }, "2026-09-02");
    expect(m1(d, "2026-09-02")).toMatchObject({
      opening: 10,
      autoReceived: 40,
      remaining: 50,
    });
    d = mutate(
      d,
      saladaeng,
      "daily",
      { sheet: "materials", "used.m1": "5", reporter: "ฝน" },
      "",
      "2026-09-03",
    );
    expect(m1(d).remaining).toBe(45);
    // Sent back to the central warehouse: out of the branch that day.
    d = send(
      d,
      { item: "กล่องบรรจุ", from: "ศาลาแดง", to: "central", qty: "5" },
      "2026-09-04",
    );
    expect(m1(d, "2026-09-04")).toMatchObject({
      opening: 45,
      autoReceived: -5,
      remaining: 40,
    });
    d = buy(
      d,
      { item: "กล่องบรรจุ", qty: "20", warehouse: "ศาลาแดง" },
      "2026-09-05",
    );
    // Sent with "confirm": not in the branch until it says so.
    d = send(
      d,
      { item: "กล่องบรรจุ", to: "ศาลาแดง", qty: "7", receive: "confirm" },
      "2026-09-05",
    );
    expect(m1(d, "2026-09-05").autoReceived).toBe(20);
    expect(m1(d).remaining).toBe(60);
    expect(line(d, "SKU-0001")).toMatchObject({
      materialId: "m1",
      at: { central: 58, ศาลาแดง: 60, มีนบุรี: 0 },
      inTransit: 7,
    });
    // Confirmed (the receipt is dated the 4th): it comes in on the receipt's day.
    const got = receive(d, saladaeng, pendingTransfers(d, "ศาลาแดง")[0].id);
    expect(m1(got, "2026-09-04").autoReceived).toBe(2);
    expect(m1(got).remaining).toBe(67);
    expect(line(got, "SKU-0001")).toMatchObject({
      at: { ศาลาแดง: 67 },
      inTransit: 0,
    });
    expect(branchItem(d, "มีนบุรี", "m1", day).remaining).toBe(0);
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
      sku: "SKU-0025",
    });
    other = mutate(
      other,
      owner,
      "config",
      { skuNames: JSON.stringify([{ sku: "SKU-0025", name: "เก้าอี้พับ" }]) },
      "",
      day,
    );
    other = edit(other, moved, { qty: "2" });
    expect(entries(other, "transfer")[0].values).toMatchObject({
      itemName: "เก้าอี้พับ",
      sku: "SKU-0025",
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

describe("Old Lots", () => {
  it("is in the menu right after Finance, for the Owner only", () => {
    const nav = navFor(owner);
    expect(nav[nav.indexOf("finance") + 1]).toBe("oldLots");
    expect(navFor(saladaeng)).not.toContain("oldLots");
  });

  it("a note on an old PO leaves it old", () => {
    const po = purchaseLots(db)[0];
    const flagged: Database = {
      ...db,
      lots: db.lots.map((lot) =>
        lot.id === po.id ? { ...lot, old: true } : lot,
      ),
    };
    const target = entries(flagged, "purchase", po.id).at(-1)!;
    const next = mutate(
      flagged,
      owner,
      "entryEdit",
      { targetId: target.id, values: JSON.stringify({ note: "จากไฟล์เดิม" }) },
      "",
      day,
    );
    expect(next.lots.find((lot) => lot.id === po.id)).toMatchObject({
      old: true,
      values: { note: "จากไฟล์เดิม" },
    });
  });

  it("an old PO raises no to-do", () => {
    // A PO เนื้อ with no weight and no price, a PO รมควัน with no round.
    let d = mutate(seed, owner, "purchase", { supplier: "Foodiva" }, "", day);
    d = mutate(d, owner, "smokeOrder", { rawKg: "60" }, "", day);
    const about = (from: Database) =>
      todos(from, owner, day)
        .filter((todo) => todo.lotId || todo.editId)
        .map((todo) => todo.text);
    expect(about(d)).toEqual(
      expect.arrayContaining([
        `${shipments(d)[0].poId}: ยังไม่ได้จด ส่งไปรมควัน`,
        expect.stringMatching(/^PO เนื้อ .*: ยังไม่ได้จด 2 ช่อง$/),
      ]),
    );
    const flagged: Database = {
      ...d,
      lots: d.lots.map((lot) => ({ ...lot, old: true })),
    };
    expect(about(flagged)).toEqual([]);
    expect(todos(flagged, owner, day)).toHaveLength(
      todos(d, owner, day).length - about(d).length,
    );
  });

  it("an old lot holds no stock, and keeps its own figures", () => {
    // Twice the same: a PO เนื้อ of 100 kg, 60 sent, 30 back, 10 received by the branch.
    let d = seed;
    const jot = (
      by: Actor,
      kind: NoteKind,
      values: Record<string, string>,
      lotId = "",
    ) => {
      d = mutate(d, by, kind, values, lotId, day);
      return d.entries.at(-1)!.lotId;
    };
    const chain = () => {
      const po = jot(owner, "purchase", { orderedKg: "100", price: "500" });
      const lot = jot(owner, "smokeOrder", { rawKg: "60" });
      jot(owner, "dispatch", { dispatchKg: "60", poLotId: po }, lot);
      jot(owner, "smoked", { smokedKg: "30", boxes: "10" }, lot);
      jot(owner, "smokingInvoice", { netPayable: "6000" }, lot);
      jot(saladaeng, "receive", { kg: "10" }, lot);
      return [po, lot];
    };
    const old = chain();
    const [po, lot] = chain();
    const ids = (from: Database) => {
      const { held, central } = meatStock(from);
      return [
        ...held.map((row) => row.lot.id),
        ...central.map((i) => i.lot.id),
      ];
    };
    expect(ids(d)).toEqual([old[0], po, old[1], lot]);
    const meat = (from: Database) =>
      branchItem(from, "ศาลาแดง", "meat", day).remaining;
    expect(meat(d)).toBe(20);

    const flagged: Database = {
      ...d,
      lots: d.lots.map((each) =>
        old.includes(each.id) ? { ...each, old: true } : each,
      ),
    };
    // The Stock page: only the new PO เนื้อ (40 kg at the seller) and PO รมควัน (20 kg).
    const stock = meatStock(flagged);
    expect(stock.held.map((row) => [row.lot.id, row.kg])).toEqual([[po, 40]]);
    expect(stock.central.map((info) => [info.lot.id, info.centralKg])).toEqual([
      [lot, 20],
    ]);
    // A receipt of the old lot adds nothing to the branch; the scoped copy says the same.
    expect(meat(flagged)).toBe(10);
    expect(meat(scopeDatabase(flagged, ["ศาลาแดง"]))).toBe(10);
    // Old Lots, cost and money read the same figures as before.
    for (const id of old) {
      expect(poInfo(flagged, id)).toEqual(poInfo(d, id));
      expect(lotInfo(flagged, id)).toEqual({
        ...lotInfo(d, id),
        lot: flagged.lots.find((each) => each.id === id),
      });
    }
    expect(lotInfo(flagged, old[1])).toMatchObject({
      backKg: 30,
      centralKg: 20,
      costPerKg: 1200,
    });
    expect(poInfo(flagged, old[0]).heldKg).toBe(40);
    expect(boxCost(flagged)).toEqual(boxCost(d));
    expect(supplierBalances(flagged)).toEqual(supplierBalances(d));
    expect(monthPl(flagged, day.slice(0, 7))).toEqual(
      monthPl(d, day.slice(0, 7)),
    );
  });
});

describe("income (V2-PAY-09)", () => {
  const month = "2026-09";
  const span = [month, `${month}~`] as const;
  // LINE MAN takes 10%: of the ฿1,000 sold it owes ฿900.
  const sold = mutate(seed, saladaeng, "sale", { lineMan: "1000" }, "", day);
  const income = (values: Values, d = sold, date = day) =>
    mutate(d, owner, "income", values, "", date);
  const lineMan = (d: Database) =>
    receivables(d).channels.find((c) => c.key === "lineMan")!;

  it("is the Owner's: a branch may not jot it, and never receives it", () => {
    expect(() =>
      mutate(sold, saladaeng, "income", { amount: "1" }, "", day),
    ).toThrow("บัญชีนี้ไม่มีสิทธิ์จดรายการนี้");
    const d = income({ item: "ค่าสปอนเซอร์", amount: "500" });
    expect(scopeDatabase(d, ["ศาลาแดง"]).entries.map((e) => e.kind)).toEqual([
      "sale",
    ]);
  });

  it("other income raises the revenue and the profit, not the sales", () => {
    const before = monthPl(sold, month);
    const d = income({ item: "ค่าสปอนเซอร์", amount: "500" });
    expect(monthPl(d, month)).toEqual({
      ...before,
      otherIncome: 500,
      byIncome: { ค่าสปอนเซอร์: 500 },
      income: 1500,
      profit: before.profit + 500,
    });
    expect(cashBetween(d, ...span)).toMatchObject({
      salesReceived: 0,
      otherReceived: 500,
      received: 500,
      net: 500,
    });
  });

  it("a sales receipt is cash, not revenue again, and lowers what its channel owes", () => {
    expect(lineMan(sold)).toEqual({
      key: "lineMan",
      name: "LINE MAN",
      sold: 900,
      received: 0,
      left: 900,
      jotted: false,
    });
    const d = income({
      incomeType: "sales",
      channel: "lineMan",
      amount: "600",
    });
    // Its channel stands for the item: nothing is left to jot.
    expect(last(d).values.missing).toBeUndefined();
    expect(monthPl(d, month)).toEqual(monthPl(sold, month));
    expect(cashBetween(d, ...span)).toMatchObject({
      salesReceived: 600,
      otherReceived: 0,
      received: 600,
    });
    expect(lineMan(d)).toMatchObject({
      received: 600,
      left: 300,
      jotted: true,
    });
    expect(receivables(d).channels).toHaveLength(1);
    // One naming no channel has a row of its own.
    const loose = income({ incomeType: "sales", amount: "50" }, d);
    expect(last(loose).values.missing).toBe("item");
    expect(receivables(loose).channels[1]).toEqual({
      key: "",
      name: "ไม่ระบุช่องทาง",
      sold: 0,
      received: 50,
      left: -50,
      jotted: true,
    });
    // The old books' sales, already after GP, are what that row sold.
    const old = {
      ...loose,
      entries: [
        ...loose.entries,
        {
          ...loose.entries.find((e) => e.kind === "sale")!,
          id: "old",
          values: { "sales.legacy": "50" },
        },
      ],
    };
    expect(receivables(old).channels[1]).toMatchObject({ sold: 50, left: 0 });
    expect(lineMan(old).sold).toBe(900);
  });

  it("a pending one is only awaited, a cancelled one counts nowhere", () => {
    let d = income({ item: "x", amount: "70", status: "pending" });
    d = income(
      {
        incomeType: "sales",
        channel: "lineMan",
        amount: "30",
        status: "pending",
      },
      d,
    );
    d = income({ item: "y", amount: "999", status: "cancelled" }, d);
    // No amount typed: saved, listed as missing, and no money yet.
    d = income({ item: "z" }, d);
    expect(last(d).values.missing).toBe("amount");
    expect(monthPl(d, month)).toEqual(monthPl(sold, month));
    expect(cashBetween(d, ...span)).toEqual(cashBetween(sold, ...span));
    expect(receivables(d).pending).toEqual({ count: 2, amount: 100 });
    expect(lineMan(d)).toMatchObject({ received: 0, left: 900, jotted: true });
  });

  it("a project's P&L leaves out the office's income", () => {
    let d = income({ item: "ดอกเบี้ยรับ", amount: "40" });
    d = income(
      { item: "x", amount: "500", purpose: "project", project: shopProject },
      d,
    );
    d = income(
      { item: "x", amount: "7", purpose: "project", project: "อื่น" },
      d,
    );
    expect(monthPl(d, month).otherIncome).toBe(547);
    expect(monthPl(d, month, shopProject)).toMatchObject({
      sales: 1000,
      otherIncome: 500,
      byIncome: { x: 500 },
      income: 1500,
    });
  });

  it("a project's cash counts only the money in jotted for it, sales receipts too", () => {
    const mine = { purpose: "project", project: shopProject };
    let d = income({ item: "ดอกเบี้ยรับ", amount: "40" });
    d = income({ item: "x", amount: "500", ...mine }, d);
    d = income(
      { item: "x", amount: "7", purpose: "project", project: "อื่น" },
      d,
    );
    d = income(
      { incomeType: "sales", channel: "lineMan", amount: "600", ...mine },
      d,
    );
    d = income({ incomeType: "sales", channel: "lineMan", amount: "90" }, d);
    d = mutate(d, owner, "pay", { amount: "30" }, "", day);
    expect(cashBetween(d, ...span)).toMatchObject({ received: 1237, out: 30 });
    expect(cashBetween(d, ...span, shopProject)).toMatchObject({
      salesReceived: 600,
      otherReceived: 500,
      received: 1100,
      out: 30,
      net: 1070,
    });
  });

  it("is a money-in row of the ledger, apart from what was paid", () => {
    let d = mutate(
      sold,
      owner,
      "expense",
      { item: "a", amount: "80" },
      "",
      day,
    );
    d = income({ item: "ค่าสปอนเซอร์", customer: "ช้าง", amount: "500" }, d);
    d = income({ incomeType: "sales", channel: "lineMan", amount: "600" }, d);
    d = income({ item: "รอ", amount: "70", status: "pending" }, d);
    d = income({ item: "เดือนก่อน", amount: "5" }, d, "2026-08-31");
    const rows = ledgerRows(d);
    expect(rows.filter((row) => row.direction === "in")).toMatchObject([
      { item: "รอ", status: "pending", statusLabel: "รอรับ" },
      { itemType: "ค่าขาย (หลังหัก GP)", item: "LINE MAN", paid: 600 },
      {
        origin: "manual",
        itemType: "รายได้อื่น",
        item: "ค่าสปอนเซอร์",
        vendor: "ช้าง",
        paid: 500,
        statusLabel: "รับแล้ว",
        purpose: "company",
      },
      { item: "เดือนก่อน" },
    ]);
    expect(rows.find((row) => row.item === "a")).toMatchObject({
      direction: "out",
      statusLabel: "จ่ายแล้ว",
    });
    expect(ledgerSummary(rows, month)).toMatchObject({
      paid: 80,
      received: 1100,
      receivedBefore: 5,
      pendingIn: { count: 1, amount: 70 },
    });
    expect(projectAssets(d)).toEqual([]);
  });

  it("the sample: LINE MAN has paid all but the last week, one income is awaited", () => {
    const { channels, pending } = receivables(db);
    expect(channels).toHaveLength(1);
    expect(channels[0].jotted).toBe(true);
    expect(channels[0].received).toBeCloseTo(469917, 0);
    expect(channels[0].left).toBeCloseTo(103701.6, 1);
    expect(pending).toEqual({ count: 1, amount: 2400 });
    expect(plBetween(db, "2026", "2026~").otherIncome).toBeCloseTo(32262.35, 2);
    expect(plBetween(db, "2026", "2026~", shopProject).otherIncome).toBe(31850);
  });
});
