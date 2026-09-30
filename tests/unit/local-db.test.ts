import { expect, test } from "vitest";
import { accountById } from "@/lib/accounts";
import {
  loadState,
  openLocalDb,
  readState,
  replaceState,
  saveState,
} from "@/lib/local-db.server";
import { mutate, type Database, type Entry } from "@/lib/store";
import { day, readyToDispatch, send, setup } from "./fixtures";

const owner = accountById("owner");
const saladaeng = accountById("saladaeng");
const entry = (role: string, branch: string): Entry =>
  ({
    id: crypto.randomUUID(),
    kind: "sale",
    role,
    lotId: "",
    branch,
    date: "2026-09-15",
    at: "",
    values: {},
  }) as Entry;

test("starts from the seed and bumps the revision on each save", () => {
  const db = openLocalDb(":memory:");
  const { payload, revision } = readState(db);
  expect(revision).toBe(1);
  const saved = saveState(
    db,
    owner,
    { ...payload, entries: [entry("owner", "")] },
    1,
  );
  expect(saved.revision).toBe(2);
  expect(readState(db).payload.entries).toHaveLength(1);
});

test("mirrors the save_app_state guards", () => {
  const db = openLocalDb(":memory:");
  const { payload } = readState(db);
  const withEntry = saveState(
    db,
    owner,
    { ...payload, entries: [entry("owner", "")] },
    1,
  ).payload;

  expect(() => saveState(db, null, withEntry, 2)).toThrow(
    "Authentication required",
  );
  expect(() => saveState(db, owner, withEntry, 1)).toThrow("State changed");
  expect(() => saveState(db, owner, { ...withEntry, entries: [] }, 2)).toThrow(
    "cannot be removed",
  );
  // 0034: a branch saves through append_entries only, even its own entry.
  expect(() =>
    saveState(
      db,
      saladaeng,
      {
        ...withEntry,
        entries: [...withEntry.entries, entry("branch", "ศาลาแดง")],
      },
      2,
    ),
  ).toThrow("Branch accounts save through append_entries");
});

test("the Account Manager's entries carry its actor, and nobody else's may", () => {
  const db = openLocalDb(":memory:");
  const { payload } = readState(db);
  const manager = accountById("manager");
  const mine: Entry = { ...entry("owner", ""), actor: "manager" };
  expect(() =>
    saveState(db, manager, { ...payload, entries: [entry("owner", "")] }, 1),
  ).toThrow("actor does not match");
  expect(() =>
    saveState(
      db,
      manager,
      { ...payload, entries: [{ ...mine, role: "branch" }] },
      1,
    ),
  ).toThrow("role does not match");
  expect(() =>
    saveState(db, owner, { ...payload, entries: [mine] }, 1),
  ).toThrow("actor does not match");
  expect(
    saveState(db, manager, { ...payload, entries: [mine] }, 1).revision,
  ).toBe(2);
});

// M1: Foodiva and Chef House are partners, not users. The Owner (actor "owner") and the Account
// Manager (actor "manager", stamped by persistence.ts) record their work.
test("the Owner and the Account Manager save Foodiva / Chef House work", () => {
  const s = setup();
  readyToDispatch(s, "50");
  const lotId = s.db.lots.at(-1)!.id;
  const db = openLocalDb(":memory:");
  let { revision } = replaceState(db, s.db);
  const manager = accountById("manager");
  // What the Manager's browser sends: its copy (no sale money) plus the entry, stamped.
  const managerSave = (next: Database) => {
    const base = loadState(db, manager).payload;
    const added = next.entries.slice(base.entries.length);
    return {
      ...next,
      entries: [
        ...base.entries,
        ...added.map((e) => ({ ...e, actor: "manager" as const })),
      ],
    };
  };

  const dispatched = mutate(s.db, "owner", "dispatch", send, lotId, day);
  expect(dispatched.entries.at(-1)).toMatchObject({
    role: "foodiva",
    actor: "owner",
  });
  revision = saveState(db, manager, managerSave(dispatched), revision).revision;
  expect(readState(db).payload.entries.at(-1)).toMatchObject({
    kind: "dispatch",
    role: "foodiva",
    actor: "manager",
  });

  const input = { receivedBoxes: "24.5\n24.5", arrival: "08:00" };
  const stored = readState(db).payload;
  const received = mutate(stored, "owner", "cmReceive", input, lotId, day);
  // The Manager must stamp its own name, not the Owner's.
  expect(() => saveState(db, manager, received, revision)).toThrow(
    "actor does not match",
  );
  revision = saveState(db, manager, managerSave(received), revision).revision;
  expect(readState(db).payload.entries.at(-1)).toMatchObject({
    kind: "cmReceive",
    role: "cm",
    actor: "manager",
  });

  // The Owner's own partner entry keeps actor "owner"; "owner" on its own entry is refused.
  const ownerNext = mutate(
    readState(db).payload,
    "owner",
    "prepare",
    { preSmokeKg: "40" },
    lotId,
    day,
  );
  const ownerEntry = ownerNext.entries.at(-1)!;
  expect(() =>
    saveState(
      db,
      owner,
      {
        ...ownerNext,
        entries: [
          ...ownerNext.entries.slice(0, -1),
          { ...ownerEntry, role: "owner" },
        ],
      },
      revision,
    ),
  ).toThrow("actor does not match");
  revision = saveState(db, owner, ownerNext, revision).revision;
  expect(readState(db).payload.entries.at(-1)!.actor).toBe("owner");
  // A branch claiming to be the Owner: appendEntries.test.ts (save_app_state refuses a branch).
});

test("load without a signed-in account is refused", () => {
  // GET /api/local-db maps a missing, unknown or stale cookie to null.
  expect(() => loadState(openLocalDb(":memory:"), null)).toThrow(
    "Authentication required",
  );
});
