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
import { stripForManager } from "@/lib/manager-scope";
import { branchScope, scopeDatabase } from "@/lib/role-scope";
import {
  isSaleMoneyKey,
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
const manager = accountById("manager")!;
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
const unprefixed = (key: string) => key.replace(/^(to|from)\./, "");

test("branchScope equals the rule JSON in the migration", () => {
  expect(branchScope).toEqual(
    tagged("supabase/migrations/20261002000004_app_state_scope.sql", "rules"),
  );
});

test("the Account Manager's copy has no sale money and no payroll amount, name or payer", () => {
  const sample = sampleData(today());
  const db = stored(sample);
  const { payload } = loadState(db, manager);
  // Every entry stays in its place, so the manager's whole-payload save lines up.
  expect(payload.entries.map((e) => e.id)).toEqual(
    sample.entries.map((e) => e.id),
  );
  expect(
    payload.entries
      .flatMap((e) => Object.keys(e.values))
      .filter((key) => isSaleMoneyKey(unprefixed(key))),
  ).toEqual([]);
  const payroll = payload.entries.filter(
    (e) => e.values.category === "payroll",
  );
  expect(payroll).toHaveLength(3);
  for (const e of payroll) expect(e.values).toEqual({ category: "payroll" });
  expect(JSON.stringify(payload)).not.toContain("พี่เอ");
  // The sales themselves stay (boxes and chili move the branch stock it works out).
  expect(payload.entries.filter((e) => e.kind === "sale")).toHaveLength(
    sample.entries.filter((e) => e.kind === "sale").length,
  );
  expect(loadState(db, owner).payload).toEqual(sample);
  expect(() => loadState(db, null)).toThrow("Authentication required");
});

test("the Account Manager saves no sale, payroll payment or settings, and a normal save keeps the stored sale money", () => {
  const sample = sampleData(today());
  const db = stored(sample);
  const { payload, revision } = loadState(db, manager);
  // What persistence does to the manager's new entries.
  const stamp = (next: Database): Database => ({
    ...next,
    entries: next.entries.map((e, index) =>
      index < payload.entries.length ? e : { ...e, actor: "manager" },
    ),
  });
  // mutate() refuses these, so a tampered client builds them by hand.
  const forged = (kind: EntryKind, values: Values, over: Partial<Entry> = {}) =>
    stamp({
      ...payload,
      entries: [
        ...payload.entries,
        {
          id: crypto.randomUUID(),
          kind,
          role: "owner",
          lotId: "",
          branch: "",
          date: today(),
          at: "",
          values,
          ...over,
        },
      ],
    });
  const payrollId = payload.entries.find(
    (e) => e.values.category === "payroll",
  )!.id;
  const saleId = payload.entries.find((e) => e.kind === "sale")!.id;
  for (const next of [
    forged(
      "sale",
      { boxes: "1", lineMan: "350" },
      { role: "branch", branch: "ศาลาแดง" },
    ),
    forged("pay", { category: "payroll", amount: "1", employee: "x" }),
    forged("void", { targetId: payrollId }),
    forged("void", { targetId: saleId }),
    forged("entryEdit", { targetId: saleId, "to.boxes": "1" }),
  ])
    expect(() => saveState(db, manager, next, revision)).toThrow(
      "Entry kind is not allowed for this account",
    );
  for (const next of [
    forged("config", { boxPrice: "400" }),
    { ...payload, config: { ...payload.config, boxPrice: "400" } },
  ])
    expect(() => saveState(db, manager, next, revision)).toThrow(
      "Only the Owner changes settings",
    );
  // A stored sale the manager's copy changed is refused; one it only lacks money on is put back.
  const tampered = structuredClone(payload);
  tampered.entries.find((e) => e.id === saleId)!.values.boxes = "999";
  expect(() => saveState(db, manager, tampered, revision)).toThrow(
    "Existing history cannot be changed",
  );
  expect(readState(db).payload).toEqual(sample);

  const next = stamp(
    mutate(
      payload,
      manager,
      "pay",
      { category: "rent", amount: "100" },
      "",
      today(),
    ),
  );
  const saved = saveState(db, manager, next, revision).payload;
  expect(saved.entries.slice(0, sample.entries.length)).toEqual(sample.entries);
  expect(saved.entries.at(-1)).toMatchObject({
    kind: "pay",
    actor: "manager",
    values: { category: "rent", amount: "100" },
  });
  expect(saved.config).toEqual(sample.config);
});

test("a branch's copy holds its own entries and the cut-down stock lines, nothing else", () => {
  const sample = sampleData(today());
  const { payload } = loadState(stored(sample), minburi);
  expect(payload.entries.filter((e) => e.role === "branch")).toEqual(
    sample.entries.filter((e) => e.role === "branch" && e.branch === "มีนบุรี"),
  );
  // What the Account Manager bought for it: what and how many, no amount, payer or detail.
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
  expect(scoped.config).toEqual({ packKg: "0.12", materialList: "[]" });
  expect(scopeDatabase(state, []).entries).toEqual([]);

  // manager_strip_entries
  const managerSees: Record<string, Values> = tagged(sqlTest, "manager");
  expect(stripForManager(state).entries).toEqual(
    state.entries.map((e) => withValues(e.id, managerSees[e.id] ?? e.values)),
  );

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
  ).toBe("s1,r1,r0,ov,m0,ps,pse,psv,pb,oe,mc,a1,a2,a3,a4,e1,e2,v1,v2,v3");

  // save_app_state, as the Account Manager, from the copy it loads
  const saves: [Partial<Entry>, string][] = tagged(sqlTest, "saves");
  for (const [entry, error] of saves) {
    const { payload, revision } = loadState(db, manager);
    const added = {
      lotId: "",
      branch: "",
      date: "2026-09-10",
      ...entry,
      actor: "manager",
    } as Entry;
    expect(
      errorOf(() =>
        saveState(
          db,
          manager,
          { ...payload, entries: [...payload.entries, added] },
          revision,
        ),
      ),
      JSON.stringify(entry),
    ).toBe(error);
  }
  const log = readState(db).payload.entries;
  expect(log.slice(0, state.entries.length)).toEqual(state.entries);
  expect(
    log
      .slice(state.entries.length)
      .map((e) => e.id)
      .join(),
  ).toBe("a1,a2,a3,a4,e1,e2,v1,v2,v3,v4,n1,n3");
});

test("a branch appends only its own branch's kinds, the centre writes none of its notes, and what the centre buys for it reaches it alone", () => {
  const db = stored(sampleData(today()));
  const { revision } = loadState(db, saladaeng);
  const entry = (over: Partial<Entry>): Entry => ({
    id: crypto.randomUUID(),
    kind: "meatCount",
    role: "branch",
    lotId: "",
    branch: "ศาลาแดง",
    date: today(),
    at: "",
    values: { kg: "5" },
    ...over,
  });
  const refused: [Partial<Entry>, string][] = [
    [{ branch: "มีนบุรี" }, "Entry branch does not match signed-in account"],
    [{ role: "owner" }, "Entry role does not match signed-in account"],
    [{ actor: "owner" }, "Entry actor does not match signed-in account"],
    [{ kind: "purchase" }, "Entry kind is not allowed for this account"],
    [{ kind: "config" }, "Entry kind is not allowed for this account"],
    [{ kind: "closeDay" }, "Entry kind is not allowed for this account"],
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

  // A branch's notes are the branch's: the Owner and the Account Manager jot none, change none
  // and undo no change to one, whatever a tampered client stamps on the entry.
  const copy = loadState(db, manager);
  const full = loadState(db, owner).payload;
  const noteId = full.entries.find((e) => e.role === "branch")!.id;
  const change = (kind: EntryKind, targetId: string, id?: string) =>
    entry({
      kind,
      role: "owner",
      branch: "",
      values: { targetId },
      ...(id ? { id } : {}),
    });
  const centre: [typeof owner, Entry[]][] = [
    [owner, [entry({ branch: "มีนบุรี" })]],
    [owner, [entry({ branch: "มีนบุรี", actor: "owner" })]],
    [owner, [change("entryEdit", noteId)]],
    [owner, [change("void", noteId)]],
    [manager, [entry({ branch: "มีนบุรี", actor: "manager" })]],
  ];
  for (const [account, added] of centre)
    expect(
      () =>
        saveState(
          db,
          account,
          {
            ...(account === owner ? full : copy.payload),
            entries: [
              ...(account === owner ? full : copy.payload).entries,
              ...added,
            ],
          },
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

  // V2-PAY-05: the Account Manager still buys for มีนบุรี.
  const next = mutate(
    copy.payload,
    manager,
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
  next.entries = next.entries.map((e, index) =>
    index < copy.payload.entries.length ? e : { ...e, actor: "manager" },
  );
  saveState(db, manager, next, copy.revision);
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
