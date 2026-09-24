/** What each role may see of the log, and the edit-request queries built on it. */
import {
  editApprovers,
  editableKinds,
  isEditOverlay,
  type Database,
  type Entry,
  type EntryKind,
  type Role,
  type Values,
} from "./model";
import { entries, shipments, smokingInvoiceStatus } from "./derived";
/** Value keys a role must not see. Chef House also never sees purchase POs, meat prices or freight.
 *  It does see the Foodiva invoice number on the Packing List (`invoiceNo`). */
const hiddenKeys = (role: Role) =>
  role === "cm"
    ? ["meatCost", "wasteCost", "lines", "price", "outboundCost", "returnCost"]
    : ["meatCost", "wasteCost"];
export const omit = (values: Values, keys: string[]) =>
  Object.fromEntries(
    Object.entries(values).filter(
      ([k]) => !keys.includes(k.replace(/^(to|from)\./, "")),
    ),
  );
const hide = (values: Values, role: Role) => omit(values, hiddenKeys(role));
/** A sale's money in: what the Account Manager must not see (C4). Its costs stay visible. */
export const saleMoneyKeys = ["revenue", "lineMan", "menuTotal"];
const editKinds: EntryKind[] = ["entryEdit", "editRequest", "editDecision"];
/** Owner entries Chef House works from: the smoke PO and Packing List it smokes, and the review and payment of its invoice. */
const chefHouseKinds: EntryKind[] = [
  "smokeOrder",
  "packingList",
  "invoiceReview",
  "invoicePayment",
];
/** Owner entries Foodiva sees: the payment of its meat invoice, whose slip is evidence for both
 *  sides (storage folder `meatPayment/`, migration 20260925000027). Foodiva supplies every lot. */
const foodivaKinds: EntryKind[] = ["meatPayment"];
/** `branch` is the signed-in branch account's own branch; a branch role sees nothing without it. */
export function visibleEntries(db: Database, role: Role, branch?: string) {
  const shipmentIds = new Set(shipments(db).map((lot) => lot.id));
  // Edits, requests and decisions about this role's own entries (its branch's, for a branch).
  const aboutMine = (e: Entry) =>
    editKinds.includes(e.kind) &&
    e.values.targetRole === role &&
    (role !== "branch" || e.values.targetBranch === branch);
  return db.entries
    .filter(
      (e) =>
        role === "owner" ||
        (role === "cm"
          ? shipmentIds.has(e.lotId) &&
            (e.role === "cm" || chefHouseKinds.includes(e.kind) || aboutMine(e))
          : (e.role === role && (role !== "branch" || e.branch === branch)) ||
            (role === "foodiva" && foodivaKinds.includes(e.kind)) ||
            aboutMine(e)),
    )
    .map((e) =>
      role === "owner" ? e : { ...e, values: hide(e.values, role) },
    );
}
/** The database a role's screens read. Chef House gets only shipments with a smoke PO, stripped of
 * purchase POs and prices; other roles get `db` untouched. `hideSales` (Account Manager) also drops
 * every sale's money in (`saleMoneyKeys`, edits included). For the manager that is a no-op in the
 * app: the server already strips it (load_app_state, GET /api/local-db) and puts it back on save
 * (save_app_state, src/lib/sale-money.ts), so sale money never reaches its browser. */
export function visibleDatabase(
  db: Database,
  role: Role,
  branch?: string,
  hideSales = false,
): Database {
  if (hideSales)
    db = {
      ...db,
      entries: db.entries.map((e) => ({
        ...e,
        values: omit(e.values, saleMoneyKeys),
      })),
    };
  if (role !== "cm") return db;
  const lots = shipments(db)
    .filter((lot) => entries(db, "smokeOrder", lot.id).length)
    .map((lot) => ({ ...lot, values: hide(lot.values, role) }));
  const ids = new Set(lots.map((lot) => lot.id));
  return {
    ...db,
    lots,
    entries: visibleEntries(db, role, branch).filter((e) => ids.has(e.lotId)),
  };
}
/** Why `role` may not edit `target` ("" when it may). Approvers edit any editable entry;
 *  anyone else only their own (a branch: its own branch's), and only by request. */
export function editBlock(
  db: Database,
  target: Entry,
  role: Role,
  branch = "",
) {
  if (!editableKinds.includes(target.kind))
    return "รายการชนิดนี้แก้ไขย้อนหลังไม่ได้";
  if (!entries(db, target.kind).some((e) => e.id === target.id))
    return "รายการนี้ถูกยกเลิกแล้ว";
  if (
    target.kind === "smokingInvoice" &&
    smokingInvoiceStatus(db, target) === "ชำระแล้ว"
  )
    return "Invoice นี้ชำระแล้ว แก้ไขไม่ได้";
  if (
    !editApprovers.includes(role) &&
    (target.role !== role || (role === "branch" && target.branch !== branch))
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
/** Direct edits and approved requests applied to one entry, oldest first. */
export const entryEdits = (db: Database, targetId: string) =>
  db.entries.filter((e) => isEditOverlay(e) && e.values.targetId === targetId);
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
