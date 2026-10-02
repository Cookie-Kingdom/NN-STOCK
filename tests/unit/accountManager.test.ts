import { describe, expect, test } from "vitest";
import { accountById } from "@/lib/accounts";
import { managerNav, navLabel } from "@/lib/nav";
import {
  entries,
  entryBy,
  revenue,
  saleCost,
  saleMoneyKeys,
  mutate,
  visibleDatabase,
  type Database,
  type Values,
} from "@/lib/store";
import { restoreSaleMoney, stripSaleMoney } from "@/lib/sale-money";
import { chillDay, last, purchaseInfo, setup } from "./fixtures";

const manager = accountById("manager")!;

/** chillDay's sale, plus the Owner's edit of it that changes its LINE MAN amount. */
function saleWithEdit() {
  const s = chillDay();
  const sale = last(s);
  s.run("owner", "entryEdit", {
    targetId: sale.id,
    values: JSON.stringify({ soldKg: "60", lineMan: "190000" }),
    reason: "พิมพ์ยอดผิด",
  });
  return { s, sale };
}

describe("C4 Account Manager", () => {
  test("does an Owner mutation, recorded as role owner", () => {
    const s = setup();
    s.run(manager.role, "purchase", {
      ...purchaseInfo,
      orderedKg: "100",
      price: "250",
    });
    expect(last(s)).toMatchObject({ kind: "purchase", role: "owner" });
  });

  test("edits and deletes a branch's entry like the Owner (EDT-22)", () => {
    expect(manager.role).toBe("owner");
    const s = chillDay();
    const sale = last(s);
    s.run(manager.role, "entryEdit", {
      targetId: sale.id,
      values: JSON.stringify({ lineMan: "190000" }),
      reason: "พิมพ์ยอดผิด",
    });
    expect(
      entries(s.db, "sale").find((e) => e.id === sale.id)?.values.revenue,
    ).toBe("190000");
    s.run(manager.role, "void", { targetId: sale.id, reason: "ซ้ำ" });
    expect(entries(s.db, "sale")).toEqual([]);
  });

  test("edits a sale from the copy without money; the server fills it in", () => {
    const { s, sale } = saleWithEdit();
    // What the manager's browser holds: load_app_state / GET /api/local-db strip the money.
    const seen = stripSaleMoney(s.db);
    const edited = mutate(
      seen,
      manager.role,
      "entryEdit",
      {
        targetId: sale.id,
        values: JSON.stringify({ soldKg: "62" }),
        reason: "แก้น้ำหนัก",
      },
      "",
      sale.date,
    );
    expect(JSON.stringify(edited)).not.toMatch(
      /"(to\.|from\.)?(revenue|lineMan|menuTotal)"/,
    );
    // save_app_state (restoreSaleMoney locally) puts the stored money back: the sale's own,
    // as the Owner's earlier edit left it.
    const saved = restoreSaleMoney(s.db, edited);
    expect(saved.entries.slice(0, s.db.entries.length)).toEqual(s.db.entries);
    const now = entries(saved, "sale").find((e) => e.id === sale.id)!;
    expect(now.values).toMatchObject({
      soldKg: "62",
      lineMan: "190000",
      revenue: "190000",
      menuTotal: sale.values.menuTotal,
    });
  });

  const MONEY = /"(to\.|from\.)?(revenue|lineMan|menuTotal)"/;
  /** The manager's save as the server keeps it: mutate on the copy without money, then
   *  save_app_state's restore (restoreSaleMoney locally) against the stored `full`. */
  const managerSave = (
    full: Database,
    kind: "entryEdit" | "void",
    values: Values,
  ) => {
    const sent = mutate(
      stripSaleMoney(full),
      manager.role,
      kind,
      values,
      "",
      full.entries.at(-1)!.date,
    );
    expect(JSON.stringify(sent)).not.toMatch(MONEY);
    return restoreSaleMoney(full, sent);
  };
  const saleOf = (db: Database, id: string) =>
    entries(db, "sale").find((e) => e.id === id)?.values;

  test("its edit of a sale's boxes and chili gives the Owner the money an Owner edit gives", () => {
    const { s, sale } = saleWithEdit();
    const change = {
      targetId: sale.id,
      values: JSON.stringify({ boxes: "10", chiliAddons: "2" }),
      reason: "แก้จำนวน",
    };
    const byOwner = mutate(s.db, "owner", "entryEdit", change, "", sale.date);
    const byManager = managerSave(s.db, "entryEdit", change);
    expect(saleOf(byManager, sale.id)).toEqual(saleOf(byOwner, sale.id));
    expect(saleOf(byManager, sale.id)).toMatchObject({
      boxes: "10",
      chiliAddons: "2",
      lineMan: "190000",
      revenue: "190000",
      menuTotal: String(
        10 * Number(s.db.config.boxPrice) + 2 * Number(s.db.config.chiliPrice),
      ),
    });
    expect(revenue(byManager)).toBe(revenue(byOwner));
  });

  test("a call carrying sale money from its copy neither sets nor blanks the amount", () => {
    const { s, sale } = saleWithEdit();
    for (const money of [
      { lineMan: "" },
      { lineMan: "5", revenue: "5", menuTotal: "5" },
    ] as Values[]) {
      const saved = managerSave(s.db, "entryEdit", {
        targetId: sale.id,
        values: JSON.stringify({ soldKg: "62", ...money }),
        reason: "แก้น้ำหนัก",
      });
      const now = saleOf(saved, sale.id)!;
      expect(now).toMatchObject({
        soldKg: "62",
        lineMan: "190000",
        revenue: "190000",
        menuTotal: sale.values.menuTotal,
      });
      // LINE MAN is not called missing because the manager's form had no such field.
      expect(now.missing ?? "").toBe("");
    }
  });

  test("undoes its own edit of a sale, and the Owner undoes it: the sale and its money are as before", () => {
    const { s, sale } = saleWithEdit();
    const before = saleOf(s.db, sale.id);
    const edited = managerSave(s.db, "entryEdit", {
      targetId: sale.id,
      values: JSON.stringify({ boxes: "10", soldKg: "62" }),
      reason: "แก้จำนวน",
    });
    expect(saleOf(edited, sale.id)).not.toEqual(before);
    const undo = { targetId: edited.entries.at(-1)!.id, reason: "ย้อนกลับ" };
    const byManager = managerSave(edited, "void", undo);
    expect(saleOf(byManager, sale.id)).toEqual(before);
    expect(revenue(byManager)).toBe(revenue(s.db));
    const byOwner = mutate(edited, "owner", "void", undo, "", sale.date);
    expect(saleOf(byOwner, sale.id)).toEqual(before);
  });

  test("deletes a sale and puts it back: the money is the stored one", () => {
    const { s, sale } = saleWithEdit();
    const gone = managerSave(s.db, "void", {
      targetId: sale.id,
      reason: "ซ้ำ",
    });
    expect(entries(gone, "sale")).toEqual([]);
    expect(revenue(gone)).toBe(0);
    const back = managerSave(gone, "void", {
      targetId: gone.entries.at(-1)!.id,
      reason: "ลบผิด",
    });
    expect(saleOf(back, sale.id)).toEqual(saleOf(s.db, sale.id));
    expect(revenue(back)).toBe(190000);
    // Stored history is the Owner's, money and all.
    expect(back.entries.slice(0, s.db.entries.length)).toEqual(s.db.entries);
  });

  test("sees no sales money, but still sees purchase prices and costs", () => {
    const { s } = saleWithEdit();
    expect(revenue(s.db)).toBeGreaterThan(0);
    const db = visibleDatabase(s.db, manager.hidesSales);
    expect(revenue(db)).toBe(0);
    for (const e of db.entries)
      for (const key of Object.keys(e.values))
        expect(saleMoneyKeys, `${e.kind}.${key}`).not.toContain(
          key.replace(/^(to|from)\./, ""),
        );
    expect(saleCost(db, entries(db, "sale")[0]).meatCost).toBeGreaterThan(0);
    expect(entries(db, "purchase")[0].values.price).toBe("250");
    // The Owner's own view is the database itself.
    expect(visibleDatabase(s.db)).toBe(s.db);
  });

  test("the log names the Account Manager apart from the Owner", () => {
    expect(entryBy({ role: "owner", actor: "manager" })).toBe(
      "Account Manager",
    );
    // Entries from before C4 have no actor: the Owner's.
    expect(entryBy({ role: "owner" })).toBe("Owner");
  });

  test("has the Owner's nav without the dashboard", () => {
    expect(navLabel(managerNav, "owner-dashboard")).toBe("");
    expect(navLabel(managerNav, manager.homeTab)).not.toBe("");
  });
});
