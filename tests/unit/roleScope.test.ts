import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { scopeDatabase, scopeRules } from "@/lib/role-scope";
import {
  balance,
  branchMaterialStock,
  branches,
  chiliStock,
  closeDayChecklist,
  cookedRiceStock,
  drawnKg,
  entries,
  isClosed,
  latestPackingList,
  materials,
  pendingReceiveKg,
  poRemainingKg,
  producedBags,
  purchaseLots,
  rawAtFoodiva,
  rawRiceStock,
  readyForChefHouse,
  shipments,
  thirtyDayRoleplay,
  visibleDatabase,
  visibleEntries,
  type Database,
} from "@/lib/store";

const full = thirtyDayRoleplay("2026-09-20");
const dates = [...new Set(full.entries.map((e) => e.date))];

test("the SQL rule table (migration 0028) is the same as scopeRules", () => {
  const sql = readFileSync(
    "supabase/migrations/20260925000028_role_scoped_app_state.sql",
    "utf8",
  );
  const json = sql.match(/\$rules\$([\s\S]*?)\$rules\$/)?.[1];
  expect(JSON.parse(json ?? "null")).toEqual(scopeRules);
});

test("the sample data exercises every role", () => {
  for (const kind of ["sale", "allocate", "packingList", "smoke", "purchase"])
    expect(entries(full, kind).length, kind).toBeGreaterThan(0);
  for (const branch of branches)
    expect(entries(full, "sale", undefined, branch).length).toBeGreaterThan(0);
});

test("every role's history and edit requests read the same from its scoped copy", () => {
  for (const branch of branches) {
    const scoped = scopeDatabase(full, "branch", [branch]);
    expect(visibleEntries(scoped, "branch", branch)).toEqual(
      visibleEntries(full, "branch", branch),
    );
  }
  for (const role of ["foodiva", "cm"] as const)
    expect(visibleEntries(scopeDatabase(full, role), role)).toEqual(
      visibleEntries(full, role),
    );
});

test("Chef House's scoped copy is visibleDatabase, less config it never reads", () => {
  const withoutConfig = (db: Database) => ({
    lots: db.lots.map((lot) => ({ ...lot, config: {} })),
    entries: db.entries,
  });
  const scoped = scopeDatabase(full, "cm");
  expect(scoped.lots.length).toBeGreaterThan(0);
  expect(withoutConfig(visibleDatabase(scoped, "cm"))).toEqual(
    withoutConfig(visibleDatabase(full, "cm")),
  );
  expect(scoped).toEqual(visibleDatabase(scoped, "cm"));
});

test("a branch's numbers are the same on its scoped copy", () => {
  for (const branch of branches) {
    const scoped = scopeDatabase(full, "branch", [branch]);
    for (const lot of full.lots) {
      expect(balance(scoped, lot.id, branch)).toEqual(
        balance(full, lot.id, branch),
      );
      expect(pendingReceiveKg(scoped, lot.id, branch)).toEqual(
        pendingReceiveKg(full, lot.id, branch),
      );
    }
    for (const helper of [rawRiceStock, cookedRiceStock, chiliStock])
      expect(helper(scoped, branch)).toEqual(helper(full, branch));
    materials.forEach((_, index) =>
      expect(branchMaterialStock(scoped, branch, index)).toEqual(
        branchMaterialStock(full, branch, index),
      ),
    );
    for (const date of dates) {
      expect(isClosed(scoped, branch, date)).toBe(isClosed(full, branch, date));
      expect(closeDayChecklist(scoped, branch, date)).toEqual(
        closeDayChecklist(full, branch, date),
      );
    }
  }
});

test("Foodiva's numbers are the same on its scoped copy", () => {
  const scoped = scopeDatabase(full, "foodiva");
  expect(shipments(scoped)).toHaveLength(shipments(full).length);
  for (const lot of purchaseLots(full)) {
    const mine = scoped.lots.find((item) => item.id === lot.id)!;
    expect(rawAtFoodiva(scoped, mine)).toBe(rawAtFoodiva(full, lot));
    expect(poRemainingKg(scoped, lot.id)).toBe(poRemainingKg(full, lot.id));
    expect(readyForChefHouse(scoped, lot.id)).toBe(
      readyForChefHouse(full, lot.id),
    );
    expect(drawnKg(scoped, lot.id, true)).toBe(drawnKg(full, lot.id, true));
  }
  for (const lot of shipments(full)) {
    expect(producedBags(scoped, lot.id)).toBe(producedBags(full, lot.id));
    expect(latestPackingList(scoped, lot.id)).toEqual(
      latestPackingList(full, lot.id),
    );
  }
});

test("no role receives what it must not see", () => {
  const text = (db: Database) => JSON.stringify(db);
  for (const branch of branches) {
    const scoped = scopeDatabase(full, "branch", [branch]);
    const other = branches.find((b) => b !== branch)!;
    expect(
      scoped.entries.some((e) => e.branch === other && e.kind === "sale"),
    ).toBe(false);
    expect(scoped.entries.some((e) => e.role === "foodiva")).toBe(false);
    expect(scoped.entries.some((e) => e.kind === "purchase")).toBe(false);
    expect(text(scoped)).not.toMatch(
      /"(meatCost|wasteCost|price|lines|outboundCost|returnCost|estimatedCost)"/,
    );
    expect(scoped.config.outboundFee).toBeUndefined();
  }
  const foodiva = scopeDatabase(full, "foodiva");
  expect(foodiva.entries.some((e) => e.role === "branch")).toBe(false);
  expect(foodiva.entries.some((e) => e.kind === "smokingInvoice")).toBe(false);
  expect(text(foodiva)).not.toMatch(/"(revenue|lineMan|meatCost|returnCost)"/);
  expect(foodiva.config.boxPrice).toBeUndefined();
  const cm = scopeDatabase(full, "cm");
  expect(cm.entries.some((e) => e.role === "branch")).toBe(false);
  expect(cm.entries.some((e) => e.kind === "purchase")).toBe(false);
  expect(text(cm)).not.toMatch(/"(price|lines|outboundCost|returnCost)"/);
});

test("voids and edits follow the entry they name", () => {
  const [branch, other] = branches;
  const own = entries(full, "sale", undefined, branch)[0];
  const theirs = entries(full, "sale", undefined, other)[0];
  const at = full.entries[0];
  const void_ = (id: string, targetId: string) => ({
    ...at,
    id,
    kind: "void",
    role: "owner" as const,
    branch: other,
    values: { targetId, reason: "x" },
  });
  const db = {
    ...full,
    entries: [...full.entries, void_("v1", own.id), void_("v2", theirs.id)],
  };
  const ids = scopeDatabase(db, "branch", [branch]).entries.map((e) => e.id);
  expect(ids).toContain("v1");
  expect(ids).not.toContain("v2");
});
