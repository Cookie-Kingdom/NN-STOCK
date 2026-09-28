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
import {
  day,
  dispatch,
  last,
  packingList,
  readyToDispatch,
  ready,
  setup,
} from "./fixtures";

/* append_entries (migration 0030) through its JS port: a non-owner loads its role-scoped copy,
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

test("Chef House moves a lot from its scoped copy without losing what it never received", () => {
  const s = setup();
  readyToDispatch(s, "50");
  dispatch(s);
  packingList(s, "25\n25");
  s.run("cm", "smokeOrderAccept", { acceptedBy: "Chef House" });
  const lotId = s.db.lots.at(-1)!.id;
  const input = { receivedBoxes: "24.5\n24.5", arrival: "08:00" };
  const expected = mutate(s.db, "cm", "cmReceive", input, lotId, day);
  const { delta, stored } = save(s.db, "chef", "cm", "cmReceive", input, lotId);
  expect(delta.lots[0].values.lines).toBeUndefined();
  expect(stored.lots).toEqual(expected.lots);
  expect(stored.entries.at(-1)!.values).toEqual(
    expected.entries.at(-1)!.values,
  );
});

test("Foodiva's truck updates the batch values from the scoped copy", () => {
  const s = setup();
  readyToDispatch(s, "50");
  const lotId = s.db.lots.at(-1)!.id;
  const send = {
    pickupDate: day,
    pickupTime: "06:30",
    origin: "กรุงเทพ",
    destination: "เชียงใหม่",
    trip: "ไปกลับ",
  };
  const expected = mutate(s.db, "foodiva", "dispatch", send, lotId, day);
  const { stored } = save(s.db, "foodiva", "foodiva", "dispatch", send, lotId);
  expect(stored.lots).toEqual(expected.lots);
});

test("GEN-09 Chef House opens a batch and records its first entry in one save", () => {
  const s = setup();
  readyToDispatch(s, "50");
  const input = { receivedBoxes: "20\n20", arrival: "08:00" };
  const { delta, stored } = save(s.db, "chef", "cm", "cmReceive", input, "");
  const [batch] = delta.lots;
  // The random suffix keeps the id apart from batches Chef House cannot see.
  expect(batch.id).toMatch(/^S\d{6}-\d{3}-[0-9a-f]{4}$/);
  expect(stored.lots.filter((lot) => lot.id === batch.id)).toHaveLength(1);
  expect(stored.lots).toHaveLength(s.db.lots.length + 1);
  expect(stored.entries.at(-1)!.lotId).toBe(batch.id);
});

test("append_entries refuses what save_app_state refuses", () => {
  const s = setup();
  readyToDispatch(s, "50");
  const db = openLocalDb(":memory:");
  const { revision } = replaceState(db, s.db);
  const chef = accountById("chef");
  const foodiva = accountById("foodiva");
  const lot = s.db.lots.at(-1)!;
  const entry = (values: Partial<Database["entries"][number]> = {}) => ({
    id: crypto.randomUUID(),
    kind: "cmReceive",
    role: "cm" as const,
    lotId: lot.id,
    branch: "ศาลาแดง",
    date: day,
    at: "",
    values: {},
    ...values,
  });
  const append =
    (
      account: typeof chef,
      entries: unknown[],
      lots: unknown[] = [],
      rev = revision,
    ) =>
    () =>
      appendState(db, account, entries, lots, rev);

  expect(append(chef, [entry()], [], revision - 1)).toThrow(
    "State changed on another device. Reload and try again.",
  );
  expect(append(accountById("owner"), [])).toThrow("append entries");
  expect(append(chef, [entry({ kind: "sale" })])).toThrow(
    "kind is not allowed",
  );
  expect(append(chef, [entry({ role: "branch" })])).toThrow(
    "role does not match",
  );
  expect(append(chef, [entry({ id: s.db.entries[0].id })])).toThrow(
    "id must be unique",
  );
  expect(append(chef, [entry({ lotId: "nope" })])).toThrow(
    "lot does not exist",
  );
  expect(append(chef, [entry({ branch: "มีนบุรี" })])).toThrow(
    "branch does not match",
  );
  // SRV-02: no stage. Values move; a lot's identity and a purchase PO stay the Owner's.
  expect(append(chef, [], [{ ...lot, values: "x" }])).toThrow("workflow");
  expect(
    append(foodiva, [], [{ ...lot, id: "F000000-001", poId: "PO-2026-0009" }]),
  ).toThrow("Only an owner");
  expect(append(foodiva, [], [{ ...lot, id: "new" }])).toThrow(
    "Only an owner can add or remove lots",
  );
  expect(readState(db).revision).toBe(revision);
});
