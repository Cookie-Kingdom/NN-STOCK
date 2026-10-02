import { describe, expect, it } from "vitest";
import {
  branchMaterial,
  branchMeat,
  entries,
  lotInfo,
  mutate,
  poInfo,
  purchaseLots,
  shipments,
  supplierBalances,
  todos,
  visibleNotes,
  type Actor,
  type Database,
} from "@/lib/store";
import { sampleData } from "@/lib/store/demo";

// Smoke checks of the domain on the approved sample. The figures do not depend on the date.
const day = "2026-09-09";
const db = sampleData(day);
const owner: Actor = { role: "owner" };
const manager: Actor = { role: "owner", hidesSales: true };
const saladaeng: Actor = { role: "branch", branch: "ศาลาแดง" };
const last = (d: Database) => d.entries.at(-1)!;

describe("sample: Lots", () => {
  const [lot1, lot2, lot3] = shipments(db).map((lot) => lotInfo(db, lot.id));

  it("costs the complete Lot", () => {
    expect(lot1).toMatchObject({
      sentKg: 200,
      backKg: 104,
      yield: 0.52,
      meatCost: 140000,
      fee: 24000,
      centralKg: 14,
      complete: true,
    });
    expect(lot1.costPerKg).toBeCloseTo(1576.92, 2);
    expect(lot1.meatPerBox).toBeCloseTo(189.23, 2);
    expect(lot1.costPerBox).toBeCloseTo(214.23, 2);
  });

  it("counts what is yellow on the others", () => {
    expect(lot2.missing).toEqual(["central", "smokingInvoice"]);
    expect(lot2.unlinked).toBeDefined();
    expect(lot2.yellow).toBe(3);
    expect(lot2.costPerBox).toBeNull();
    expect(lot3.missing).toEqual(["dispatch", "central", "smokingInvoice"]);
    expect(lot3.yellow).toBe(3);
  });

  it("knows what each PO still holds", () => {
    const [po1, po2] = purchaseLots(db).map((lot) => poInfo(db, lot.id));
    expect(po1.heldKg).toBe(0);
    expect(po2.heldKg).toBe(150);
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
      "SH-2026-0002: ผูก PO เนื้อ",
      "SH-2026-0003: ส่งไปรม",
    ]),
  );
  expect(texts(manager).join()).not.toContain("ยอดขาย");
  const branch = texts(saladaeng);
  expect(branch).toContain("ยอดขาย วันนี้");
  expect(branch.join()).not.toContain("SH-");
  expect(branch.some((text) => text.endsWith("ยังไม่ได้จด 1 ช่อง"))).toBe(true);
});
