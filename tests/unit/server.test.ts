import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { accountById } from "@/lib/accounts";
import { today } from "@/lib/format";
import {
  appendState,
  loadState,
  openLocalDb,
  readState,
  replaceState,
  saveState,
} from "@/lib/local-db.server";
import { branchScope, scopeDatabase } from "@/lib/role-scope";
import {
  mutate,
  type Database,
  type Entry,
  type EntryKind,
  type Values,
} from "@/lib/store";
import { sampleData } from "@/lib/store/demo";

/* The server side of the local SQLite mode (what e2e runs on), and its parity with the migrations
 * (20261002000004, 20261002000005): the same state and cases as supabase/tests/v2_app_state_test.sql, read from
 * that file by their dollar-quote tags. */
const owner = accountById("owner")!;
const saladaeng = accountById("saladaeng")!;
const minburi = accountById("minburi")!;
const stored = (payload: Database) => {
  const db = openLocalDb(":memory:");
  replaceState(db, payload);
  return db;
};
const tagged = (file: string, tag: string) =>
  JSON.parse(readFileSync(file, "utf8").split(`$${tag}$`)[1]);
const sqlTest = "supabase/tests/v2_app_state_test.sql";

test("branchScope equals the rule JSON in the migration", () => {
  expect(branchScope).toEqual(
    tagged("supabase/migrations/20261002000004_app_state_scope.sql", "rules"),
  );
});

test("the Owner's copy is whole, and nobody signed out gets one", () => {
  const sample = sampleData(today());
  const db = stored(sample);
  expect(loadState(db, owner).payload).toEqual(sample);
  expect(() => loadState(db, null)).toThrow("Authentication required");
});

test("a branch's copy holds its own entries and the cut-down stock lines, nothing else", () => {
  const sample = sampleData(today());
  const { payload } = loadState(stored(sample), minburi);
  expect(payload.entries.filter((e) => e.role === "branch")).toEqual(
    sample.entries.filter((e) => e.role === "branch" && e.branch === "มีนบุรี"),
  );
  // What the Owner bought for it: what and how many, no amount, payer or detail.
  expect(
    payload.entries.filter((e) => e.role !== "branch").map((e) => e.values),
  ).toEqual([
    { category: "ingredient", item: "chili", qty: "200", branch: "มีนบุรี" },
  ]);
  expect(payload.lots.map((lot) => lot.kind)).toEqual([
    "shipment",
    "shipment",
    "shipment",
  ]);
  expect(Object.keys(payload.config).sort()).toEqual(
    [...branchScope.configKeys].sort(),
  );
  // Of the branches that count raw rice it is told its own alone (the sample: ศาลาแดง only).
  expect(payload.config.rawRiceBranches).toBe("[]");
  expect(loadState(stored(sample), saladaeng).payload.config).toMatchObject({
    rawRiceBranches: '["ศาลาแดง"]',
  });
  expect(JSON.stringify(payload)).not.toContain("ศาลาแดง");
});

test("a branch pays only in its four categories, and saves only by appending", () => {
  const db = stored(sampleData(today()));
  const { payload, revision } = loadState(db, saladaeng);
  const pay = (category: string): Entry => ({
    id: crypto.randomUUID(),
    kind: "pay",
    role: "branch",
    lotId: "",
    branch: "ศาลาแดง",
    date: today(),
    at: "",
    values: { category, amount: "10" },
  });
  for (const category of ["meat", "payroll", "rent"])
    expect(() =>
      appendState(db, saladaeng, [pay(category)], [], revision),
    ).toThrow("Payment category is not allowed for this account");
  expect(() => saveState(db, saladaeng, payload, revision)).toThrow(
    "Branch accounts save through append_entries",
  );
  expect(
    appendState(db, saladaeng, [pay("transport")], [], revision).revision,
  ).toBe(revision + 1);
});

test("the JS ports give what the SQL test expects on the same state and cases", () => {
  const state: Database = tagged(sqlTest, "state");
  const withValues = (id: string, values: Values) => ({
    ...state.entries.find((e) => e.id === id)!,
    values,
  });

  // scope_app_state
  const branchSees: [string, Values][] = tagged(sqlTest, "branch");
  const scoped = scopeDatabase(state, ["มีนบุรี"]);
  expect(scoped.entries).toEqual(
    branchSees.map(([id, values]) => withValues(id, values)),
  );
  expect(scoped.lots).toEqual([
    { ...state.lots[1], config: { packKg: "0.12" }, values: { note: "x" } },
    state.lots[2],
  ]);
  expect(scoped.config).toEqual({
    packKg: "0.12",
    materialList: "[]",
    rawRiceBranches: '["มีนบุรี"]',
  });
  // Nothing names the other branch but its rows of the shared material list (si, siv).
  const shared = ["si", "siv"];
  expect(
    JSON.stringify({
      ...scoped,
      entries: scoped.entries.filter((e) => !shared.includes(e.id)),
    }),
  ).not.toContain("ศาลาแดง");
  expect(scoped.entries.map((e) => e.id)).not.toContain("d2");
  expect(scoped.entries.map((e) => e.id)).not.toContain("op2");
  expect(scopeDatabase(state, ["ศาลาแดง"]).config.rawRiceBranches).toBe(
    '["ศาลาแดง"]',
  );
  expect(scopeDatabase(state, []).config.rawRiceBranches).toBe("[]");
  expect(
    scopeDatabase(
      { ...state, config: { ...state.config, rawRiceBranches: "x" } },
      ["มีนบุรี"],
    ).config,
  ).not.toHaveProperty("rawRiceBranches");
  expect(scopeDatabase(state, []).entries).toEqual([]);

  const db = stored(state);
  expect(loadState(db, minburi).payload).toEqual(scoped);
  const errorOf = (save: () => unknown) => {
    try {
      save();
      return "";
    } catch (error) {
      return (error as Error).message;
    }
  };

  // append_entries, as มีนบุรี
  const appends: [string, EntryKind, string, Values, string][] = tagged(
    sqlTest,
    "appends",
  );
  for (const [id, kind, lotId, values, error] of appends) {
    const entry = {
      id,
      kind,
      role: "branch",
      lotId,
      branch: "มีนบุรี",
      date: "2026-09-10",
      values,
    };
    expect(
      errorOf(() =>
        appendState(db, minburi, [entry], [], readState(db).revision),
      ),
      JSON.stringify([id, kind, values]),
    ).toBe(error);
  }
  expect(
    loadState(db, minburi)
      .payload.entries.map((e) => e.id)
      .join(),
  ).toBe(
    "s1,r1,r0,ov,m0,ps,pse,psv,pb,oe,mc,xe,xee,t1,t3,t3e,t4,tv,d1,op1,si,siv,a1,a2,a3,a4,e1,e2,v1,v2,v3,a5,a6,a7,a8,a9,e3,e4",
  );

  const log = readState(db).payload.entries;
  expect(log.slice(0, state.entries.length)).toEqual(state.entries);
  expect(
    log
      .slice(state.entries.length)
      .map((e) => e.id)
      .join(),
  ).toBe("a1,a2,a3,a4,e1,e2,v1,v2,v3,v4,a5,a6,a7,a8,a9,e3,e4");
});

test("a branch appends only its own branch's kinds, the centre writes none of its notes, and what the centre buys for it reaches it alone", () => {
  const db = stored(sampleData(today()));
  const { revision } = loadState(db, saladaeng);
  const entry = (over: Partial<Entry>): Entry => ({
    id: crypto.randomUUID(),
    kind: "daily",
    role: "branch",
    lotId: "",
    branch: "ศาลาแดง",
    date: today(),
    at: "",
    values: { sheet: "meat", "used.meat": "5" },
    ...over,
  });
  const refused: [Partial<Entry>, string][] = [
    [{ branch: "มีนบุรี" }, "Entry branch does not match signed-in account"],
    [{ role: "owner" }, "Entry role does not match signed-in account"],
    [{ actor: "owner" }, "Entry actor does not match signed-in account"],
    [{ kind: "purchase" }, "Entry kind is not allowed for this account"],
    [{ kind: "config" }, "Entry kind is not allowed for this account"],
    [{ kind: "closeDay" }, "Entry kind is not allowed for this account"],
    // The counts are retired: a branch's stock is its daily sheet.
    [{ kind: "meatCount" }, "Entry kind is not allowed for this account"],
    [{ kind: "materials" }, "Entry kind is not allowed for this account"],
    [{ lotId: "nope" }, "Entry lot does not exist"],
    [{ date: "2999-01-01" }, "Entry date is invalid or after today"],
  ];
  for (const [over, message] of refused)
    expect(
      () => appendState(db, saladaeng, [entry(over)], [], revision),
      JSON.stringify(over),
    ).toThrow(message);
  expect(() =>
    appendState(db, saladaeng, [entry({})], [{ id: "x" }], revision),
  ).toThrow("Only an owner can change lots");
  expect(() => appendState(db, owner, [entry({})], [], revision)).toThrow(
    "Only branch accounts append entries",
  );
  expect(() => appendState(db, null, [entry({})], [], revision)).toThrow(
    "Authentication required",
  );
  // A stale revision (another device saved first) is refused, not merged.
  expect(() =>
    appendState(db, saladaeng, [entry({})], [], revision - 1),
  ).toThrow("State changed on another device. Reload and try again.");
  expect(readState(db).revision).toBe(revision);

  // A branch's notes are the branch's: the Owner jots none, changes none and undoes
  // no change to one, whatever a tampered client stamps on the entry.
  const copy = loadState(db, owner);
  const full = copy.payload;
  const noteId = full.entries.find((e) => e.role === "branch")!.id;
  const change = (kind: EntryKind, targetId: string, id?: string) =>
    entry({
      kind,
      role: "owner",
      branch: "",
      values: { targetId },
      ...(id ? { id } : {}),
    });
  const centre: Entry[][] = [
    [entry({ branch: "มีนบุรี" })],
    [entry({ kind: "opening", branch: "มีนบุรี" })],
    [entry({ kind: "stockItem", branch: "มีนบุรี" })],
    [entry({ branch: "มีนบุรี", actor: "owner" })],
    [change("entryEdit", noteId)],
    [change("void", noteId)],
  ];
  for (const added of centre)
    expect(
      () =>
        saveState(
          db,
          owner,
          { ...full, entries: [...full.entries, ...added] },
          copy.revision,
        ),
      JSON.stringify(added),
    ).toThrow("Only a branch account writes a branch's notes");
  // An old change of the Owner's to a branch's note stays in the log; undoing it is refused.
  const old = stored({
    ...full,
    entries: [...full.entries, change("void", noteId, "ov")],
  });
  expect(() =>
    saveState(
      old,
      owner,
      {
        ...full,
        entries: [...readState(old).payload.entries, change("void", "ov")],
      },
      readState(old).revision,
    ),
  ).toThrow("Only a branch account writes a branch's notes");
  expect(readState(db).revision).toBe(revision);

  // V2-PAY-05: the Owner still buys for มีนบุรี.
  const next = mutate(
    full,
    owner,
    "pay",
    {
      category: "packaging",
      amount: "500",
      item: "m1",
      qty: "50",
      branch: "มีนบุรี",
      payer: "บริษัท",
    },
    "",
    today(),
  );
  saveState(db, owner, next, copy.revision);
  const added = (account: typeof minburi) =>
    loadState(db, account)
      .payload.entries.slice(-1)
      .map((e) => [e.kind, e.values]);
  expect(added(minburi)).toEqual([
    // For stock only: no amount, no payer.
    [
      "pay",
      { category: "packaging", item: "m1", qty: "50", branch: "มีนบุรี" },
    ],
  ]);
  expect(JSON.stringify(loadState(db, saladaeng).payload)).not.toContain(
    "มีนบุรี",
  );
});
