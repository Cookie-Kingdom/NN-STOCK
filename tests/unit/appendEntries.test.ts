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
  type Database,
  type ActingRole,
  type Values,
  type EntryKind,
} from "@/lib/store";
import { day, dispatch, last, readyToDispatch, ready, setup } from "./fixtures";

/* append_entries (migration 0034) through its JS port: a branch loads its role-scoped copy,
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
  const after = appendState(
    db,
    branch,
    [entry("receive")],
    [],
    closed.revision,
  );
  appendState(db, branch, [entry("editRequest")], [], after.revision);
  expect(
    readState(db).payload.entries.filter((e) => e.kind === "receive"),
  ).toHaveLength(2);
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
