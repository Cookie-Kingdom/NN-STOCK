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
