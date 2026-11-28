import { describe, expect, it } from "vitest";
import {
  cashBetween,
  ledgerRows,
  mutate,
  seed,
  type Database,
  type Values,
} from "../../src/lib/store";
import { importedAccounting } from "../../src/lib/store/imported-accounting";

const owner = { role: "owner" } as const;
const date = "2026-10-01";
const original = {
  sourceLabel: "พี่หญิงออกก่อน (ยังไม่จ่ายคืน)",
  itemType: "ค่าแรง",
  sku: "",
  purposeLabel: "",
  statusLabel: "รอเคลียร์เงินสำรอง",
};
const start = () =>
  mutate(
    seed,
    owner,
    "expense",
    {
      item: "ค่าแรง",
      itemType: "ค่าแรง",
      detail: "ต้นฉบับ",
      vendor: "พี่หญิง",
      amount: "20000",
      status: "paid",
      source: "advance",
      payer: "พี่หญิง",
      purpose: "project",
      project: "Nerdnuea x LINE MAN",
      importedAccounting: JSON.stringify(original),
    },
    "",
    date,
  );
const edit = (db: Database, patch: Values) =>
  mutate(
    db,
    owner,
    "entryEdit",
    { targetId: ledgerRows(db)[0].id, values: JSON.stringify(patch) },
    "",
    date,
  );

describe("Accounting source cells", () => {
  it("keeps source labels and explicit blanks while native fields determine calculations", () => {
    const db = start();
    expect(ledgerRows(db)[0]).toMatchObject({
      ...original,
      item: "ค่าแรง",
      detail: "ต้นฉบับ",
      vendor: "พี่หญิง",
      status: "paid",
      purpose: "project",
      paid: 20000,
    });
    expect(cashBetween(db, "", "2026~")).toMatchObject({
      paid: 20000,
      advanced: 20000,
      out: 0,
    });
    const income = mutate(
      seed,
      owner,
      "income",
      {
        incomeType: "sales",
        channel: "lineMan",
        item: "ต้นฉบับรายรับ",
        amount: "730",
        status: "paid",
        importedAccounting: JSON.stringify({
          sourceLabel: "ยอดจาก Statement",
          itemType: "รายรับรอตรวจ",
          statusLabel: "รอยืนยันเหตุผลการโอน",
          sku: "",
          purposeLabel: "",
        }),
      },
      "",
      date,
    );
    expect(ledgerRows(income)[0]).toMatchObject({
      item: "ต้นฉบับรายรับ",
      sourceLabel: "ยอดจาก Statement",
      itemType: "รายรับรอตรวจ",
      statusLabel: "รอยืนยันเหตุผลการโอน",
      sku: "",
      purposeLabel: "",
    });
    expect(cashBetween(income, "", "2026~").received).toBe(730);
    const changedIncome = edit(income, { incomeType: "other" });
    expect(ledgerRows(changedIncome)[0]).toMatchObject({
      itemType: "รายได้อื่น",
      sourceLabel: "ยอดจาก Statement",
      statusLabel: "รอยืนยันเหตุผลการโอน",
    });
  });

  it("keeps unaffected original cells on manual edits and replaces only changed cells", () => {
    let db = edit(start(), { note: "เพิ่มหมายเหตุ" });
    expect(ledgerRows(db)[0]).toMatchObject(original);
    db = edit(db, { source: "transfer" });
    expect(ledgerRows(db)[0]).toMatchObject({
      sourceLabel: "เงินโอน",
      statusLabel: original.statusLabel,
      purposeLabel: "",
      sku: "",
    });
    db = edit(db, { status: "cancelled", itemType: "ขนส่ง" });
    expect(ledgerRows(db)[0]).toMatchObject({
      statusLabel: "ยกเลิก",
      itemType: "ขนส่ง",
      purposeLabel: "",
      sku: "",
    });
    db = edit(db, { item: "รายการใหม่", purpose: "company", project: "" });
    expect(ledgerRows(db)[0].sku).not.toBe("");
    expect(ledgerRows(db)[0].purposeLabel).toBeUndefined();
  });

  it("rejects malformed or unauthorized display overrides", () => {
    for (const value of [
      "null",
      "[]",
      '{"paid":"900"}',
      '{"statusLabel":false}',
      '{"purpose":"company"}',
    ]) {
      expect(() => importedAccounting(value)).toThrow();
      expect(() => edit(start(), { importedAccounting: value })).toThrow();
    }
    expect(() => edit(start(), { importedAccounting: "{" })).toThrow();
  });
});
