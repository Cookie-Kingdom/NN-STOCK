/** What each role may see of the log, and the edit-request queries built on it. */
import {
  editableKinds,
  isEditOverlay,
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
/** Owner entries addressed to a branch, which the branch has already received (role-scope.ts
 *  sends them): shown read-only in its history. */
const sentToBranch: EntryKind[] = [
  "allocate",
  "chiliAllocate",
  "materialTransfer",
];
/** `branch` is the signed-in branch account's own branch; a branch role sees nothing without it. */
export function visibleEntries(
  db: Database,
  role: ActingRole,
  branch?: string,
) {
  if (role === "owner") return db.entries;
  // A branch: its own branch's entries and what the Owner sent it, plus edits, requests
  // and decisions about them.
  const aboutMine = (e: Entry) =>
    editKinds.includes(e.kind) &&
    e.values.targetRole === "branch" &&
    e.values.targetBranch === branch;
  return db.entries
    .filter(
      (e) =>
        (e.branch === branch &&
          (e.role === "branch" || sentToBranch.includes(e.kind))) ||
        aboutMine(e),
    )
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
/** Why `role` may not edit `target` ("" when it may). Approvers edit any editable entry;
 *  anyone else only their own (a branch: its own branch's), and only by request. */
export function editBlock(
  db: Database,
  target: Entry,
  role: ActingRole,
  branch = "",
) {
  if (!editableKinds.includes(target.kind))
    return "รายการชนิดนี้แก้ไขย้อนหลังไม่ได้";
  if (!entries(db, target.kind).some((e) => e.id === target.id))
    return "รายการนี้ถูกยกเลิกแล้ว";
  if (
    role === "branch" &&
    (target.role !== "branch" || target.branch !== branch)
  )
    return "แก้ไขได้เฉพาะรายการของบัญชีนี้";
  return "";
}
export const editDecisionOf = (db: Database, requestId: string) =>
  entries(db, "editDecision").find((e) => e.values.requestId === requestId);
/** The request on `targetId` still waiting for a decision. One at a time per entry. */
export const openEditRequest = (db: Database, targetId: string) =>
  entries(db, "editRequest").find(
    (e) => e.values.targetId === targetId && !editDecisionOf(db, e.id),
  );
/** Direct edits and approved requests applied to one entry, oldest first; a voided one no
 *  longer applies, so it is left out. */
export const entryEdits = (db: Database, targetId: string) =>
  db.entries.filter(
    (e) =>
      isEditOverlay(e) && e.values.targetId === targetId && !isVoided(db, e.id),
  );
/** Every edit request in `db` with its decision: waiting ones first, then newest first.
 *  Pass a role's visible database to get only that role's own requests. */
export function editRequestRows(db: Database) {
  return entries(db, "editRequest")
    .map((request) => ({ request, decision: editDecisionOf(db, request.id) }))
    .sort(
      (a, b) =>
        Number(!!a.decision) - Number(!!b.decision) ||
        (b.decision?.at || b.request.at).localeCompare(
          a.decision?.at || a.request.at,
        ),
    );
}
