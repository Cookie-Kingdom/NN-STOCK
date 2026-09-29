import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import type { Account } from "./accounts";
import { scopeDatabase } from "./role-scope";
import { restoreSaleMoney, stripSaleMoney } from "./sale-money";
import {
  canLink,
  isClosed,
  seed,
  type Database,
  type Entry,
  type Lot,
  type EntryKind,
} from "./store";

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

/** Like load_app_state: the Owner reads everything, the Account Manager a copy without sale
 * money (C4), a branch its role-scoped copy; Foodiva and Chef House accounts are retired
 * (load_app_state and scope_app_state in 20260929000033). */
export function loadState(
  db: DatabaseSync,
  account: Account | null,
): AppStateRow {
  // A missing, unknown or retired (e.g. old `chef`) cookie maps to null: never the full state.
  if (!account) fail("Authentication required");
  const row = readState(db);
  if (account!.role === "owner" && !account!.hidesSales) return row;
  if (account!.role === "owner")
    return { ...row, payload: stripSaleMoney(row.payload) };
  return {
    ...row,
    payload: scopeDatabase(
      row.payload,
      account!.branch ? [account!.branch] : [],
    ),
  };
}

const fail = (message: string): never => {
  throw new Error(message);
};

/** Kinds a branch may append: `ownership` in store/mutate.ts plus editRequest and link. */
const branchKinds: EntryKind[] = [
  "receive",
  "thaw",
  "supplyPurchase",
  "supplyIssue",
  "ricePurchase",
  "chiliPurchase",
  "riceIssue",
  "chiliIssue",
  "rice",
  "riceCarry",
  "sale",
  "influencerBox",
  "materials",
  "materialConfirm",
  "closeDay",
  "editRequest",
  "link",
];
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
const without = (value: object, ...keys: string[]) =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key)),
  );

/** JS port of `save_app_state` (latest in supabase/migrations/20260929000034_branch_append_guards.sql).
 * ponytail: duplicated rules, keep in step with that function when it changes. */
export function saveState(
  db: DatabaseSync,
  account: Account | null,
  input: unknown,
  expectedRevision: number | null,
): AppStateRow {
  if (!account) fail("Authentication required");
  if (account!.role !== "owner")
    fail("Branch accounts save through append_entries");
  if (Buffer.byteLength(JSON.stringify(input) ?? "") > MAX_PAYLOAD_BYTES)
    fail("Payload too large");
  let payload = input as Database;
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
  // The Account Manager saves from a copy without sale money (GET strips it): put it back.
  if (account!.hidesSales) payload = restoreSaleMoney(old, payload);
  if (expectedRevision == null || expectedRevision !== revision)
    fail("State changed on another device. Reload and try again.");
  if (payload.entries.length < old.entries.length)
    fail("Existing history cannot be removed");
  if (
    old.entries.some(
      (entry, index) => !isDeepStrictEqual(entry, payload.entries[index]),
    )
  )
    fail("Existing history cannot be changed");
  // The Account Manager stamps every new entry (owner / foodiva / cm); the Owner may stamp
  // "owner" on a partner's entry it typed (M0).
  const manager = account!.id === "manager";
  for (const entry of payload.entries.slice(old.entries.length)) {
    const actorOk = manager
      ? entry?.actor === "manager"
      : entry?.actor === undefined ||
        (entry.actor === "owner" &&
          (entry.role === "foodiva" || entry.role === "cm"));
    if (!actorOk) fail("Entry actor does not match signed-in account");
    if (manager && !["owner", "foodiva", "cm"].includes(entry.role))
      fail("Entry role does not match signed-in account");
  }
  return replaceState(db, payload);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** JS port of `append_entries` (supabase/migrations/20260929000034_branch_append_guards.sql):
 * a branch save, which sends only its new entries (its lots must be empty).
 * ponytail: duplicated rules, keep in step with that function (and saveState) when they change. */
export function appendState(
  db: DatabaseSync,
  account: Account | null,
  entryInput: unknown,
  lotInput: unknown,
  expectedRevision: number | null,
): AppStateRow {
  if (!account) fail("Authentication required");
  if (
    Buffer.byteLength(JSON.stringify(entryInput) ?? "") +
      Buffer.byteLength(JSON.stringify(lotInput) ?? "") >
    MAX_PAYLOAD_BYTES
  )
    fail("Payload too large");
  const role = account!.role;
  if (role !== "branch") fail("Only branch accounts append entries");
  const added = entryInput as Entry[];
  const changes = (lotInput ?? []) as Lot[];
  if (
    !Array.isArray(added) ||
    !Array.isArray(changes) ||
    added.some((entry) => !isObject(entry) || !isObject(entry.values)) ||
    changes.some((lot) => !isObject(lot))
  )
    fail("Invalid application state");
  const { payload: old, revision } = readState(db);
  if (expectedRevision == null || expectedRevision !== revision)
    fail("State changed on another device. Reload and try again.");
  if (added.some((entry) => entry.actor != null))
    fail("Entry actor does not match signed-in account");
  if (added.some((entry) => entry.role !== "branch"))
    fail("Entry role does not match signed-in account");
  if (added.some((entry) => entry.branch !== account!.branch))
    fail("Entry branch does not match signed-in account");
  if (added.some((entry) => !branchKinds.includes(entry.kind)))
    fail("Entry kind is not allowed for this account");
  const oldIds = new Set(old.entries.map((entry) => entry?.id));
  if (
    added.some(
      (entry) =>
        !entry.id ||
        oldIds.has(entry.id) ||
        added.filter((other) => other.id === entry.id).length > 1,
    )
  )
    fail("Entry id must be unique");

  // No branch kind opens a batch or writes the lot cache (lotCost reads it).
  if (changes.length) fail("Only an owner can change lots");
  if (
    added.some(
      (entry) =>
        entry.lotId &&
        entry.lotId !== "-" &&
        !old.lots.some((lot) => lot?.id === entry.lotId),
    )
  )
    fail("Entry lot does not exist");

  // BR-05: a sale's meat cost is never stored; `saleCost` reads it, so a scoped copy sends none.
  const costKeys = ["meatCost", "wasteCost"].flatMap((key) => [
    key,
    `to.${key}`,
    `from.${key}`,
  ]);
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  });
  // In log order, so an entry sees the ones before it in this save (a closeDay, a link target).
  const log = { ...old, entries: [...old.entries] };
  for (const entry of added) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? "") || entry.date > today)
      fail("Entry date is invalid or after today");
    if (entry.kind !== "editRequest" && isClosed(log, entry.branch, entry.date))
      fail("Branch day is closed");
    const target =
      entry.kind === "link" &&
      log.entries.find((other) => other?.id === entry.values.targetId);
    if (entry.kind === "link" && !(target && canLink(entry, target)))
      fail("Link target is not an entry of this branch");
    log.entries.push({
      ...entry,
      values: without(entry.values, ...costKeys) as Entry["values"],
    });
  }
  return replaceState(db, log);
}

/** Writes the state with no guards. saveState calls it after its checks; on its own
 * it is e2e setup only (PUT /api/local-db, used by loadSampleData in tests/e2e/helpers.ts). */
export function replaceState(db: DatabaseSync, payload: Database): AppStateRow {
  db.prepare("update app_state set payload = ?, revision = revision + 1").run(
    JSON.stringify(payload),
  );
  return readState(db);
}
