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
  mutate,
  saleCost,
  type Database,
  type Role,
  type Values,
  type EntryKind,
} from "@/lib/store";
import { day, dispatch, last, readyToDispatch, ready, setup } from "./fixtures";

/* append_entries (migration 0032) through its JS port: a branch loads its role-scoped copy,
 * runs mutate on it as the app does, and saves only the delta. */
function save(
  full: Database,
  accountId: string,
  role: Role,
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
  s.run("owner", "allocate", {
    branch: "ศาลาแดง",
    kg: "30",
    deliveryDate: day,
  });
  s.run("branch", "receive", { kg: "30", allocation: last(s).id });
  s.run("branch", "thaw", { kg: "30" });
  const sale = {
    boxes: "0",
    addons: "10",
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
  // SRV-02: no stage. Values move; a lot's identity and a purchase PO stay the Owner's.
  expect(append(branch, [], [{ ...lot, values: "x" }])).toThrow("workflow");
  expect(
    append(branch, [], [{ ...lot, id: "F000000-001", poId: "PO-2026-0009" }]),
  ).toThrow("Only an owner");
  expect(append(branch, [], [{ ...lot, id: "new" }])).toThrow(
    "Only an owner can add or remove lots",
  );
  expect(readState(db).revision).toBe(revision);
});
