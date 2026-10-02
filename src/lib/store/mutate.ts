/** `mutate`: the only way to change the database. A note is checked by one pass over its
 *  form's fields (`fields` in forms.ts). It refuses (a thrown Error with a Thai message) only
 *  what would make the log wrong: a future or bad date, a typed value that is not a number, a
 *  note the account may not jot, a lot or a choice that is not there (V2-RUL-01). An empty core
 *  field is saved and listed in `missing` (V2-RUL-02); nothing else is checked or warned. */
import { fields } from "../forms";
import { today } from "../format";
import { newId } from "../id";
import {
  batchKinds,
  branches,
  changeKinds,
  editLockedKeys,
  isNoteKind,
  kindInfo,
  lotMovableKinds,
  pack,
  payCategories,
  payrollCategory,
  seed,
  type Actor,
  type ActingRole,
  type Database,
  type Entry,
  type EntryKind,
  type Lot,
  type NoteKind,
  type Role,
  type Values,
} from "./model";
import {
  decimal,
  entries,
  packWeights,
  purchaseLots,
  shipments,
} from "./derived";
import { editBlock, voidBlock } from "./visibility";
const forbidden = "บัญชีนี้ไม่มีสิทธิ์จดรายการนี้";
const badNumber = "เว็บไม่รับตัวเลขติดลบหรือค่าที่ไม่ใช่ตัวเลข";
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const without = (values: Values, keys: string[]) =>
  Object.fromEntries(
    Object.entries(values).filter(([key]) => !keys.includes(key)),
  );
/** A real calendar day: 2026-02-31 fails the round trip. */
const isDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
/** The day an entry is filed under: not before the system existed and not in the future
 *  (Bangkok). Every month and stock walk compares these as strings. */
function checkDay(value: string | undefined): asserts value {
  assert(value && isDay(value) && value >= "2020-01-01", "เลือกวันที่");
  assert(value <= today(), "วันที่อยู่ในอนาคต เว็บไม่รับ");
}
/** The role an entry of `kind` is stamped with when `role` records it: a branch kind is the
 *  branch's whoever jots it (mutate puts the Owner in `actor`), anything else stays `role`. */
export const recordRole = (kind: EntryKind, role: ActingRole): Role =>
  isNoteKind(kind) && kindInfo[kind].group === "branch" ? "branch" : role;
/** The next running number of a kind's document. Deleted ones count too: a number is never
 *  given to a second document. */
const nextNumber = (db: Database, kind: EntryKind) =>
  String(db.entries.filter((e) => e.kind === kind).length + 1).padStart(4, "0");
/** What a refused choice is called, per select. */
const selectError: Record<string, string> = {
  poLotId: "ไม่พบ PO เนื้อที่เลือก",
  category: "เลือกหมวด",
  item: "เลือกรายการ",
  branch: "เลือกสาขา",
};
/** A note's values as saved: one pass over the kind's fields for `by`. A field whose `when`
 *  is false is dropped; a typed number, date, time or choice must be one; an empty core field
 *  is listed in `missing`. Then the numbers the web issues itself, kept when `input` already
 *  has one (an edit). `kept`: the values an edit started from, whose choices still stand even
 *  if Settings or the POs no longer offer them. */
function noteValues(
  db: Database,
  by: Actor,
  kind: NoteKind,
  input: Values,
  date: string,
  kept: Values = {},
): Values {
  const v: Values = {};
  const missing: string[] = [];
  for (const f of fields(kind, db, by)) {
    if (f.when && !f.when(input)) continue;
    let value = (input[f.key] ?? "").trim();
    if (value && f.type === "number") {
      assert(Number.isFinite(decimal(value)), `${f.label}: ${badNumber}`);
      value = String(Number(value));
    }
    if (value && f.type === "date") assert(isDay(value), `เลือก${f.label}`);
    if (value && f.type === "time")
      assert(
        /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
        "กรอกเวลาเป็น HH:mm เช่น 08:00",
      );
    if (value && f.type === "select" && value !== kept[f.key])
      assert(
        f.options?.some((option) => option.value === value),
        // A category in Settings that this account's form does not offer (V2-ACC-02, 07).
        f.key === "category" &&
          payCategories(db.config).some((c) => c.id === value)
          ? forbidden
          : (selectError[f.key] ?? `เลือก${f.label}`),
      );
    // The bytes (until persistence moves them to storage) and where they went.
    if (f.type === "file")
      for (const suffix of ["Data", "StorageKey"])
        if (input[f.key + suffix]) v[f.key + suffix] = input[f.key + suffix];
    if (f.core && !value) missing.push(f.key);
    v[f.key] = value;
  }
  if (missing.length) v.missing = missing.join(",");
  const year = date.slice(0, 4);
  if (kind === "materials")
    assert(Object.values(v).some(Boolean), "ยังไม่ได้ใส่ยอดนับ");
  if (kind === "smokeOrder")
    v.orderNumber =
      input.orderNumber || `SO-${year}-${nextNumber(db, "smokeOrder")}`;
  if (kind === "dispatch")
    v.transferNumber =
      input.transferNumber || `TR-${year}-${nextNumber(db, "dispatch")}`;
  if (kind === "return")
    v.transferNumber =
      input.transferNumber || `TR-${year}-R${nextNumber(db, "return")}`;
  if (kind === "smoke") {
    const tokens = v.packs.split(/[\s,]+/).filter(Boolean);
    assert(
      tokens.every((token) => Number.isFinite(decimal(token))),
      `น้ำหนักกล่องรมควัน: ${badNumber}`,
    );
    if (tokens.length) {
      v.postSmokeKg = packWeights(v.packs)
        .reduce((a, b) => a + b, 0)
        .toFixed(2);
      v.packCount = String(tokens.length);
    }
    v.subLot = input.subLot || `SB-${year}-${nextNumber(db, "smoke")}`;
  }
  return v;
}
/** The lot a note of `kind` goes on: a live Lot for a Lot kind (or none, for a `receive`), a
 *  live PO เนื้อ for `ownerWasteReceive`. */
function lotOf(db: Database, kind: NoteKind, lotId: string) {
  const on = kindInfo[kind].lot;
  if (!on || (on === "optional" && !lotId)) return "";
  assert(
    (on === "po" ? purchaseLots(db) : shipments(db)).some(
      (lot) => lot.id === lotId,
    ),
    on === "po" ? "เลือก PO เนื้อ" : "เลือก Lot",
  );
  return lotId;
}
/** Lot values never cached on a PO: bulky, or the entry's own bookkeeping. */
const uncached = ["attachmentData", "missing"];
/** Kinds a lot's cache is rebuilt for: a Lot's notes and the PO itself. No branch kind is
 *  among them, so a branch (which holds no Owner entries) never writes a lot. */
const lotKinds: EntryKind[] = [...batchKinds, "purchase"];
/** The lots whose cache a change to `entry` (as stored) reaches: the one it was recorded on,
 *  every lot an edit moved it from or to, and `more`. */
function cachedOn(db: Database, entry: Entry, ...more: (string | undefined)[]) {
  if (!lotKinds.includes(entry.kind)) return [];
  return [
    entry.lotId,
    ...db.entries
      .filter((e) => e.kind === "entryEdit" && e.values.targetId === entry.id)
      .flatMap((e) => [e.values.fromLotId, e.values.toLotId]),
    ...more,
  ].filter((id): id is string => !!id);
}
/** `lot` with its cache rebuilt from the live entries of `db`, the log after an edit, a
 *  delete or an undo. A PO: its live `purchase` entry's values. A Lot: nothing. With no live
 *  entry left on it either is `deleted` (liveLots). */
function recached(db: Database, lot: Lot): Lot {
  const po = lot.kind ? undefined : entries(db, "purchase", lot.id).at(-1);
  const live = lot.kind
    ? batchKinds.some((kind) => entries(db, kind, lot.id).length)
    : po;
  return {
    ...lot,
    values: !live ? { deleted: "1" } : po ? without(po.values, uncached) : {},
  };
}
/** A number setting: typed, and not below zero. */
const settingNumbers: Values = {
  boxPrice: "ราคากล่อง",
  packKg: "น้ำหนักเนื้อต่อกล่อง",
  packCost: "ต้นทุนแพ็กเกจต่อกล่อง",
};
/** A list setting, with the value that names each row. */
const settingLists: Record<string, { label: string; id: string }> = {
  salesChannels: { label: "ช่องทางขาย", id: "key" },
  materialList: { label: "รายชื่อวัสดุ", id: "id" },
  payCategories: { label: "หมวดจ่ายเงิน", id: "id" },
};
/** The settings of a `config` entry, checked: whatever a figure or a form reads must be readable. */
function checkConfig(v: Values) {
  const bad = (what: string) => `ตั้งค่าไม่ถูกต้อง: ${what}`;
  const amount = (value: unknown) =>
    Number.isFinite(decimal(String(value ?? "")));
  for (const [key, label] of Object.entries(settingNumbers))
    if (v[key] !== undefined) assert(amount(v[key]), bad(label));
  for (const [key, { label, id }] of Object.entries(settingLists)) {
    if (v[key] === undefined) continue;
    let rows: Values[] = [];
    try {
      rows = JSON.parse(v[key]);
    } catch {}
    assert(Array.isArray(rows), bad(label));
    const ids = rows.map((row) => row?.[id]);
    assert(
      rows.every((row) => row?.[id] && String(row.name ?? "").trim()) &&
        new Set(ids).size === ids.length,
      bad(label),
    );
    // Sale money is hidden from the Account Manager by its key (isSaleMoneyKey).
    if (key === "salesChannels")
      assert(
        ids[0] === "lineMan" &&
          ids.slice(1).every((k) => String(k).startsWith("sales.")) &&
          rows.every((row) => amount(row.gp)),
        bad(label),
      );
    if (key === "materialList")
      assert(
        rows.every((row) => !row.perBox || amount(row.perBox)),
        bad(label),
      );
    // The seed's ten categories are fixed: the rules hang on their ids.
    if (key === "payCategories")
      assert(
        payCategories(seed.config).every((c) => ids.includes(c.id)),
        bad(label),
      );
  }
}
export function mutate(
  db: Database,
  by: Actor,
  kind: EntryKind,
  input: Values,
  lotId: string,
  date: string,
): Database {
  checkDay(date);
  const next: Database = structuredClone(db);
  // A branch account's branch is its own, never taken from the input (V2-ACC-08).
  const own = by.role === "branch" ? (by.branch ?? "") : "";
  if (by.role === "branch")
    assert(branches.includes(own), "ไม่พบสาขาของบัญชีนี้");
  const reason: Values = input.reason?.trim()
    ? { reason: input.reason.trim() }
    : {};
  // Lots whose cache is rebuilt once the entry is in (an edit, a delete, an undo).
  const touched = new Set<string>();
  let entry: Omit<Entry, "id" | "at">;
  if (kind === "void") {
    // A delete. Of an edit it undoes that; of a delete it puts the entry back.
    const target = db.entries.find((e) => e.id === input.targetId);
    assert(target, "ไม่พบรายการ");
    const block = voidBlock(db, target, by);
    assert(!block, block);
    // The entry this is about: the target itself, or the one its edit or delete names.
    const about = changeKinds.includes(target.kind)
      ? db.entries.find((e) => e.id === target.values.targetId)
      : undefined;
    for (const id of cachedOn(db, about ?? target)) touched.add(id);
    entry = {
      kind,
      role: by.role,
      lotId: target.lotId,
      branch: own,
      date,
      values: {
        targetId: target.id,
        ...reason,
        targetKind: target.kind,
        // The day it is filed under now, an edit's move included.
        targetDate: (
          entries(db, target.kind).find((e) => e.id === target.id) ?? target
        ).date,
        targetRole: target.role,
        targetBranch: target.branch,
      },
    };
  } else if (kind === "entryEdit") {
    // Recorded, not applied: entries() lays the `to.` values over the target.
    const stored = db.entries.find((e) => e.id === input.targetId);
    assert(stored, "ไม่พบรายการที่จะแก้ไข");
    const block = editBlock(db, stored, by);
    assert(!block, block);
    const target = entries(db, stored.kind).find((e) => e.id === stored.id)!;
    const note = target.kind as NoteKind;
    let proposed: Values = {};
    try {
      proposed = JSON.parse(input.values || "{}");
    } catch {}
    // `toDate` re-dates the entry, `toLotId` moves it to another lot.
    const toDate = input.toDate || target.date;
    checkDay(toDate);
    const toLotId = input.toLotId || target.lotId;
    if (toLotId !== target.lotId) {
      assert(
        lotMovableKinds.includes(target.kind),
        "ย้าย Lot ของรายการนี้ไม่ได้",
      );
      lotOf(db, note, toLotId);
    }
    /* Checked like a new entry of the same kind by the account that recorded it: the form
     * that account had (its categories, its branch) is the one the entry stays within. */
    const recorder: Actor =
      target.role === "branch" && !target.actor
        ? { role: "branch", branch: target.branch }
        : { role: "owner", hidesSales: target.actor === "manager" };
    const values = noteValues(
      db,
      recorder,
      note,
      { ...target.values, ...proposed },
      target.date,
      target.values,
    );
    // An entry's branch is fixed when it is saved: stock a payment sends elsewhere is a new entry.
    for (const key of editLockedKeys)
      assert(
        !values[key] || values[key] === target.branch,
        "แก้สาขาไม่ได้ · ลบแล้วจดใหม่",
      );
    // A payroll payment is hidden from the Account Manager by its category: it stays one.
    assert(
      (values.category === payrollCategory) ===
        (target.values.category === payrollCategory),
      "แก้หมวดค่าแรงไม่ได้ · ลบแล้วจดใหม่",
    );
    // The overlay merges, so a value no longer saved (a field its `when` now hides, a
    // `missing` list that was filled) is cleared, not left as it was.
    for (const key of Object.keys(target.values))
      if (values[key] === undefined && key !== "attachmentData")
        values[key] = "";
    const changed = Object.fromEntries(
      Object.entries(values).filter(
        ([key, value]) => value !== (target.values[key] ?? ""),
      ),
    );
    const moved: Values = {
      ...(toDate !== target.date && { fromDate: target.date, toDate }),
      ...(toLotId !== target.lotId && { fromLotId: target.lotId, toLotId }),
    };
    for (const id of cachedOn(db, stored, target.lotId, toLotId))
      touched.add(id);
    entry = {
      kind,
      role: by.role,
      lotId: toLotId,
      branch: own,
      date,
      values: {
        targetId: target.id,
        ...reason,
        targetKind: target.kind,
        targetDate: target.date,
        targetRole: target.role,
        targetBranch: target.branch,
        ...pack("from.", target.values),
        ...pack("to.", changed),
        ...moved,
      },
    };
  } else if (kind === "config") {
    assert(by.role === "owner" && !by.hidesSales, forbidden);
    const v = { ...input };
    // An unchanged legacy logo (a data URL, up to ~1.4 MB) would be copied into every
    // config entry of the append-only log. Left out, the merge below keeps it.
    if (v.logoData === db.config.logoData) delete v.logoData;
    checkConfig(v);
    next.config = { ...db.config, ...v };
    entry = { kind, role: "owner", lotId: "", branch: "", date, values: v };
  } else {
    assert(isNoteKind(kind), "รายการชนิดนี้เลิกใช้แล้ว");
    const info = kindInfo[kind];
    // V2-ACC: a branch jots branch kinds and its payments; the Account Manager no sale.
    assert(
      by.role === "branch"
        ? info.group === "branch" || kind === "pay"
        : !(by.hidesSales && kind === "sale"),
      forbidden,
    );
    const v = noteValues(db, by, kind, input, date);
    let branch = own;
    if (by.role === "owner" && info.group === "branch") {
      assert(branches.includes(input.branch), "เลือกสาขา");
      branch = input.branch;
    } else if (by.role === "owner" && kind === "pay") {
      // V2-PAY-05: a payment that buys stock is stamped with the branch the stock goes to.
      assert(v.branch || !v.qty, "เลือกสาขา");
      branch = v.branch ?? "";
    }
    const day = date.slice(2).replaceAll("-", "");
    if (kind === "purchase") {
      // V2-PO-01: a PO opens its own lot, `F<yymmdd>-NNN` with the next `PO-YYYY-NNNN`.
      const count = next.lots.filter((lot) => !lot.kind).length + 1;
      lotId = `F${day}-${String(count).padStart(3, "0")}`;
      next.lots.push({
        id: lotId,
        poId: `PO-${date.slice(0, 4)}-${String(count).padStart(4, "0")}`,
        values: without(v, uncached),
        config: {},
      });
    } else if (info.lot === "batch" && !lotId) {
      /* A new Lot, `S<yymmdd>-NNN-xxxx` with the next `SH-YYYY-NNNN`. NNN and the SH number
       * count the Lots this client has; two devices saving at once may repeat a number, so
       * 4 random hex chars keep the id itself unique. The SH number is display only. */
      const count = next.lots.filter((lot) => lot.kind).length + 1;
      lotId = `S${day}-${String(count).padStart(3, "0")}-${newId().slice(0, 4)}`;
      next.lots.push({
        id: lotId,
        poId: `SH-${date.slice(0, 4)}-${String(count).padStart(4, "0")}`,
        kind: "shipment",
        values: {},
        config: {},
      });
    } else lotId = lotOf(db, kind, lotId);
    const role = recordRole(kind, by.role);
    entry = {
      kind,
      role,
      // Jotted for a branch: the typist (persistence re-stamps the Account Manager's).
      ...(role !== by.role ? { actor: "owner" as const } : {}),
      lotId,
      branch,
      date,
      values: v,
    };
  }
  next.entries.push({ id: newId(), at: new Date().toISOString(), ...entry });
  if (touched.size)
    next.lots = next.lots.map((lot) =>
      touched.has(lot.id) ? recached(next, lot) : lot,
    );
  return next;
}
