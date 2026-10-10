/** What each account may see and change of the log, and the list of everything yellow. */
import {
  branches,
  canChange,
  changeKinds,
  editableKinds,
  isEditOverlay,
  missingKeys,
  payCategories,
  rentCategory,
  titles,
  voidableKinds,
  type Actor,
  type Database,
  type Entry,
  type NoteKind,
  type Sheet,
} from "./model";
import {
  byDateAt,
  saleDue,
  isVoided,
  liveEntries,
  lotInfo,
  outflows,
  poInfo,
  purchaseLots,
  shipments,
} from "./derived";
/** The part of the raw log an account sees, changes included (the change log reads it). The
 *  Owner: everything. A branch: the entries stamped with it, plus every change to one of them
 *  and every undo of such a change, whoever made it. A change comes after what it names in the
 *  log, so one pass in log order follows the chain. The Owner's payments for a branch reach it
 *  for stock only and are never listed. */
export function visibleEntries(db: Database, by: Actor): Entry[] {
  if (by.role === "owner") return db.entries;
  const seen = new Set<string>();
  for (const e of db.entries)
    if (
      (e.role === "branch" && e.branch === by.branch) ||
      (changeKinds.includes(e.kind) && seen.has(e.values.targetId))
    )
      seen.add(e.id);
  return db.entries.filter((e) => seen.has(e.id));
}
/** The notes an account's Daily Log lists: live, with their edits laid over, newest first.
 *  Settings are not notes. */
export function visibleNotes(db: Database, by: Actor): Entry[] {
  const seen = new Set(visibleEntries(db, by).map((e) => e.id));
  return liveEntries(db)
    .filter((e) => e.kind !== "config" && seen.has(e.id))
    .sort(byDateAt)
    .reverse();
}
/** A branch's note (whoever jotted it) is the branch's to change, not the Owner's. */
const branchOnly = "บันทึกนี้เป็นของสาขา ให้สาขาเป็นคนแก้";
/** Why `by` may not edit `target` ("" when it may): the Owner edits any note but a branch's,
 *  a branch its own branch's. */
export function editBlock(db: Database, target: Entry, by: Actor) {
  if (!editableKinds.includes(target.kind))
    return "รายการชนิดนี้แก้ไขย้อนหลังไม่ได้";
  if (isVoided(db, target.id)) return "รายการนี้ถูกลบแล้ว";
  if (!canChange(by, target)) return "แก้ไขได้เฉพาะรายการของบัญชีนี้";
  if (by.role === "owner" && target.role === "branch") return branchOnly;
  return "";
}
/** Edits applied to one entry, oldest first; a voided one no longer applies, so it is left out. */
function entryEdits(db: Database, targetId: string) {
  const target = db.entries.find((e) => e.id === targetId);
  return db.entries.filter(
    (e) =>
      e.values.targetId === targetId &&
      isEditOverlay(e, target) &&
      !isVoided(db, e.id),
  );
}
/** Why `by` may not delete `target` ("" when it may). Deleting an edit undoes it, deleting a
 *  delete puts the entry back; of a branch's note either is the branch's alone. The changes of
 *  one entry are a stack: only its latest edit is undone, and an undo is not undone (edit or
 *  delete again instead). That also keeps every void within two steps of the entry it is
 *  about, which is as far as scope_app_state follows them for a branch. */
export function voidBlock(db: Database, target: Entry, by: Actor) {
  if (!voidableKinds.includes(target.kind)) return "รายการชนิดนี้ลบไม่ได้";
  if (isVoided(db, target.id))
    return changeKinds.includes(target.kind)
      ? "รายการนี้ย้อนกลับแล้ว"
      : "รายการนี้ถูกลบแล้ว";
  const about = db.entries.find((e) => e.id === target.values.targetId);
  if (!canChange(by, target)) return "ลบได้เฉพาะรายการของบัญชีนี้";
  // A change (an edit, a delete) is judged by the note it is about.
  const noteRole = changeKinds.includes(target.kind)
    ? (about?.role ?? target.values.targetRole)
    : target.role;
  if (by.role === "owner" && noteRole === "branch") return branchOnly;
  if (target.kind === "void" && (!about || changeKinds.includes(about.kind)))
    return "รายการนี้ย้อนกลับไม่ได้ ให้แก้ไขหรือลบใหม่แทน";
  if (
    target.kind === "entryEdit" &&
    entryEdits(db, target.values.targetId).at(-1)?.id !== target.id
  )
    return "ย้อนกลับการแก้ไขล่าสุดของรายการนี้ก่อน";
  return "";
}
/** One thing that is yellow, and what selecting it opens: a form (`kind`, with the date, lot
 *  or category to start from), the edit of an entry (`editId`) or the Stock or Inventory page. One
 *  with none of the three opens nothing (`todoOpens`): a branch's note the Owner only watches. */
export type Todo = {
  text: string;
  kind?: NoteKind;
  date?: string;
  lotId?: string;
  /** A round step's form starts on this dispatch round. */
  dispatchId?: string;
  category?: string;
  editId?: string;
  page?: "stock" | "meatStock";
};
/** The page that holds each daily sheet, by the name the menu gives it. */
const sheetPages = {
  meat: { page: "meatStock", label: "Stock" },
  materials: { page: "stock", label: "Inventory" },
} as const;
export const todoOpens = (todo: Todo) =>
  !!(todo.kind || todo.editId || todo.page);
const thaiDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("th-TH", {
    ...options,
    timeZone: "UTC",
  });
const shortDate = (date: string) =>
  thaiDate(date, { day: "numeric", month: "short" });
/** Spec section 7: everything yellow for an account, as one list for the Overview box, the
 *  Daily Log box and the bell. A branch lists its own branch; the Owner both, each
 *  line led by the branch name: the sale of each of the last 7 days the branch was open and
 *  jotted none (`saleDue`), never a daily sheet not saved. A lot flagged `old` (Old Lots) and
 *  the notes on it raise none. */
export function todos(db: Database, by: Actor, today: string): Todo[] {
  const list: Todo[] = [];
  const old = new Set(db.lots.filter((lot) => lot.old).map((lot) => lot.id));
  const own = by.role === "branch";
  for (const branch of own ? [by.branch ?? ""] : branches) {
    const lead = own ? "" : `${branch}: `;
    for (let back = 0; back < 7; back++) {
      const date = new Date(Date.parse(today) - back * 86400000)
        .toISOString()
        .slice(0, 10);
      // Only the branch jots its sale: for the Owner the line is a status. A day the branch
      // jotted nothing on (the shop was closed) raises none, and neither does a sheet not saved.
      if (saleDue(db, branch, date))
        list.push({
          text: `${lead}ยอดขาย ${back ? shortDate(date) : "วันนี้"}`,
          ...(own && { kind: "sale" as const, date }),
        });
    }
  }
  if (!own) {
    // A PO รมควัน: no round yet, each round's missing steps, no invoice (V2-LOT-01).
    for (const lot of shipments(db).reverse()) {
      if (lot.old) continue;
      const info = lotInfo(db, lot.id);
      const lotTodo = (kind: NoteKind) =>
        list.push({
          text: `${lot.poId}: ยังไม่ได้จด ${titles[kind]}`,
          kind,
          lotId: lot.id,
        });
      if (!info.rounds.length) lotTodo("dispatch");
      for (const round of info.rounds)
        for (const kind of round.missing)
          list.push({
            text: `${lot.poId} รอบ ${round.number}: ยังไม่ได้จด ${titles[kind]}`,
            kind,
            lotId: lot.id,
            dispatchId: round.dispatch.id,
          });
      if (info.missing.includes("smokingInvoice")) lotTodo("smokingInvoice");
    }
    // A PO เนื้อ: its waste to receive, and its invoice once meat was sent from it.
    for (const lot of purchaseLots(db).reverse()) {
      if (lot.old) continue;
      const po = poInfo(db, lot.id);
      if (po.wastePending)
        list.push({
          text: `รอรับ Waste ${lot.poId} ${po.wasteKg.toLocaleString("th-TH", { maximumFractionDigits: 2 })} กก.`,
          kind: "ownerWasteReceive",
          lotId: lot.id,
        });
      if (po.sentKg > 0 && !po.invoice)
        list.push({
          text: `${lot.poId}: ยังไม่ได้จด Invoice Foodiva`,
          kind: "meatInvoice",
          lotId: lot.id,
        });
    }
    const month = today.slice(0, 7);
    if (
      !outflows(db).some(
        (o) => o.category === rentCategory && o.date.startsWith(month),
      )
    )
      list.push({
        text: `${payCategories(db.config).find((c) => c.id === rentCategory)?.name ?? "ค่าเช่า/น้ำไฟ"} ของ${thaiDate(today, { month: "long", year: "numeric" })}`,
        kind: "pay",
        category: rentCategory,
      });
  }
  for (const e of visibleNotes(db, by)) {
    const missing = missingKeys(e.values).length;
    if (missing && !old.has(e.lotId))
      list.push({
        text: `${titles[e.kind]} ${shortDate(e.date)}: ยังไม่ได้จด ${missing} ช่อง`,
        // A note this account may not edit (a branch's, for the Owner) is a status line; a
        // sheet is saved again from its page.
        ...(!editBlock(db, e, by) &&
          (e.kind === "daily" || e.kind === "opening"
            ? { page: sheetPages[e.values.sheet as Sheet]?.page }
            : { editId: e.id })),
      });
  }
  return list;
}
