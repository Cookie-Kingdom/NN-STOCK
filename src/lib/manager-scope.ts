import { isDeepStrictEqual } from "node:util";
import {
  isSaleMoneyKey,
  payrollCategory,
  type Database,
  type Entry,
  type Values,
} from "./store";

/* Server side only (local SQLite backend): the Account Manager never receives a sale's money in
 * or a payroll payment's amount, name and payer (V2-ACC-01, V2-ACC-02), and a save from its
 * stripped copy must not erase them for everyone else.
 * JS port of manager_strip_values / manager_strip_entries / manager_restore_entries in
 * supabase/migrations/20261002000041_v2_note_taking.sql.
 * ponytail: duplicated rules, keep in step with that migration when it changes. */

/** What a payroll payment (or a change that carries its category) keeps: where it sits in the
 *  log and what it is about, so the Manager's whole-payload save still lines up. */
const stubKeys = [
  "category",
  "to.category",
  "from.category",
  "targetId",
  "targetKind",
  "targetDate",
  "targetRole",
  "targetBranch",
];
const isPayroll = (values: Values) =>
  [values.category, values["to.category"], values["from.category"]].includes(
    payrollCategory,
  );

function stripEntry(entry: Entry): Entry {
  if (!entry?.values || typeof entry.values !== "object") return entry;
  const payroll = isPayroll(entry.values);
  return {
    ...entry,
    values: Object.fromEntries(
      Object.entries(entry.values).filter(([key]) =>
        payroll
          ? stubKeys.includes(key)
          : !isSaleMoneyKey(key.replace(/^(to|from)\./, "")),
      ),
    ),
  };
}

/** The payload the Account Manager's browser receives: no sale money, payroll as stubs. */
export const stripForManager = (db: Database): Database => ({
  ...db,
  entries: db.entries.map(stripEntry),
});

/** Puts back what a save from the Account Manager's stripped copy left out: a stored entry that
 *  matches the incoming one once both are stripped is replaced by the stored one; any other
 *  difference is left for the append-only check to refuse. Nothing is filled in for new entries. */
export function restoreForManager(old: Database, incoming: Database): Database {
  if (incoming.entries.length < old.entries.length) return incoming;
  return {
    ...incoming,
    entries: incoming.entries.map((entry, index) =>
      index < old.entries.length &&
      isDeepStrictEqual(stripEntry(old.entries[index]), stripEntry(entry))
        ? old.entries[index]
        : entry,
    ),
  };
}
