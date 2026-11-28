import { describe, expect, it } from "vitest";
import {
  advances,
  cashBetween,
  cashOpening,
  ledgerRows,
  monthPl,
  mutate,
  seed,
  type Database,
  type Values,
} from "../../src/lib/store";
import { scopeDatabase } from "../../src/lib/role-scope";

const owner = { role: "owner" } as const;
const project = "Nerdnuea x LINE MAN";
const opening = {
  id: "start",
  date: "2026-10-01",
  amount: "1000",
  purpose: "project",
  project,
};
const configure = (rows: unknown) =>
  mutate(
    seed,
    owner,
    "config",
    { cashOpeningBalances: JSON.stringify(rows) },
    "",
    "2026-10-01",
  );
const add = (
  db: Database,
  kind: "expense" | "income",
  values: Values,
  date = "2026-10-02",
) =>
  mutate(
    db,
    owner,
    kind,
    { purpose: "project", project, status: "paid", ...values },
    "",
    date,
  );
const close = (db: Database, period: string) => {
  const before = cashBetween(db, "", period);
  const cash = cashBetween(db, period, `${period}~`);
  return (
    before.received -
    before.paid +
    cashOpening(db, `${period}~`) +
    cash.received -
    cash.paid
  );
};

describe("native opening cash", () => {
  it("starts on its effective date and rolls into later months/year exactly once without revenue", () => {
    let db = configure([opening]);
    expect(cashOpening(db, "2026-09-30")).toBe(0);
    expect(cashOpening(db, "2026-10-01", project)).toBe(1000);
    expect(cashOpening(db, "2026-12-31", "Nerdnuea x Paragon")).toBe(0);
    expect(cashOpening(scopeDatabase(db, ["ศาลาแดง"]), "2026-12-31")).toBe(0);
    expect(ledgerRows(db)).toHaveLength(0);
    expect(cashBetween(db, "", "2026~").received).toBe(0);
    expect(monthPl(db, "2026").income).toBe(0);
    db = add(db, "income", {
      incomeType: "other",
      item: "receipt",
      amount: "300",
    });
    db = add(db, "expense", {
      itemType: "ขนส่ง",
      amount: "100",
      source: "transfer",
    });
    db = add(db, "expense", {
      itemType: "ขนส่ง",
      amount: "40",
      source: "advance",
      payer: "พี่หญิง",
    });
    expect(close(db, "2026-10")).toBe(1160);
    expect(close(db, "2026-11")).toBe(1160);
    expect(close(db, "2026")).toBe(1160);
    expect(
      ledgerRows(db)
        .filter((r) => r.direction === "out")
        .reduce((s, r) => s + (r.paid ?? 0), 0),
    ).toBe(140);
    expect(cashBetween(db, "", "2026~")).toMatchObject({
      received: 300,
      company: 100,
      advanced: 40,
      out: 100,
    });
    expect(advances(db, project)).toEqual([
      { payer: "พี่หญิง", advanced: 40, repaid: 0, left: 40 },
    ]);
    expect(advances(db, "Nerdnuea x Paragon")).toEqual([]);
    db = mutate(
      db,
      owner,
      "reimburse",
      { payer: "พี่หญิง", amount: "10" },
      "",
      "2026-11-03",
    );
    expect(advances(db, project)[0].left).toBe(30);
    expect(close(db, "2026-10")).toBe(1160);
    expect(close(db, "2026-11")).toBe(1160);
    expect(close(db, "2026")).toBe(1160);
    expect(cashBetween(db, "", "2026~").net + cashOpening(db, "2026~")).toBe(
      1190,
    );
    expect(advances(db, "Nerdnuea x Paragon")).toEqual([]);
    expect(monthPl(db, "2026").opex).toBe(140);
  });

  it("deducts advances on the spending date rather than subtracting today's outstanding debt from every period", () => {
    let db = configure([opening]);
    db = add(
      db,
      "expense",
      { itemType: "ขนส่ง", amount: "40", source: "advance", payer: "พี่หญิง" },
      "2026-11-02",
    );
    expect(close(db, "2026-09")).toBe(0);
    expect(close(db, "2026-10")).toBe(1000);
    expect(close(db, "2026-11")).toBe(960);
    db = mutate(
      db,
      owner,
      "reimburse",
      { payer: "พี่หญิง", amount: "10" },
      "",
      "2026-11-03",
    );
    expect(close(db, "2026-10")).toBe(1000);
    expect(close(db, "2026-11")).toBe(960);
    expect(advances(db, project)[0].left).toBe(30);
  });

  it("isolates company and project openings and rejects corrupt or ambiguous balances", () => {
    const db = configure([
      opening,
      {
        ...opening,
        id: "company",
        purpose: "company",
        project: "",
        amount: "50",
      },
    ]);
    expect(cashOpening(db, "2026~")).toBe(1050);
    expect(cashOpening(db, "2026~", project)).toBe(1000);
    for (const bad of [
      { ...opening, amount: "-1" },
      { ...opening, amount: "1.001" },
      { ...opening, date: "2026-02-30" },
      { ...opening, date: "2099-01-01" },
      { ...opening, project: "" },
    ])
      expect(() => configure([bad])).toThrow();
    expect(() => configure([opening, { ...opening, id: "second" }])).toThrow();
    expect(() =>
      configure([opening, { ...opening, project: "Other" }]),
    ).toThrow();
    expect(
      cashOpening({ config: { cashOpeningBalances: "broken" } }, "2026~"),
    ).toBe(0);
    expect(
      cashOpening(
        {
          config: {
            cashOpeningBalances: JSON.stringify([
              { ...opening, amount: "NaN" },
            ]),
          },
        },
        "2026~",
      ),
    ).toBe(0);
  });
});
