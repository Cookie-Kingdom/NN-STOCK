import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { branchScope, scopeDatabase } from "@/lib/role-scope";
import { thirtyDayRoleplay } from "@/lib/store/demo";
import {
  balance,
  branchMaterialStock,
  branches,
  centralStock,
  chiliStock,
  closeDayChecklist,
  cookedRiceStock,
  entries,
  isClosed,
  materials,
  pendingReceiveKg,
  rawRiceStock,
  shipments,
  visibleEntries,
  type Database,
} from "@/lib/store";

const full = thirtyDayRoleplay("2026-09-20");
const dates = [...new Set(full.entries.map((e) => e.date))];

// VIS-05: the latest app_state_scope_rules() (migration 0035) matches branchScope.
test("the SQL rule (migration 0035) is the same as branchScope", () => {
  const sql = readFileSync(
    "supabase/migrations/20260929000035_branch_scope_all_batches.sql",
    "utf8",
  );
  const json = sql.match(/\$rules\$([\s\S]*?)\$rules\$/)?.[1];
  expect(JSON.parse(json ?? "null")).toEqual(branchScope);
});

// VIS-05 / SRV-03: the fixture of supabase/tests/role_scoped_app_state_test.sql gives the same ids
// here as scope_app_state() gives there (keep the two in step).
test("scopeDatabase picks what the SQL test expects from scope_app_state", () => {
  const e = (
    id: string,
    kind: string,
    role: string,
    lotId: string,
    branch: string,
    values: Record<string, string> = {},
  ) => ({ id, kind, role, lotId, branch, date: "2026-09-01", values });
  const db = {
    version: 9,
    config: { branch: "ศาลาแดง" },
    lots: [
      { id: "P1", poId: "PO-1", config: {}, values: {} },
      { id: "S1", poId: "SH-1", kind: "shipment", config: {}, values: {} },
      { id: "S2", poId: "SH-2", kind: "shipment", config: {}, values: {} },
    ],
    entries: [
      e("e-po", "purchase", "owner", "P1", "ศาลาแดง"),
      e("e-inv", "foodivaConfirm", "foodiva", "P1", "ศาลาแดง"),
      e("e-pl", "packingList", "foodiva", "S1", "ศาลาแดง"),
      e("e-so", "smokeOrder", "owner", "S1", "ศาลาแดง"),
      e("e-ret", "return", "owner", "S1", "ศาลาแดง"),
      e("e-al1", "allocate", "owner", "S1", "มีนบุรี"),
      e("e-al2", "allocate", "owner", "S1", "ศาลาแดง"),
      e("e-mb", "sale", "branch", "S1", "มีนบุรี"),
      e("e-sd", "sale", "branch", "S1", "ศาลาแดง"),
      e("e-v1", "void", "owner", "S1", "ศาลาแดง", { targetId: "e-mb" }),
      e("e-v2", "void", "owner", "S1", "ศาลาแดง", { targetId: "e-sd" }),
      e("e-rcv", "receive", "branch", "", "มีนบุรี"),
      e("e-lk", "link", "branch", "", "มีนบุรี", { targetId: "e-rcv" }),
      e("e-dsp", "dispatch", "foodiva", "S2", "ศาลาแดง"),
    ],
  } as unknown as Database;
  const ids = (scoped: Database) => ({
    lots: scoped.lots.map((l) => l.id).join(","),
    entries: scoped.entries.map((x) => x.id).join(","),
  });
  expect(ids(scopeDatabase(db, ["มีนบุรี"]))).toEqual({
    lots: "S1,S2",
    entries: "e-al1,e-al2,e-mb,e-v1,e-rcv,e-lk",
  });
  // The "central follow" block of the same SQL test.
  const r = (id: string, kind: string, role: string, values: object) => ({
    id,
    kind,
    role,
    lotId: "S2",
    branch: "ศาลาแดง",
    date: "2026-09-07",
    values,
  });
  const central = {
    ...db,
    entries: [
      r("r2", "receive", "branch", { kg: "5", reason: "x", meatCost: "9" }),
      r("rq", "editRequest", "branch", { targetId: "r2", "to.kg": "4" }),
      r("ed", "entryEdit", "owner", {
        targetId: "r2",
        "to.kg": "4",
        "from.kg": "5",
        targetRole: "branch",
        targetBranch: "ศาลาแดง",
      }),
      r("vd", "void", "owner", { targetId: "r2", reason: "x" }),
    ],
  } as unknown as Database;
  expect(scopeDatabase(central, ["มีนบุรี"]).entries).toEqual([
    r("r2", "receive", "branch", { kg: "5" }),
    r("ed", "entryEdit", "owner", { targetId: "r2", "to.kg": "4" }),
    r("vd", "void", "owner", { targetId: "r2" }),
  ]);
});

// BR-08: every batch S reaches the branch, and centralStock (the "สต๊อกกลางไม่พอ" warning, the
// link dialog) reads as the Owner's, other branches' allocations and receives included.
test("a branch gets every batch S and the Owner's central stock", () => {
  const [branch, other] = branches;
  const lot = shipments(full)[0];
  const extra = {
    ...full.entries[0],
    lotId: "S-new",
    role: "owner" as const,
    branch: other,
    date: dates[0],
  };
  const db = {
    ...full,
    // A batch no branch has touched; another branch's allocation and receives on it, one voided.
    lots: [...full.lots, { ...lot, id: "S-new", poId: "SH-new" }],
    entries: [
      ...full.entries,
      {
        ...extra,
        id: "x-al",
        kind: "allocate" as const,
        values: { kg: "4", note: "n" },
      },
      {
        ...extra,
        id: "x-rcv",
        kind: "receive" as const,
        role: "branch" as const,
        values: { kg: "6", reason: "r" },
      },
      {
        ...extra,
        id: "x-rcv2",
        kind: "receive" as const,
        role: "branch" as const,
        values: { kg: "2" },
      },
      {
        ...extra,
        id: "x-v",
        kind: "void" as const,
        values: { targetId: "x-rcv2", reason: "r" },
      },
    ],
  };
  const scoped = scopeDatabase(db, [branch]);
  expect(scoped.lots.map((l) => l.id)).toEqual(
    expect.arrayContaining(shipments(db).map((l) => l.id)),
  );
  for (const s of shipments(db))
    expect(centralStock(scoped, s.id), s.id).toBe(centralStock(db, s.id));
  expect(scoped.entries.find((e) => e.id === "x-rcv")?.values).toEqual({
    kg: "6",
  });
  expect(scoped.entries.find((e) => e.id === "x-al")?.values).toEqual({
    kg: "4",
  });
  expect(
    visibleEntries(scoped, "branch", branch).map((e) => e.id),
  ).not.toContain("x-rcv");
});

test("a void of a followed entry (a withdrawn edit request) is sent", () => {
  const e = (id: string, kind: string, values: Record<string, string> = {}) =>
    ({
      id,
      kind,
      role: "branch",
      lotId: "",
      branch: "มีนบุรี",
      values,
    }) as const;
  const db = {
    version: 9,
    config: {},
    lots: [],
    entries: [
      e("e-rcv", "receive"),
      e("e-req", "editRequest", { targetId: "e-rcv" }),
      e("e-wd", "void", { targetId: "e-req" }),
    ],
  } as unknown as Database;
  expect(scopeDatabase(db, ["มีนบุรี"]).entries.map((x) => x.id)).toEqual([
    "e-rcv",
    "e-req",
    "e-wd",
  ]);
});

test("the sample data exercises every role", () => {
  for (const kind of [
    "sale",
    "allocate",
    "packingList",
    "smoke",
    "purchase",
  ] as const)
    expect(entries(full, kind).length, kind).toBeGreaterThan(0);
  for (const branch of branches)
    expect(entries(full, "sale", undefined, branch).length).toBeGreaterThan(0);
});

test("a branch's history and edit requests read the same from its scoped copy", () => {
  for (const branch of branches) {
    const scoped = scopeDatabase(full, [branch]);
    expect(visibleEntries(scoped, "branch", branch)).toEqual(
      visibleEntries(full, "branch", branch),
    );
  }
});

test("a branch's numbers are the same on its scoped copy", () => {
  for (const branch of branches) {
    const scoped = scopeDatabase(full, [branch]);
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

test("a branch receives nothing it must not see", () => {
  const text = (db: Database) => JSON.stringify(db);
  for (const branch of branches) {
    const scoped = scopeDatabase(full, [branch]);
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
});

test("voids and edits follow the entry they name", () => {
  const [branch, other] = branches;
  const own = entries(full, "sale", undefined, branch)[0];
  const theirs = entries(full, "sale", undefined, other)[0];
  const at = full.entries[0];
  const void_ = (id: string, targetId: string) => ({
    ...at,
    id,
    kind: "void" as const,
    role: "owner" as const,
    branch: other,
    values: { targetId, reason: "x" },
  });
  const db = {
    ...full,
    entries: [...full.entries, void_("v1", own.id), void_("v2", theirs.id)],
  };
  const ids = scopeDatabase(db, [branch]).entries.map((e) => e.id);
  expect(ids).toContain("v1");
  expect(ids).not.toContain("v2");
});
