/** `mutate`: the only way to change the database. A note is checked by one pass over its
 *  form's fields (`fields` in forms.ts). It refuses (a thrown Error with a Thai message) only
 *  what would make the log wrong: a future or bad date, a typed value that is not a number, a
 *  note the account may not jot, a lot or a choice that is not there (V2-RUL-01). An empty core
 *  field is saved and listed in `missing` (V2-RUL-02); nothing else is checked or warned. */
import { fields, type Field } from "../forms";
import { today } from "../format";
import { newId } from "../id";
import {
  batchKinds,
  branches,
  changeKinds,
  editLockedKeys,
  isNoteKind,
  isRoundKind,
  kindInfo,
  kindsFor,
  oncePerLotKinds,
  titles,
  lotMovableKinds,
  pack,
  payCategories,
  payrollCategory,
  seed,
  type Actor,
  type Database,
  type Entry,
  type EntryKind,
  type Lot,
  type NoteKind,
  type Values,
} from "./model";
import {
  decimal,
  defaultRound,
  entries,
  nextNumberPreview,
  poInfo,
  poLines,
  purchaseLots,
  shipments,
  smokeServiceRate,
} from "./derived";
import { itemNoFor } from "./ledger";
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
/** A `poLines` field as saved: JSON `[{ poLotId, kg }]`, "" for no line. A PO must be one the
 *  field offers (or one the edited entry already had) and is picked once; a kg is a number or
 *  left "" (not typed yet). */
function linesValue(f: Field, raw: string, kept: string[]): string {
  if (!raw.trim()) return "";
  let rows: unknown;
  try {
    rows = JSON.parse(raw);
  } catch {}
  assert(Array.isArray(rows), `${f.label}: อ่านรายการไม่ได้`);
  const allowed = new Set([
    ...(f.options ?? []).map((option) => option.value),
    ...kept,
  ]);
  const seen = new Set<string>();
  const lines = rows.map((row) => {
    const poLotId = String(row?.poLotId ?? "");
    assert(allowed.has(poLotId), "ไม่พบ PO เนื้อที่เลือก");
    assert(!seen.has(poLotId), "เลือก PO เนื้อซ้ำในรายการเดียวกัน");
    seen.add(poLotId);
    const kg = String(row?.kg ?? "").trim();
    assert(!kg || Number.isFinite(decimal(kg)), `${f.label}: ${badNumber}`);
    return { poLotId, kg: kg ? String(Number(kg)) : "" };
  });
  return lines.length ? JSON.stringify(lines) : "";
}
/** The kg of a saved `poLines` value, added up. */
const linesKg = (value = "") =>
  poLines(value).reduce((total, line) => total + line.kg, 0);
const kgText = (x: number) =>
  x.toLocaleString("th-TH", { maximumFractionDigits: 2 });
/** What a refused choice is called, per select. */
const selectError: Record<string, string> = {
  poLotId: "ไม่พบ PO เนื้อที่เลือก",
  dispatchId: "ไม่พบรอบส่งไปรมควันนี้ใน PO รมควันที่เลือก",
  category: "เลือกหมวด",
  item: "เลือกรายการ",
  branch: "เลือกสาขา",
};
/** A note's values as saved: one pass over the kind's fields for `by` (on `lotId`). A field
 *  whose `when` is false is dropped; a typed number, date, time or choice must be one; an
 *  empty core field is listed in `missing`. Then the numbers the web issues itself, kept when
 *  `input` already has one (an edit). `kept`: the values an edit started from, whose choices
 *  still stand even if Settings or the POs no longer offer them. */
function noteValues(
  db: Database,
  by: Actor,
  kind: NoteKind,
  input: Values,
  date: string,
  lotId: string,
  kept: Values = {},
): Values {
  const v: Values = {};
  const missing: string[] = [];
  // A round step left with no round goes on the newest one still missing it (defaultRound).
  if (isRoundKind(kind) && !input.dispatchId && lotId)
    input = { ...input, dispatchId: defaultRound(db, lotId, kind)?.id ?? "" };
  // The waste received starts at what the PO เนื้อ (or its invoice) says.
  if (kind === "ownerWasteReceive" && !input.receivedKg?.trim() && lotId) {
    const waste = poInfo(db, lotId).wasteKg;
    if (waste) input = { ...input, receivedKg: String(waste) };
  }
  // A dispatch saved with one `poLotId` (before several POs) is edited as one line.
  if (kind === "dispatch" && input.poLines === undefined && input.poLotId)
    input = {
      ...input,
      poLines: JSON.stringify([
        { poLotId: input.poLotId, kg: input.dispatchKg ?? "" },
      ]),
    };
  for (const f of fields(kind, db, by, lotId)) {
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
    if (f.type === "poLines")
      value = linesValue(f, value, [
        ...poLines(kept[f.key]).map((line) => line.poLotId),
        ...(kept.poLotId ? [kept.poLotId] : []),
      ]);
    if (f.core && !value) missing.push(f.key);
    v[f.key] = value;
  }
  if (isRoundKind(kind))
    assert(
      v.dispatchId,
      "ยังไม่มีรอบส่งไปรมควันใน PO รมควันนี้ · จด ส่งไปรมควัน ก่อน",
    );
  if (kind === "dispatch") {
    // A dispatchKg left empty is the lines' kg added up.
    if (!v.dispatchKg && linesKg(v.poLines)) {
      v.dispatchKg = String(linesKg(v.poLines));
      missing.splice(missing.indexOf("dispatchKg"), 1);
    }
    // V2-LOT-03: the meat is from POs เนื้อ that add up to the weight sent, every kg typed.
    const rows: Values[] = v.poLines ? JSON.parse(v.poLines) : [];
    assert(rows.length, "เลือก PO เนื้อที่ส่งไปรม");
    assert(
      rows.every((row) => row.kg !== ""),
      "ใส่ กก. ของ PO เนื้อทุกบรรทัด",
    );
    const total = linesKg(v.poLines);
    assert(
      Math.abs(total - Number(v.dispatchKg)) < 0.005,
      `น้ำหนักจาก PO เนื้อรวม ${kgText(total)} กก. ไม่เท่าน้ำหนักที่ส่ง ${kgText(Number(v.dispatchKg))} กก.`,
    );
  }
  if (missing.length) v.missing = missing.join(",");
  if (kind === "materials")
    assert(Object.values(v).some(Boolean), "ยังไม่ได้ใส่ยอดนับ");
  // The numbers the web issues itself; an edit keeps the one it has.
  if (kind === "smokeOrder")
    v.orderNumber =
      input.orderNumber || nextNumberPreview(db, "smokeOrder", date)!;
  // V2-LED-03: a ledger item keeps the Item No. of the same name, a new name gets the next one.
  if (kind === "expense") {
    // Rendered as a link: nothing but a web address (no `javascript:`).
    assert(
      !v.link || /^https?:\/\/\S+$/i.test(v.link),
      "ลิงก์เอกสารต้องขึ้นต้นด้วย http:// หรือ https://",
    );
    v.itemNo = itemNoFor(db, v.item, kept).no;
  }
  if (kind === "dispatch" || kind === "return")
    v.transferNumber =
      input.transferNumber || nextNumberPreview(db, kind, date)!;
  if (kind === "smokeOrder") {
    // The rate by the Settings tiers unless one is typed; the estimate is kg × rate.
    const kg = Number(v.rawKg || 0);
    if (!v.serviceRate && kg)
      v.serviceRate = String(smokeServiceRate(db.config, kg));
    v.estimatedCost =
      kg && v.serviceRate ? String(kg * Number(v.serviceRate)) : "";
  }
  // A round trip's shipping, both legs: the Settings default unless one is typed (0 is typed).
  if (kind === "return" && !v.shippingFee && db.config.shippingFee)
    v.shippingFee = db.config.shippingFee;
  return v;
}
/** The lot a note of `kind` goes on: a live PO รมควัน for its kinds (or none, for a
 *  `receive`), a live PO เนื้อ for a PO เนื้อ's kinds. */
function lotOf(db: Database, kind: NoteKind, lotId: string) {
  const on = kindInfo[kind].lot;
  if (!on || (on === "optional" && !lotId)) return "";
  assert(
    (on === "po" ? purchaseLots(db) : shipments(db)).some(
      (lot) => lot.id === lotId,
    ),
    on === "po" ? "เลือก PO เนื้อ" : "เลือก PO รมควัน",
  );
  return lotId;
}
/** A PO's invoice is one (V2-LOT-09): a second live one on the lot is refused. */
function onceOnLot(db: Database, kind: EntryKind, lotId: string) {
  if (oncePerLotKinds.includes(kind))
    assert(
      !entries(db, kind, lotId).length,
      `PO นี้มี ${titles[kind].replace("บันทึก ", "")} แล้ว · แก้ไขรายการเดิมแทน`,
    );
}
/** Lot values never cached on a PO: bulky, or the entry's own bookkeeping. */
const uncached = ["attachmentData", "missing"];
/** Kinds a lot's cache is rebuilt for: a Lot's notes and the PO itself. No branch kind is
 *  among them, so a branch (which holds no Owner entries) never writes a lot. */
const lotKinds: EntryKind[] = [...batchKinds, "smokeOrder", "purchase"];
/* A PO เนื้อ's own kinds never change its cache: it is the `purchase` entry's values. */
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
    ? [...batchKinds, "smokeOrder" as const].some(
        (kind) => entries(db, kind, lot.id).length,
      )
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
  shippingFee: "ค่าขนส่งไป-กลับต่อรอบ",
  smokeRate: "ค่ารมต่อกก. ต่ำกว่า 1,000 กก.",
  smokeRate1000: "ค่ารมต่อกก. ตั้งแต่ 1,000 กก.",
  smokeRate1500: "ค่ารมต่อกก. ตั้งแต่ 1,500 กก.",
};
/** A list setting, with the value that names each row. */
const settingLists: Record<string, { label: string; id: string }> = {
  salesChannels: { label: "ช่องทางขาย", id: "key" },
  materialList: { label: "รายชื่อวัสดุ", id: "id" },
  payCategories: { label: "หมวดจ่ายเงิน", id: "id" },
};
/** The settings of a `config` entry, checked: whatever a figure or a form reads must be readable. */
function checkConfig(v: Values) {
  const amount = (value: unknown) =>
    Number.isFinite(decimal(String(value ?? "")));
  const figure = "ใส่เป็นตัวเลข 0 ขึ้นไป";
  for (const [key, label] of Object.entries(settingNumbers))
    if (v[key] !== undefined) assert(amount(v[key]), `${label}: ${figure}`);
  for (const [key, { label, id }] of Object.entries(settingLists)) {
    if (v[key] === undefined) continue;
    let rows: Values[] = [];
    try {
      rows = JSON.parse(v[key]);
    } catch {}
    // What only a hand-made save can get wrong: no rows, a row with no id, an id used twice.
    const broken = `${label}: อ่านรายการไม่ได้`;
    assert(Array.isArray(rows), broken);
    const ids = rows.map((row) => row?.[id]);
    assert(ids.every(Boolean) && new Set(ids).size === ids.length, broken);
    const names = rows.map((row) => String(row.name ?? "").trim());
    assert(names.every(Boolean), `${label}: มีแถวที่ยังไม่ได้ใส่ชื่อ`);
    const twice = names.find((name, at) => names.indexOf(name) !== at);
    assert(twice === undefined, `${label}: ชื่อ「${twice}」ซ้ำกัน`);
    const empty = (row: Values, value: string) => (row[value] ?? "") === "";
    const numbers = (value: string, what: string) => {
      const row = rows.find((row) => !empty(row, value) && !amount(row[value]));
      assert(!row, `${label}: ${what}ของ「${row?.name}」${figure}`);
    };
    if (key === "salesChannels") {
      // Sale money is hidden from the Account Manager by its key (isSaleMoneyKey).
      assert(
        ids[0] === "lineMan" &&
          ids.slice(1).every((k) => String(k).startsWith("sales.")),
        broken,
      );
      const none = rows.find((row) => empty(row, "gp"));
      assert(!none, `${label}: ยังไม่ได้ใส่ GP % ของ「${none?.name}」`);
      numbers("gp", "GP % ");
    }
    if (key === "materialList") numbers("perBox", "ใช้ต่อกล่อง");
    // The seed's ten categories are fixed: the rules hang on their ids.
    if (key === "payCategories")
      assert(
        payCategories(seed.config).every((c) => ids.includes(c.id)),
        `${label}: หมวดตั้งต้นลบไม่ได้`,
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
        "ย้าย PO ของรายการนี้ไม่ได้",
      );
      lotOf(db, note, toLotId);
      onceOnLot(db, note, toLotId);
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
      toLotId,
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
    // V2-ACC: a branch jots branch kinds and its payments; nobody else jots a branch kind.
    assert(kindsFor(by).includes(kind), forbidden);
    // The lot first: a step of a PO รมควัน has none to go on without one.
    if (kind !== "purchase" && kind !== "smokeOrder")
      lotId = lotOf(db, kind, lotId);
    const v = noteValues(db, by, kind, input, date, lotId);
    let branch = own;
    if (by.role === "owner" && kind === "pay") {
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
    } else if (kind === "smokeOrder") {
      /* V2-LOT-07: a PO รมควัน opens its own lot, `S<yymmdd>-NNN-xxxx`, numbered with its
       * `SO-YYYY-NNNN` (its orderNumber too). NNN and the SO number count the ones this client
       * has; two devices saving at once may repeat a number, so 4 random hex chars keep the id
       * itself unique. Nothing else opens one. */
      const count = next.lots.filter((lot) => lot.kind).length + 1;
      lotId = `S${day}-${String(count).padStart(3, "0")}-${newId().slice(0, 4)}`;
      next.lots.push({
        id: lotId,
        poId: v.orderNumber,
        kind: "shipment",
        values: {},
        config: {},
      });
    } else {
      onceOnLot(db, kind, lotId);
    }
    entry = { kind, role: by.role, lotId, branch, date, values: v };
  }
  next.entries.push({ id: newId(), at: new Date().toISOString(), ...entry });
  if (touched.size)
    next.lots = next.lots.map((lot) =>
      touched.has(lot.id) ? recached(next, lot) : lot,
    );
  return next;
}
