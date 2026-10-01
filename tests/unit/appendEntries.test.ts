import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { accountById } from "@/lib/accounts";
import { appendDelta } from "@/lib/app-state-delta";
import {
  appendState,
  loadState,
  openLocalDb,
  readState,
  replaceState,
} from "@/lib/local-db.server";
import {
  balance,
  mutate,
  saleCost,
  titles,
  voidableKinds,
  type Database,
  type ActingRole,
  type Values,
  type EntryKind,
} from "@/lib/store";
import { editableKinds, entryKinds } from "@/lib/store/model";
import { day, dispatch, last, readyToDispatch, ready, setup } from "./fixtures";

/* append_entries (latest in migration 0040) through its JS port: a branch loads its role-scoped copy,
 * runs mutate on it as the app does, and saves only the delta. */
function save(
  full: Database,
  accountId: string,
  role: ActingRole,
  kind: EntryKind,
  input: Values,
  lotId: string,
  branch = "",
) {
  const db = openLocalDb(":memory:");
  replaceState(db, full);
  const account = accountById(accountId);
  const { payload, revision } = loadState(db, account);
  const next = mutate(payload, role, kind, input, lotId, day, branch);
  const delta = appendDelta(payload, next);
  appendState(db, account, delta.entries, delta.lots, revision);
  return { db, delta, stored: readState(db).payload };
}

test("appendDelta keeps only new entries (by id) and changed lots", () => {
  const s = setup();
  readyToDispatch(s, "50");
  const base = s.db;
  dispatch(s);
  const delta = appendDelta(base, s.db);
  expect(delta.entries).toEqual([last(s)]);
  expect(delta.lots).toEqual([s.db.lots.at(-1)]);
  expect(appendDelta(s.db, s.db)).toEqual({ entries: [], lots: [] });
});

test("BR-05 a branch sale stores no meat cost; saleCost prices it from the full data", () => {
  const s = ready();
  const lotId = s.db.lots.at(-1)!.id;
  s.run("branch", "receive", { kg: "30" });
  s.run("branch", "thaw", { kg: "30" });
  const sale = {
    boxes: "0",
    chiliAddons: "0",
    soldKg: "1",
    wasteKg: "0.5",
    reason: "ตัดแต่ง",
    riceWasteKg: "0",
    expense: "0",
    lineMan: "3200",
  };
  const expected = mutate(
    s.db,
    "branch",
    "sale",
    sale,
    lotId,
    day,
    "ศาลาแดง",
  ).entries.at(-1)!;
  expect(expected.values.meatCost).toBeUndefined();
  const { delta, stored } = save(
    s.db,
    "saladaeng",
    "branch",
    "sale",
    sale,
    lotId,
    "ศาลาแดง",
  );
  expect(delta.entries[0].values.meatCost).toBeUndefined();
  expect(stored.entries.at(-1)!.values).toEqual(expected.values);
  // The scoped copy has no prices; the full data prices the sale at read time.
  expect(saleCost(stored, stored.entries.at(-1)!).meatCost).toBeGreaterThan(0);
});

test("append_entries refuses what save_app_state refuses", () => {
  const s = setup();
  readyToDispatch(s, "50");
  const db = openLocalDb(":memory:");
  const { revision } = replaceState(db, s.db);
  const branch = accountById("saladaeng");
  const lot = s.db.lots.at(-1)!;
  const entry = (values: Partial<Database["entries"][number]> = {}) => ({
    id: crypto.randomUUID(),
    kind: "receive",
    role: "branch" as const,
    lotId: lot.id,
    branch: "ศาลาแดง",
    date: day,
    at: "",
    values: {},
    ...values,
  });
  const append =
    (
      account: typeof branch,
      entries: unknown[],
      lots: unknown[] = [],
      rev = revision,
    ) =>
    () =>
      appendState(db, account, entries, lots, rev);

  expect(append(branch, [entry()], [], revision - 1)).toThrow(
    "State changed on another device. Reload and try again.",
  );
  expect(append(accountById("owner"), [])).toThrow(
    "Only branch accounts append entries",
  );
  expect(append(branch, [entry({ kind: "cmReceive" })])).toThrow(
    "kind is not allowed",
  );
  expect(append(branch, [entry({ role: "cm" })])).toThrow(
    "role does not match",
  );
  expect(append(branch, [entry({ actor: "owner" })])).toThrow(
    "actor does not match",
  );
  expect(append(branch, [entry({ id: s.db.entries[0].id })])).toThrow(
    "id must be unique",
  );
  expect(append(branch, [entry({ lotId: "nope" })])).toThrow(
    "lot does not exist",
  );
  expect(append(branch, [entry({ branch: "มีนบุรี" })])).toThrow(
    "branch does not match",
  );
  // A branch never changes a lot: lotCost reads outboundCost / returnCost / centralKg from it.
  expect(
    append(
      branch,
      [],
      [{ ...lot, values: { ...lot.values, outboundCost: "0" } }],
    ),
  ).toThrow("Only an owner can change lots");
  expect(append(branch, [], [{ ...lot, id: "new" }])).toThrow(
    "Only an owner can change lots",
  );
  expect(append(branch, [entry({ date: "2999-01-01" })])).toThrow(
    "after today",
  );
  expect(readState(db).revision).toBe(revision);
});

test("append_entries takes entries on a closed branch day (0037: mutate only warns)", () => {
  const s = setup();
  const db = openLocalDb(":memory:");
  const { revision } = replaceState(db, s.db);
  const branch = accountById("saladaeng");
  const entry = (kind: string, id = crypto.randomUUID()) => ({
    id,
    kind,
    role: "branch" as const,
    lotId: "",
    branch: "ศาลาแดง",
    date: day,
    at: "",
    values: {},
  });
  const closed = appendState(
    db,
    branch,
    [entry("closeDay"), entry("receive")],
    [],
    revision,
  );
  const received = entry("receive");
  const after = appendState(db, branch, [received], [], closed.revision);
  // 0039: and an edit of its own entry, where it took an edit request before.
  appendState(
    db,
    branch,
    [{ ...entry("entryEdit"), values: { targetId: received.id } }],
    [],
    after.revision,
  );
  expect(
    readState(db).payload.entries.filter((e) => e.kind === "receive"),
  ).toHaveLength(2);
});

// 0039: what mutate writes for a branch's own edit, delete and restore is what append_entries
// takes: entries only, no lot.
test("a branch saves its own edit, delete and restore as mutate writes them", () => {
  const s = ready();
  const lotId = s.db.lots.at(-1)!.id;
  s.run("branch", "receive", { kg: "30" });
  const receive = last(s);
  const db = openLocalDb(":memory:");
  replaceState(db, s.db);
  const account = accountById("saladaeng");
  const change = (kind: EntryKind, input: Values) => {
    const { payload, revision } = loadState(db, account);
    const next = mutate(payload, "branch", kind, input, "", day, "ศาลาแดง");
    const delta = appendDelta(payload, next);
    expect(delta.lots).toEqual([]);
    appendState(db, account, delta.entries, delta.lots, revision);
    return delta.entries.at(-1)!;
  };
  const received = () =>
    balance(readState(db).payload, lotId, "ศาลาแดง").received;
  const edit = change("entryEdit", {
    targetId: receive.id,
    values: JSON.stringify({ kg: "20" }),
    reason: "ชั่งใหม่",
  });
  expect(received()).toBe(20);
  change("void", { targetId: edit.id, reason: "แก้ผิด" });
  expect(received()).toBe(30);
  const removed = change("void", { targetId: receive.id, reason: "ซ้ำ" });
  expect(received()).toBe(0);
  change("void", { targetId: removed.id, reason: "ลบผิด" });
  expect(received()).toBe(30);
});

// 0039: append_entries names the kinds no edit and no delete may target; they are the store's.
test("the SQL edit / delete kind lists (migration 0040) are the store's", () => {
  const sql = readFileSync(
    "supabase/migrations/20261001000040_branch_self_receive.sql",
    "utf8",
  );
  const list = (name: string) =>
    [
      ...(sql
        .match(
          new RegExp(`${name} constant text\\[\\] := array\\[(.*?)\\]`),
        )?.[1]
        .matchAll(/'(\w+)'/g) ?? []),
    ]
      .map((match) => match[1])
      .sort();
  const outside = (kinds: EntryKind[]) =>
    (Object.keys(titles) as EntryKind[])
      .filter((kind) => !kinds.includes(kind))
      .sort();
  expect(list("not_editable")).toEqual(outside(editableKinds));
  expect(list("not_voidable")).toEqual(outside(voidableKinds));
});

// 0040: the kinds a branch may write are kept by hand in three places. append_entries and its JS
// port (branchKinds) take what mutate records for a branch: its own kinds less the retired ones,
// plus the changes to its own entries (entryEdit, link, void).
test("the branch kinds of append_entries (migration 0040), its JS port and mutate are the same", () => {
  const sql = readFileSync(
    "supabase/migrations/20261001000040_branch_self_receive.sql",
    "utf8",
  );
  const allowed = [
    ...(sql
      .match(/'kind' = any \(array\[([\s\S]*?)\]\)/)?.[1]
      .matchAll(/'(\w+)'/g) ?? []),
  ]
    .map((match) => match[1])
    .sort();
  const refusal = (save: () => unknown) => {
    try {
      save();
      return "";
    } catch (error) {
      return (error as Error).message;
    }
  };
  const s = setup();
  const db = openLocalDb(":memory:");
  replaceState(db, s.db);
  const ported = entryKinds.filter(
    (kind) =>
      refusal(() =>
        appendState(
          db,
          accountById("saladaeng"),
          [
            {
              id: crypto.randomUUID(),
              kind,
              role: "branch",
              lotId: "",
              branch: "ศาลาแดง",
              date: day,
              at: "",
              values: {},
            },
          ],
          [],
          readState(db).revision,
        ),
      ) !== "Entry kind is not allowed for this account",
  );
  const recorded = entryKinds.filter(
    (kind) =>
      !["บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้", "รายการชนิดนี้เลิกใช้แล้ว"].includes(
        refusal(() => mutate(s.db, "branch", kind, {}, "", day, "ศาลาแดง")),
      ),
  );
  expect(allowed.length).toBeGreaterThan(0);
  expect([...ported].sort()).toEqual(allowed);
  expect([...recorded].sort()).toEqual(allowed);
});

test("append_entries and entries() refuse a link to another branch's or the Owner's entry", () => {
  const s = ready();
  const batch = s.db.lots.at(-1)!.id;
  s.run("branch", "receive", { kg: "10" }, "");
  const receive = last(s);
  const owners = s.db.entries.find((e) => e.role === "owner")!;
  const db = openLocalDb(":memory:");
  const { revision } = replaceState(db, s.db);
  const link = (targetId: string, branch: string) => ({
    id: crypto.randomUUID(),
    kind: "link" as const,
    role: "branch" as const,
    lotId: "",
    branch,
    date: day,
    at: "",
    values: { targetId, lotId: batch },
  });
  const minburi = accountById("minburi");
  expect(() =>
    appendState(db, minburi, [link(receive.id, "มีนบุรี")], [], revision),
  ).toThrow("Link target is not an entry of this branch");
  expect(() =>
    appendState(db, minburi, [link(owners.id, "มีนบุรี")], [], revision),
  ).toThrow("Link target is not an entry of this branch");
  appendState(
    db,
    accountById("saladaeng"),
    [link(receive.id, "ศาลาแดง")],
    [],
    revision,
  );
  // A crafted link already in the log moves nothing.
  const crafted = {
    ...s.db,
    entries: [...s.db.entries, link(receive.id, "มีนบุรี")],
  };
  expect(balance(crafted, batch, "ศาลาแดง").received).toBe(0);
  expect(balance(crafted, "", "ศาลาแดง").received).toBe(10);
});
