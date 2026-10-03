import { describe, expect, it } from "vitest";
import {
  advances,
  boxCost,
  branchChili,
  branchMaterial,
  branchMeat,
  entries,
  giftBoxes,
  itemNoFor,
  ledgerRows,
  liveEntries,
  lotInfo,
  monthPl,
  mutate,
  poInfo,
  purchaseLots,
  saleMoney,
  salesChannels,
  seed,
  shipments,
  supplierBalances,
  todos,
  visibleEntries,
  visibleNotes,
  type Actor,
  type Database,
  type NoteKind,
} from "@/lib/store";
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
    // V2-ACC-03, 04: the Owner jots anything for a branch, the Account Manager all but a sale.
    expect(
      jot(owner, "sale", { branch: "มีนบุรี", boxes: "1", lineMan: "350" }),
    ).toMatchObject({ role: "branch", actor: "owner", branch: "มีนบุรี" });
    for (const [kind, values] of [
      ["receive", { kg: "1" }],
      ["meatCount", { kg: "1" }],
      ["influencerBox", { influencer: "x", boxes: "1" }],
      ["materials", { "count.m1": "1" }],
    ] as const)
      expect(
        jot(manager, kind, { ...values, branch: "มีนบุรี" }),
      ).toMatchObject({ role: "branch", branch: "มีนบุรี" });
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

  it("stamps a branch kind with the branch, whoever jots it", () => {
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
    expect(
      last(
        mutate(db, owner, "meatCount", { kg: "5", branch: "มีนบุรี" }, "", day),
      ),
    ).toMatchObject({ role: "branch", actor: "owner", branch: "มีนบุรี" });
    expect(() => mutate(db, owner, "meatCount", { kg: "5" }, "", day)).toThrow(
      "เลือกสาขา",
    );
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
    const deleted = mutate(db, owner, "void", { targetId: count.id }, "", day);
    expect(branchMeat(deleted, "ศาลาแดง", day).kg).not.toBe(before);
    const back = mutate(
      deleted,
      owner,
      "void",
      { targetId: last(deleted).id },
      "",
      day,
    );
    expect(branchMeat(back, "ศาลาแดง", day).kg).toBe(before);
    // Another branch's entry, and the Account Manager on a sale.
    const minburi: Actor = { role: "branch", branch: "มีนบุรี" };
    expect(() =>
      mutate(db, minburi, "void", { targetId: count.id }, "", day),
    ).toThrow();
    expect(() =>
      mutate(db, manager, "void", { targetId: sale.id }, "", day),
    ).toThrow();
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
      "มีนบุรี: วัสดุ 7 รายการไม่ได้นับเกิน 7 วัน",
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
      "วัสดุ 7 รายการไม่ได้นับเกิน 7 วัน",
    ]),
  );
  expect(branch.some((text) => text.endsWith("ยังไม่ได้จด 1 ช่อง"))).toBe(true);
});

it("edit, undo, delete and put back: one kind of each group", () => {
  const cases: [NoteKind, string, string, Actor][] = [
    ["smoked", "smokedKg", "100", owner], // Lot
    ["pay", "amount", "999", manager], // เงิน
    ["cmReceive", "receivedKg", "198", manager], // จดเพิ่มได้
    ["receive", "kg", "41", saladaeng], // สาขา
  ];
  for (const [kind, key, value, by] of cases) {
    const target = visibleNotes(db, by).find((e) => e.kind === kind)!;
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
  // The Owner corrects a branch's sale, deletes a payroll payment and a transport payment.
  const sale = entries(db, "sale", undefined, "ศาลาแดง").at(-1)!;
  const pays = entries(db, "pay");
  const payroll = pays.find((e) => e.values.category === "payroll")!;
  const transport = pays.find((e) => e.values.category === "transport")!;
  let changed = mutate(
    db,
    owner,
    "entryEdit",
    { targetId: sale.id, values: '{"boxes":"1"}' },
    "",
    day,
  );
  const saleEdit = last(changed).id;
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
      (e) => e.kind !== "sale" && e.values.category !== "payroll",
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
    // V2-PAY-07: out of pocket, over payments and the sale's expense; the company is no advance.
    expect(advances(built)).toEqual([{ payer: "น้องฝน", amount: 400 }]);
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
    expect(branchChili(built, "ศาลาแดง")).toEqual({
      qty: 47,
      countedOn: "2026-09-11",
    });
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

describe("ledger: Item No.", () => {
  const jot = (d: Database, item: string, by: Actor = manager) =>
    mutate(d, by, "expense", { item, amount: "10" }, "", day);
  const no = (d: Database) => last(d).values.itemNo;

  it("issues ITM-0001 up, and reuses the number of the same name (trimmed, any case)", () => {
    let d = jot(seed, "กระดาษ A4");
    expect(no(d)).toBe("ITM-0001");
    d = jot(d, "ปากกา", owner);
    expect(no(d)).toBe("ITM-0002");
    d = jot(d, "  กระดาษ a4 ");
    expect(no(d)).toBe("ITM-0001");
    expect(itemNoFor(d, "ยางลบ")).toEqual({ no: "ITM-0003", isNew: true });
  });

  it("never gives a deleted entry's number again, and an edit to a new name gets a new one", () => {
    let d = jot(seed, "กระดาษ A4");
    d = jot(d, "ปากกา");
    d = mutate(d, owner, "void", { targetId: last(d).id }, "", day);
    d = jot(d, "ยางลบ");
    expect(no(d)).toBe("ITM-0003");
    const id = last(d).id;
    d = mutate(
      d,
      manager,
      "entryEdit",
      { targetId: id, values: JSON.stringify({ item: "ยางลบ", qty: "2" }) },
      "",
      day,
    );
    expect(entries(d, "expense").find((e) => e.id === id)!.values.itemNo).toBe(
      "ITM-0003",
    );
    d = mutate(
      d,
      manager,
      "entryEdit",
      { targetId: id, values: JSON.stringify({ item: "คลิปหนีบ" }) },
      "",
      day,
    );
    expect(entries(d, "expense").find((e) => e.id === id)!.values.itemNo).toBe(
      "ITM-0004",
    );
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
