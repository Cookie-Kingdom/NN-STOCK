import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import type { Account } from "./accounts";
import { seed, type Database } from "./store";

export type AppStateRow = { payload: Database; revision: number };

/** Opens (or creates) the SQLite file and seeds the singleton row, the state a
 * Supabase project is in after the owner's first sign-in. */
export function openLocalDb(file: string) {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(
    "create table if not exists app_state (singleton integer primary key check (singleton = 1), payload text not null, revision integer not null)",
  );
  db.prepare("insert or ignore into app_state values (1, ?, 1)").run(
    JSON.stringify(seed),
  );
  return db;
}

export function readState(db: DatabaseSync): AppStateRow {
  const row = db.prepare("select payload, revision from app_state").get() as {
    payload: string;
    revision: number;
  };
  return { payload: JSON.parse(row.payload), revision: row.revision };
}

const fail = (message: string): never => {
  throw new Error(message);
};

/** JS port of `save_app_state` (supabase/migrations/20260915000012_save_app_state_guards.sql).
 * ponytail: duplicated rules, keep in step with that function when it changes. */
export function saveState(
  db: DatabaseSync,
  account: Account | null,
  input: unknown,
  expectedRevision: number | null,
): AppStateRow {
  if (!account) fail("Authentication required");
  const payload = input as Database;
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray(payload.entries) ||
    !Array.isArray(payload.lots) ||
    typeof payload.config !== "object" ||
    payload.config === null ||
    Array.isArray(payload.config)
  )
    fail("Invalid application state");
  const { payload: old, revision } = readState(db);
  if (expectedRevision == null || expectedRevision !== revision)
    fail("State changed on another device. Reload and try again.");
  const role = account!.role;
  if (role !== "owner" && !isDeepStrictEqual(payload.config, old.config))
    fail("Only an owner can change configuration");
  if (payload.entries.length < old.entries.length)
    fail("Existing history cannot be removed");
  if (
    old.entries.some(
      (entry, index) => !isDeepStrictEqual(entry, payload.entries[index]),
    )
  )
    fail("Existing history cannot be changed");
  if (role !== "owner") {
    for (const entry of payload.entries.slice(old.entries.length)) {
      if (entry?.role !== role)
        fail("Entry role does not match signed-in account");
      if (role === "branch" && entry.branch !== account!.branch)
        fail("Entry branch does not match signed-in account");
    }
    if (payload.lots.length !== old.lots.length)
      fail("Only an owner can add or remove lots");
    old.lots.forEach((lot, index) => {
      const next = payload.lots[index];
      if (
        next?.id !== lot.id ||
        next.poId !== lot.poId ||
        !isDeepStrictEqual(next.config, lot.config) ||
        typeof next.stage !== "number" ||
        next.stage < lot.stage ||
        next.stage > lot.stage + 1
      )
        fail("Lot changes must follow the workflow");
    });
  }
  return replaceState(db, payload);
}

/** Writes the state with no guards. saveState calls it after its checks; on its own
 * it is e2e setup only (PUT /api/local-db, used by loadSampleData in tests/e2e/helpers.ts). */
export function replaceState(db: DatabaseSync, payload: Database): AppStateRow {
  db.prepare("update app_state set payload = ?, revision = revision + 1").run(
    JSON.stringify(payload),
  );
  return readState(db);
}
