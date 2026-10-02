import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import type { Account } from "./accounts";
import { restoreForManager, stripForManager } from "./manager-scope";
import { scopeDatabase } from "./role-scope";
import {
  branchCategories,
  canChange,
  changeKinds,
  isVoided,
  managerHidden,
  seed,
  voidableKinds,
  type Database,
  type Entry,
  type EntryKind,
} from "./store";

type AppStateRow = { payload: Database; revision: number };

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

/** Like load_app_state (20261002000041): the Owner reads everything, the Account Manager a copy
 * without sale money and with payroll payments as stubs, a branch its role-scoped copy. */
export function loadState(
  db: DatabaseSync,
  account: Account | null,
): AppStateRow {
  // A missing, unknown or retired (e.g. old `chef`) cookie maps to null: never the full state.
  if (!account) fail("Authentication required");
  const row = readState(db);
  if (account!.role === "owner" && !account!.hidesSales) return row;
  if (account!.role === "owner")
    return { ...row, payload: stripForManager(row.payload) };
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

/** Kinds a branch may append (V2-ACC-07): its notes, and the changes to its own entries. */
const branchKinds: EntryKind[] = [
  "receive",
  "sale",
  "influencerBox",
  "materials",
  "meatCount",
  "pay",
  "entryEdit",
  "void",
];
/** Kinds of its own a branch may edit: its notes less the material count (editableKinds). */
const branchEditable: EntryKind[] = [
  "receive",
  "sale",
  "influencerBox",
  "meatCount",
  "pay",
];
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

/** JS port of `save_app_state` (latest in supabase/migrations/20261002000041_v2_note_taking.sql).
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
  // The Account Manager saves from its stripped copy (GET strips it): put the rest back.
  const manager = !!account!.hidesSales;
  if (manager) payload = restoreForManager(old, payload);
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
  const byId = new Map(payload.entries.map((entry) => [entry?.id, entry]));
  // managerHidden reads `values`: a malformed entry has none.
  const hidden = (entry: Entry, target?: Entry) =>
    managerHidden(
      { ...entry, values: entry.values ?? {} },
      target && { ...target, values: target.values ?? {} },
    );
  // The Account Manager stamps every new entry; the Owner stamps "owner" on an entry it jotted
  // for someone else (a branch kind, an old partner step).
  for (const entry of payload.entries.slice(old.entries.length)) {
    const actorOk = manager
      ? entry?.actor === "manager"
      : entry?.actor === undefined ||
        (entry.actor === "owner" &&
          ["foodiva", "cm", "branch"].includes(entry.role));
    if (!actorOk) fail("Entry actor does not match signed-in account");
    if (!manager) continue;
    if (!["owner", "foodiva", "cm", "branch"].includes(entry.role))
      fail("Entry role does not match signed-in account");
    if (entry.kind === "config") fail("Only the Owner changes settings");
    /* V2-ACC-01, V2-ACC-02: no sale, no payroll payment, no change about one. A delete does not
     * carry its target's category, so the entry it names is looked up, and for an undo the
     * entry that one names (voidBlock in store/visibility.ts). */
    const target = byId.get(entry.values?.targetId);
    if (
      hidden(entry, target) ||
      (target && hidden(target, byId.get(target.values?.targetId)))
    )
      fail("Entry kind is not allowed for this account");
  }
  if (manager && !isDeepStrictEqual(payload.config, old.config))
    fail("Only the Owner changes settings");
  return replaceState(db, payload);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** JS port of `append_entries` (latest in supabase/migrations/20261002000041_v2_note_taking.sql):
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
  const changes = lotInput ?? [];
  if (
    !Array.isArray(added) ||
    !Array.isArray(changes) ||
    added.some((entry) => !isObject(entry) || !isObject(entry.values))
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

  // No branch kind opens a Lot or writes the lot cache.
  if ((changes as unknown[]).length) fail("Only an owner can change lots");
  const lotExists = (id: string) => old.lots.some((lot) => lot?.id === id);
  if (added.some((entry) => entry.lotId && !lotExists(entry.lotId)))
    fail("Entry lot does not exist");

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  });
  // In log order, so an entry sees the ones before it in this save (an edit, then its undo).
  const log = { ...old, entries: [...old.entries] };
  for (const entry of added) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? "") || entry.date > today)
      fail("Entry date is invalid or after today");
    // V2-ACC-07: a branch pays in its four categories, and an edit keeps a payment within them.
    const category =
      entry.kind === "pay"
        ? entry.values.category
        : entry.kind === "entryEdit"
          ? entry.values["to.category"]
          : "";
    if (category && !branchCategories.includes(category))
      fail("Payment category is not allowed for this account");
    const target = log.entries.find(
      (other) => other?.id === entry.values.targetId,
    );
    // editBlock in store/visibility.ts: a branch edits a live entry of its own branch.
    if (entry.kind === "entryEdit") {
      if (!(
        target &&
        canChange(entry, target) &&
        branchEditable.includes(target.kind)
      ))
        fail("Edit target is not an entry of this branch");
      if (isVoided(log, target!.id)) fail("Entry is already deleted");
      // Only a receive changes Lot, to one that exists; no edit dates an entry after today.
      const { toLotId, toDate } = entry.values;
      if (
        toLotId != null &&
        toLotId !== "" &&
        !(target!.kind === "receive" && lotExists(toLotId))
      )
        fail("Edit cannot move an entry to another lot");
      if (
        toDate != null &&
        toDate !== "" &&
        !(
          typeof toDate === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(toDate) &&
          toDate <= today
        )
      )
        fail("Entry date is invalid or after today");
    }
    // voidBlock in store/visibility.ts: a branch deletes a live entry of its own branch. Of an
    // edit that undoes it, of a delete it puts the entry back, and that is as far as it goes:
    // a delete naming a delete or an edit is not deleted in turn.
    if (entry.kind === "void") {
      if (!(
        target &&
        canChange(entry, target) &&
        voidableKinds.includes(target.kind)
      ))
        fail("Void target is not an entry of this branch");
      if (isVoided(log, target!.id)) fail("Entry is already deleted");
      const about = log.entries.find(
        (other) => other?.id === target!.values?.targetId,
      );
      if (
        target!.kind === "void" &&
        (!about?.kind || changeKinds.includes(about.kind))
      )
        fail("An undo cannot be undone");
    }
    log.entries.push(entry);
  }
  return replaceState(db, log);
}

/** Writes the state with no guards. saveState calls it after its checks; on its own
 * it is e2e setup only (PUT /api/local-db). */
export function replaceState(db: DatabaseSync, payload: Database): AppStateRow {
  db.prepare("update app_state set payload = ?, revision = revision + 1").run(
    JSON.stringify(payload),
  );
  return readState(db);
}
