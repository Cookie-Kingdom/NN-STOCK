import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import type { Account } from "./accounts";
import { scopeDatabase } from "./role-scope";
import { restoreSaleMoney, stripSaleMoney } from "./sale-money";
import {
  branches,
  lotCost,
  n,
  seed,
  stageRole,
  type Database,
  type Entry,
  type Lot,
  type Role,
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
 * money (C4), every other role its role-scoped copy (migration 20260925000028). */
export function loadState(
  db: DatabaseSync,
  account: Account | null,
): AppStateRow {
  const row = readState(db);
  if (!account || (account.role === "owner" && !account.hidesSales)) return row;
  if (account.role === "owner")
    return { ...row, payload: stripSaleMoney(row.payload) };
  return {
    ...row,
    payload: scopeDatabase(
      row.payload,
      account.role,
      account.branch ? [account.branch] : [],
    ),
  };
}

const fail = (message: string): never => {
  throw new Error(message);
};

/** Kinds each non-owner role may append: `ownership` in store.ts plus editRequest. */
const allowedKinds: Partial<Record<Role, string[]>> = {
  branch: [
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
  ],
  cm: [
    "smokingInvoice",
    "smokeOrderAccept",
    "cmReceive",
    "prepare",
    "smoke",
    "closeLot",
    "chefEdit",
    "editRequest",
  ],
  foodiva: [
    "foodivaConfirm",
    "packingList",
    "foodivaReturnReceive",
    "dispatch",
    "editRequest",
  ],
};
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
const without = (value: object, ...keys: string[]) =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key)),
  );

/** JS port of `save_app_state` (supabase/migrations/20260925000023_save_app_state_hardening.sql).
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
    (payload.version !== 8 ||
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
  // The Account Manager writes as role "owner" and stamps every new entry; nobody else may.
  const manager = account!.id === "manager";
  for (const entry of payload.entries.slice(old.entries.length)) {
    if (manager && entry?.role !== "owner")
      fail("Entry role does not match signed-in account");
    if (entry?.actor !== (manager ? "manager" : undefined))
      fail("Entry actor does not match signed-in account");
  }
  if (role !== "owner") {
    const added = payload.entries.slice(old.entries.length);
    // cm/foodiva entries carry config.branch (mutate), read the way normalize() reads it.
    const configBranch = branches.includes(old.config.branch ?? "")
      ? old.config.branch
      : branches[0];
    for (const entry of added) {
      if (entry?.role !== role)
        fail("Entry role does not match signed-in account");
      if (role === "branch" && entry.branch !== account!.branch)
        fail("Entry branch does not match signed-in account");
    }
    for (const entry of added) {
      if (!allowedKinds[role]?.includes(entry.kind))
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
      if (
        (role === "cm" || role === "foodiva") &&
        entry.branch != null &&
        entry.branch !== configBranch
      )
        fail("Entry branch does not match signed-in account");
    }
    if (payload.lots.length !== old.lots.length)
      fail("Only an owner can add or remove lots");
    old.lots.forEach((lot, index) => {
      const next = payload.lots[index];
      // Only stage and values move, and only on a lot whose current stage this role owns.
      if (
        !next ||
        !isDeepStrictEqual(
          without(next, "stage", "values"),
          without(lot, "stage", "values"),
        ) ||
        typeof next.stage !== "number" ||
        next.stage < lot.stage ||
        next.stage > lot.stage + 1 ||
        ((next.stage !== lot.stage ||
          !isDeepStrictEqual(next.values, lot.values)) &&
          stageRole[lot.stage] !== role)
      )
        fail("Lot changes must follow the workflow");
    });
  }
  return replaceState(db, payload);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** JS port of `append_entries` (supabase/migrations/20260925000028_role_scoped_app_state.sql):
 * a Branch, Foodiva or Chef House save, which sends only its new entries and changed lots.
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
  if (role === "owner")
    fail("Only branch, Foodiva and Chef House accounts append entries");
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
  if (added.some((entry) => entry.role !== role))
    fail("Entry role does not match signed-in account");
  if (
    role === "branch" &&
    added.some((entry) => entry.branch !== account!.branch)
  )
    fail("Entry branch does not match signed-in account");
  if (added.some((entry) => !allowedKinds[role]?.includes(entry.kind)))
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
  if (
    added.some(
      (entry) =>
        entry.lotId &&
        entry.lotId !== "-" &&
        !old.lots.some((lot) => lot?.id === entry.lotId),
    )
  )
    fail("Entry lot does not exist");
  // cm/foodiva entries carry config.branch (mutate), read the way normalize() reads it.
  const configBranch = branches.includes(old.config.branch ?? "")
    ? old.config.branch
    : branches[0];
  if (
    (role === "cm" || role === "foodiva") &&
    added.some((entry) => entry.branch != null && entry.branch !== configBranch)
  )
    fail("Entry branch does not match signed-in account");

  const workflow = "Lot changes must follow the workflow";
  if (new Set(changes.map((lot) => lot.id)).size !== changes.length)
    fail(workflow);
  const lots = [...old.lots];
  for (const change of changes) {
    const index = old.lots.findIndex((lot) => lot?.id === change.id);
    if (index < 0) fail("Only an owner can add or remove lots");
    const lot = old.lots[index];
    if (
      typeof change.stage !== "number" ||
      !Number.isInteger(change.stage) ||
      change.stage < lot.stage ||
      change.stage > lot.stage + 1 ||
      !isObject(change.values ?? {})
    )
      fail(workflow);
    // Only stage and values are taken; values merge over the stored ones.
    const values = { ...lot.values, ...change.values };
    if (
      (change.stage !== lot.stage || !isDeepStrictEqual(values, lot.values)) &&
      stageRole[lot.stage] !== role
    )
      fail(workflow);
    lots[index] = { ...lot, stage: change.stage, values };
  }

  // A scoped copy has no prices: a branch sale's meatCost is worked out here (lotCost).
  const full: Database = { ...old, lots };
  const costKeys = ["meatCost", "wasteCost"].flatMap((key) => [
    key,
    `to.${key}`,
    `from.${key}`,
  ]);
  const entries = added.map((entry) => {
    const values = without(entry.values, ...costKeys) as Entry["values"];
    if (
      role === "branch" &&
      (entry.kind === "sale" || entry.kind === "influencerBox")
    ) {
      const lot = lots.find((item) => item?.id === entry.lotId);
      const perKg = (lot && lotCost(full, lot).perKg) || 0;
      values.meatCost = String(n(values, "soldKg") * perKg);
      if (entry.kind === "sale")
        values.wasteCost = String(n(values, "wasteKg") * perKg);
    }
    return { ...entry, values };
  });
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
