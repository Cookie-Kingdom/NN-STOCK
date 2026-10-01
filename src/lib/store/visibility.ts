/** What each role may see of the log, and the edit-request queries built on it. */
import {
  canChange,
  editableKinds,
  isEditOverlay,
  voidableKinds,
  type Database,
  type Entry,
  type EntryKind,
  type ActingRole,
  type Values,
} from "./model";
import { centralStock, entries, isVoided } from "./derived";
/** Value keys a branch must not see: meat cost (lotCost), what the smoke PO and trucks cost,
 *  and the Owner's prices. role-scope.ts strips the same keys on the server. */
export const branchHiddenKeys = [
  "meatCost",
  "wasteCost",
  "estimatedCost",
  "serviceRate",
  "lines",
  "price",
  "outboundCost",
  "returnCost",
];
export const omit = (values: Values, keys: string[]) =>
  Object.fromEntries(
    Object.entries(values).filter(
      ([k]) => !keys.includes(k.replace(/^(to|from)\./, "")),
    ),
  );
/** A sale's money in: what the Account Manager must not see (C4). Its costs stay visible. */
export const saleMoneyKeys = ["revenue", "lineMan", "menuTotal"];
const editKinds: EntryKind[] = [
  "void",
  "entryEdit",
  "editRequest",
  "editDecision",
  "link",
];
/** BR-07 — the lots a branch's screens list: lots holding its own entries (a receive, also
 *  one linked to the lot later), lots still in central stock that it may receive from
 *  (BR-08, no allocation needed) and, for old data, lots allocated to it. `role-scope.ts`
 *  sends every batch S plus those; scope_app_state() (migration 20260929000033) states the
 *  same rule. The Owner (and Account Manager) see every lot. */
export function visibleLots(db: Database, branch?: string) {
  const received = new Set(
    entries(db, "receive")
      .filter((e) => e.branch === branch)
      .map((e) => e.lotId),
  );
  return db.lots.filter(
    (lot) =>
      received.has(lot.id) ||
      (lot.kind === "shipment" && centralStock(db, lot.id) > 0.001) ||
      db.entries.some(
        (e) =>
          e.lotId === lot.id &&
          e.branch === branch &&
          (e.kind === "allocate" || e.role === "branch"),
      ),
  );
}
/** Owner entries addressed to a branch (old allocations; role-scope.ts sends them): shown
 *  read-only in its history. */
const sentToBranch: EntryKind[] = ["allocate"];
/** `branch` is the signed-in branch account's own branch; a branch role sees nothing without it. */
export function visibleEntries(
  db: Database,
  role: ActingRole,
  branch?: string,
) {
  if (role === "owner") return db.entries;
  /* A branch: its own branch's entries and what the Owner sent it, plus every change to
   * one of them (an edit, a link, a delete) and every undo of such a change, whoever made
   * it. A change comes after what it names in the log, so one pass in log order follows
   * the chain. */
  const seen = new Set<string>();
  for (const e of db.entries)
    if (
      (e.branch === branch &&
        (e.role === "branch" || sentToBranch.includes(e.kind))) ||
      (editKinds.includes(e.kind) && seen.has(e.values.targetId))
    )
      seen.add(e.id);
  return db.entries
    .filter((e) => seen.has(e.id))
    .map((e) => ({ ...e, values: omit(e.values, branchHiddenKeys) }));
}
/** The database a role's screens read: `db` untouched, except that `hideSales` (Account Manager)
 * drops every sale's money in (`saleMoneyKeys`, edits included). For the manager that is a no-op in
 * the app: the server already strips it (load_app_state, GET /api/local-db) and puts it back on save
 * (save_app_state, src/lib/sale-money.ts), so sale money never reaches its browser. A branch's
 * narrowing happens on the server (role-scope.ts) and in `visibleLots` / `visibleEntries`. */
export function visibleDatabase(db: Database, hideSales = false): Database {
  if (!hideSales) return db;
  return {
    ...db,
    entries: db.entries.map((e) => ({
      ...e,
      values: omit(e.values, saleMoneyKeys),
    })),
  };
}
/** Why `role` may not edit `target` ("" when it may): the Owner edits any editable entry, a
 *  branch its own branch's, both directly (EDT-22). */
export function editBlock(
  db: Database,
  target: Entry,
  role: ActingRole,
  branch = "",
) {
  if (!editableKinds.includes(target.kind))
    return "รายการชนิดนี้แก้ไขย้อนหลังไม่ได้";
  if (isVoided(db, target.id)) return "รายการนี้ถูกลบแล้ว";
  if (!canChange({ role, branch }, target))
    return "แก้ไขได้เฉพาะรายการของบัญชีนี้";
  return "";
}
/** Direct edits and approved requests applied to one entry, oldest first; a voided one no
 *  longer applies, so it is left out. */
export function entryEdits(db: Database, targetId: string) {
  const target = db.entries.find((e) => e.id === targetId);
  return db.entries.filter(
    (e) =>
      e.values.targetId === targetId &&
      isEditOverlay(e, target) &&
      !isVoided(db, e.id),
  );
}
/** Why `role` may not delete `target` ("" when it may). Deleting an edit or a link undoes it,
 *  deleting a delete puts the entry back (EDT-23). The changes of one entry are a stack: only
 *  its latest edit is undone, and an undo is not undone (edit, link or delete again instead).
 *  That also keeps every void within two steps of the entry it is about, which is as far as
 *  scope_app_state follows them for a branch. */
export function voidBlock(
  db: Database,
  target: Entry,
  role: ActingRole,
  branch = "",
) {
  if (!voidableKinds.includes(target.kind)) return "รายการชนิดนี้ลบไม่ได้";
  if (isVoided(db, target.id))
    return target.kind === "void" || target.kind === "entryEdit"
      ? "รายการนี้ย้อนกลับแล้ว"
      : "รายการนี้ถูกลบแล้ว";
  if (!canChange({ role, branch }, target))
    return "ลบได้เฉพาะรายการของบัญชีนี้";
  const about = db.entries.find((e) => e.id === target.values.targetId);
  if (
    target.kind === "void" &&
    (!about ||
      !voidableKinds.includes(about.kind) ||
      ["void", "entryEdit", "link"].includes(about.kind))
  )
    return "รายการนี้ย้อนกลับไม่ได้ · แก้ไขหรือลบใหม่แทน";
  // Among the edits only: a request approved in an old log is no edit to undo first.
  if (
    target.kind === "entryEdit" &&
    entryEdits(db, target.values.targetId)
      .filter((e) => e.kind === "entryEdit")
      .at(-1)?.id !== target.id
  )
    return "ย้อนกลับการแก้ไขล่าสุดของรายการนี้ก่อน";
  return "";
}
