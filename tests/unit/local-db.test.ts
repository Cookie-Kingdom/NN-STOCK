import { expect, test } from "vitest";
import { accountById } from "@/lib/accounts";
import { openLocalDb, readState, saveState } from "@/lib/local-db.server";
import type { Entry } from "@/lib/store";

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
  expect(() =>
    saveState(
      db,
      saladaeng,
      { ...withEntry, entries: [...withEntry.entries, entry("cm", "ศาลาแดง")] },
      2,
    ),
  ).toThrow("role does not match");
  expect(() =>
    saveState(
      db,
      saladaeng,
      {
        ...withEntry,
        entries: [...withEntry.entries, entry("branch", "มีนบุรี")],
      },
      2,
    ),
  ).toThrow("branch does not match");
  expect(() =>
    saveState(
      db,
      saladaeng,
      { ...withEntry, config: { ...withEntry.config, boxPrice: "1" } },
      2,
    ),
  ).toThrow("Only an owner");
  expect(
    saveState(
      db,
      saladaeng,
      {
        ...withEntry,
        entries: [...withEntry.entries, entry("branch", "ศาลาแดง")],
      },
      2,
    ).revision,
  ).toBe(3);
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
