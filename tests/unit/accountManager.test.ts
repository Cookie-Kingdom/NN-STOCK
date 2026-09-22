import { describe, expect, test } from "vitest";
import { accountById } from "@/lib/accounts";
import { managerNav, navLabel } from "@/lib/nav";
import {
  editApprovers,
  editDecisions,
  entries,
  revenue,
  saleMoneyKeys,
  visibleDatabase,
} from "@/lib/store";
import { chillDay, last, purchaseInfo, setup } from "./fixtures";

const manager = accountById("manager")!;

/** chillDay's sale, plus a branch edit request that changes its LINE MAN amount. */
function saleWithRequest() {
  const s = chillDay();
  const sale = last(s);
  s.run("branch", "editRequest", {
    targetId: sale.id,
    values: JSON.stringify({ soldKg: "60", lineMan: "190000" }),
    reason: "พิมพ์ยอดผิด",
  });
  return { s, sale, request: last(s) };
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

  test("approves edit requests", () => {
    expect(editApprovers).toContain(manager.role);
    const { s, sale, request } = saleWithRequest();
    const db = s.run(manager.role, "editDecision", {
      requestId: request.id,
      decision: editDecisions.approve,
    });
    expect(
      entries(db, "sale").find((e) => e.id === sale.id)?.values.revenue,
    ).toBe("190000");
  });

  test("sees no sales money, but still sees purchase prices and costs", () => {
    const { s } = saleWithRequest();
    expect(revenue(s.db)).toBeGreaterThan(0);
    const db = visibleDatabase(s.db, manager.role, "", manager.hidesSales);
    expect(revenue(db)).toBe(0);
    for (const e of db.entries)
      for (const key of Object.keys(e.values))
        expect(saleMoneyKeys, `${e.kind}.${key}`).not.toContain(
          key.replace(/^(to|from)\./, ""),
        );
    expect(entries(db, "sale")[0].values.meatCost).toBeTruthy();
    expect(entries(db, "purchase")[0].values.price).toBe("250");
    // The Owner's own view is the database itself.
    expect(visibleDatabase(s.db, "owner")).toBe(s.db);
  });

  test("has the Owner's nav without the dashboard", () => {
    expect(navLabel(managerNav, "owner-dashboard")).toBe("");
    expect(navLabel(managerNav, manager.homeTab)).not.toBe("");
  });
});
