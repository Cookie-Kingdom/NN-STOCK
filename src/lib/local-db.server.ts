import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import type { Account } from "./accounts";
import { scopeDatabase } from "./role-scope";
import { restoreSaleMoney, stripSaleMoney } from "./sale-money";
import {
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

/** Kinds a branch may append: `ownership` in store/mutate.ts plus editRequest, link and
 *  void (a branch only voids its own pending edit request; derived.ts ignores any other). */
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
  "void",
];
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
const without = (value: object, ...keys: string[]) =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key)),
  );

/** JS port of `save_app_state` (latest in supabase/migrations/20260929000032_retire_supplier_cm_accounts.sql).
 * ponytail: duplicated rules, keep in step with that function when it changes. */
export function saveState(
  db: DatabaseSync,
  account: Account | null,
  input: unknown,
  expectedRevision: number | null,
): AppStateRow {
  if (!account) fail("Authentication required");
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
  const role = account!.role;
  if (role !== "owner" && !isDeepStrictEqual(payload.config, old.config))
    fail("Only an owner can change configuration");
  if (
    role !== "owner" &&
    (payload.version !== 9 ||
      !isDeepStrictEqual(
        without(payload, "entries", "lots"),
        without(old, "entries", "lots"),
      ))
  )
    fail("Only an owner can change application state");
  if (payload.entries.length < old.entries.length)
    fail("Existing history cannot be removed");
  if (
    old.entries.some(
      (entry, index) => !isDeepStrictEqual(entry, payload.entries[index]),
    )
  )
    fail("Existing history cannot be changed");
  // The Account Manager stamps every new entry (owner / foodiva / cm); the Owner may stamp
  // "owner" on a partner's entry it typed (M0); a branch stamps nothing.
  const manager = account!.id === "manager";
  for (const entry of payload.entries.slice(old.entries.length)) {
    const actorOk = manager
      ? entry?.actor === "manager"
      : role === "owner"
        ? entry?.actor === undefined ||
          (entry.actor === "owner" &&
            (entry.role === "foodiva" || entry.role === "cm"))
        : entry?.actor === undefined;
    if (!actorOk) fail("Entry actor does not match signed-in account");
    if (manager && !["owner", "foodiva", "cm"].includes(entry.role))
      fail("Entry role does not match signed-in account");
  }
  if (role !== "owner") {
    const added = payload.entries.slice(old.entries.length);
    for (const entry of added) {
      if (entry?.role !== "branch")
        fail("Entry role does not match signed-in account");
      if (entry.branch !== account!.branch)
        fail("Entry branch does not match signed-in account");
    }
    for (const entry of added) {
      if (!branchKinds.includes(entry.kind))
        fail("Entry kind is not allowed for this account");
      if (
        !entry.id ||
        payload.entries.filter((other) => other?.id === entry.id).length > 1
      )
        fail("Entry id must be unique");
      if (
        entry.lotId &&
        entry.lotId !== "-" &&
        !payload.lots.some((lot) => lot?.id === entry.lotId)
      )
        fail("Entry lot does not exist");
    }
    // SRV-02: no workflow step to check. A lot keeps its identity; only its values cache
    // moves (DM-09), and a new shipment batch may be opened (GEN-09).
    if (payload.lots.length < old.lots.length)
      fail("Only an owner can remove lots");
    old.lots.forEach((lot, index) => {
      const next = payload.lots[index];
      if (
        !next ||
        !isDeepStrictEqual(without(next, "values"), without(lot, "values")) ||
        !isObject(next.values)
      )
        fail("Lot changes must follow the workflow");
    });
    if (
      payload.lots
        .slice(old.lots.length)
        .some(
          (lot) =>
            !isShipmentLot(lot) ||
            !isObject(lot.values) ||
            payload.lots.filter((other) => other?.id === lot.id).length > 1,
        )
    )
      fail("Only an owner can add or remove lots");
  }
  return replaceState(db, payload);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** A new shipment batch as `mutate` opens one: `S<yymmdd>-NNN-xxxx` / `SH-…` ids, kind
 *  "shipment" (is_new_batch, migration 20260928000031). */
const isShipmentLot = (lot: unknown): lot is Lot =>
  isObject(lot) &&
  lot.kind === "shipment" &&
  typeof lot.id === "string" &&
  /^S\d{6}-\d{3}-[0-9a-f]{4}$/.test(lot.id) &&
  typeof lot.poId === "string" &&
  /^SH-\d{4}-\d{4}$/.test(lot.poId);

/** JS port of `append_entries` (supabase/migrations/20260929000032_retire_supplier_cm_accounts.sql):
 * a branch save, which sends only its new entries and changed lots.
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

  const workflow = "Lot changes must follow the workflow";
  if (new Set(changes.map((lot) => lot.id)).size !== changes.length)
    fail(workflow);
  const lots = [...old.lots];
  for (const change of changes) {
    const index = old.lots.findIndex((lot) => lot?.id === change.id);
    if (index < 0) {
      // GEN-09: a new shipment batch.
      if (!isShipmentLot(change) || lots.some((lot) => lot?.id === change.id))
        fail("Only an owner can add or remove lots");
      lots.push({ ...change, values: change.values ?? {} });
      continue;
    }
    const lot = old.lots[index];
    if (!isObject(change.values ?? {})) fail(workflow);
    // Only values are taken (DM-09); they merge over the stored ones.
    lots[index] = { ...lot, values: { ...lot.values, ...change.values } };
  }
  // After the lots: a batch opened in this save counts (as in append_entries).
  if (
    added.some(
      (entry) =>
        entry.lotId &&
        entry.lotId !== "-" &&
        !lots.some((lot) => lot?.id === entry.lotId),
    )
  )
    fail("Entry lot does not exist");

  // BR-05: a sale's meat cost is never stored; `saleCost` reads it, so a scoped copy sends none.
  const costKeys = ["meatCost", "wasteCost"].flatMap((key) => [
    key,
    `to.${key}`,
    `from.${key}`,
  ]);
  const entries = added.map((entry) => ({
    ...entry,
    values: without(entry.values, ...costKeys) as Entry["values"],
  }));
  return replaceState(db, {
    ...old,
    lots,
    entries: [...old.entries, ...entries],
  });
}

/** Writes the state with no guards. saveState calls it after its checks; on its own
 * it is e2e setup only (PUT /api/local-db, used by loadSampleData in tests/e2e/helpers.ts). */
export function replaceState(db: DatabaseSync, payload: Database): AppStateRow {
  db.prepare("update app_state set payload = ?, revision = revision + 1").run(
    JSON.stringify(payload),
  );
  return readState(db);
}
