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
  boxProduct,
  lastProductCode,
  productCodeText,
  products,
  branches,
  changeKinds,
  editLockedKeys,
  isNoteKind,
  isProductKey,
  isRoundKind,
  kindInfo,
  kindsFor,
  legacySale,
  oncePerLotKinds,
  titles,
  lotMovableKinds,
  pack,
  payCategories,
  payrollCategory,
  salesChannels,
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
  materialList,
  nextNumberPreview,
  pendingTransfers,
  poInfo,
  poLines,
  purchaseLots,
  shipments,
  smokeServiceRate,
} from "./derived";
import {
  nextSku,
  skuAfter,
  skuFor,
  skuHigh,
  skuItem,
  skuNameError,
} from "./ledger";
import { editBlock, voidBlock } from "./visibility";
const forbidden = "บัญชีนี้ไม่มีสิทธิ์จดรายการนี้";
const badNumber = "ใส่เป็นตัวเลข 0 ขึ้นไป";
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
  assert(value <= today(), "วันที่อยู่ในอนาคต เลือกวันนี้หรือวันก่อนหน้า");
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
  from: "ไม่พบคลังต้นทางที่เลือก",
  to: "ไม่พบคลังปลายทางที่เลือก",
  transferId: "ไม่พบรายการจัดสรรที่รอสาขานี้ยืนยันรับ",
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
  for (const f of fields(kind, db, by, lotId, kept)) {
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
  // V2-CAL-01: money from the old books is no form field, so nobody jots it; an edit keeps
  // it, and it stands for the channel money the form asks for.
  // Tubes sold apart had a field of their own once: an edit keeps what such a note took.
  if ((kind === "sale" || kind === "influencerBox") && kept.chiliAddons)
    v.chiliAddons = kept.chiliAddons;
  if (kind === "sale" && kept[legacySale.key]) {
    v[legacySale.key] = kept[legacySale.key];
    const at = missing.indexOf(salesChannels(db.config)[0].key);
    if (at >= 0) missing.splice(at, 1);
  }
  // A sale's products are rows of one list: none is not jotted while any has a count.
  if (
    kind === "sale" &&
    Object.keys(v).some((key) => isProductKey(key) && v[key])
  ) {
    const at = missing.findIndex(isProductKey);
    if (at >= 0) missing.splice(at, 1);
  }
  if (isRoundKind(kind))
    assert(
      v.dispatchId,
      'PO รมควันนี้ยังไม่มีรอบส่งไปรมควัน ให้จด "ส่งไปรมควัน" ก่อน',
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
      "ใส่น้ำหนัก (กก.) ของ PO เนื้อให้ครบทุกบรรทัด",
    );
    const total = linesKg(v.poLines);
    assert(
      Math.abs(total - Number(v.dispatchKg)) < 0.005,
      `น้ำหนักจาก PO เนื้อรวม ${kgText(total)} กก. ไม่เท่าน้ำหนักที่ส่ง ${kgText(Number(v.dispatchKg))} กก.`,
    );
  }
  // A waste with no reason is saved, its reason listed as not jotted yet (V2-RUL-05).
  if (kind === "daily")
    for (const key of Object.keys(v))
      if (key.startsWith("waste.") && Number(v[key]) > 0) {
        const reason = key.replace("waste.", "reason.");
        if (!v[reason]) missing.push(reason);
      }
  if (kind === "daily" || kind === "opening") assert(v.sheet, "เลือกใบสต๊อก");
  // A sales receipt goes by its channel (ledgerRows): its item may stay empty.
  if (kind === "income" && v.channel && missing.includes("item"))
    missing.splice(missing.indexOf("item"), 1);
  if (missing.length) v.missing = missing.join(",");
  // The numbers the web issues itself; an edit keeps the one it has.
  if (kind === "smokeOrder")
    v.orderNumber =
      input.orderNumber || nextNumberPreview(db, "smokeOrder", date)!;
  // Rendered as a link: nothing but a web address (no `javascript:`).
  if (kind === "expense" || kind === "income")
    assert(
      !v.link || /^https?:\/\/\S+$/i.test(v.link),
      "ลิงก์เอกสารต้องขึ้นต้นด้วย http:// หรือ https://",
    );
  // V2-LED-03: a ledger item has the SKU of the item of that name, a new name the next one.
  if (kind === "expense") v.sku = skuFor(db, v.item, kept).sku;
  if (kind === "transfer") {
    assert(
      !v.from || v.from !== v.to,
      "คลังต้นทางและปลายทางเป็นที่เดียวกันไม่ได้",
    );
    // Only an item of the catalogue moves, under the name it goes by now. `itemName`: a
    // branch's copy has no catalogue to look an item up in.
    const item = skuItem(db, v.item, kept);
    assert(!v.item || item, "ไม่พบรายการนี้ ให้เลือกจากรายการที่มีอยู่");
    v.item = v.itemName = item?.name ?? "";
    v.sku = item?.sku ?? "";
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
      `PO นี้มี ${titles[kind].replace("บันทึก ", "")} แล้ว ให้แก้ไขรายการเดิมแทน`,
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
  if (v.rawRiceBranches !== undefined) {
    let list: unknown;
    try {
      list = JSON.parse(v.rawRiceBranches);
    } catch {}
    assert(
      Array.isArray(list) &&
        list.every((branch) => branches.includes(branch)) &&
        new Set(list).size === list.length,
      "สาขาที่ใช้ข้าวเหนียวดิบ: อ่านรายการไม่ได้",
    );
  }
  const label = "รายการสินค้า";
  const rowsOf = (value: string): Values[] | null => {
    let rows: unknown;
    try {
      rows = JSON.parse(value);
    } catch {}
    return Array.isArray(rows) && rows.every((row) => row?.id) ? rows : null;
  };
  const once = (ids: unknown[]) => new Set(ids).size === ids.length;
  // A figure left empty is not set (products, productMoney).
  const figures = (values: unknown[]) =>
    values.every((value) => (value ?? "") === "" || amount(value));
  if (v.products !== undefined) {
    const rows = rowsOf(v.products);
    const items = rows?.map((row) => rowsOf(JSON.stringify(row.items ?? [])));
    assert(
      rows &&
        once(rows.map((row) => row.id)) &&
        rows.some((row) => row.id === boxProduct) &&
        items!.every((list) => list && once(list.map((item) => item.id))),
      `${label}: อ่านรายการไม่ได้`,
    );
    const names = rows.map((row) => String(row.name ?? "").trim());
    assert(names.every(Boolean), `${label}: มีสินค้าที่ยังไม่ได้ใส่ชื่อ`);
    const lower = names.map((name) => name.toLowerCase());
    const twice = names.find((_, at) => lower.indexOf(lower[at]) !== at);
    assert(twice === undefined, `${label}: ชื่อ「${twice}」ซ้ำกัน`);
    const bad = rows.find(
      (_, at) => !figures(items![at]!.map((item) => item.qty)),
    );
    assert(!bad, `${label}: จำนวนส่วนประกอบของ「${bad?.name}」${figure}`);
  }
  if (v.productMoney !== undefined) {
    const rows = rowsOf(v.productMoney);
    assert(
      rows && once(rows.map((row) => row.id)),
      `${label}: อ่านรายการไม่ได้`,
    );
    assert(
      figures(
        rows.flatMap((row) => [
          row.price,
          row.cost,
          // A price per sales channel, by the channel's key.
          ...Object.values(row.prices ?? {}),
        ]),
      ),
      `${label}: ราคาและต้นทุน${figure}`,
    );
  }
  if (v.skuNames !== undefined) {
    let rows: unknown;
    try {
      rows = JSON.parse(v.skuNames);
    } catch {}
    // The names themselves are checked over the whole catalogue (skuNameError).
    assert(Array.isArray(rows), "รายการสินค้า (SKU): อ่านรายการไม่ได้");
  }
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
      // A channel added in Settings keeps its money under a `sales.` key.
      assert(
        ids[0] === "lineMan" &&
          ids.slice(1).every((k) => String(k).startsWith("sales.")) &&
          // Not a channel: its money would be counted twice (saleMoney).
          !ids.includes(legacySale.key),
        broken,
      );
      const none = rows.find((row) => empty(row, "gp"));
      assert(!none, `${label}: ยังไม่ได้ใส่ GP % ของ「${none?.name}」`);
      numbers("gp", "GP % ");
    }
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
    assert(
      branches.includes(own),
      "บัญชีนี้ยังไม่ได้ผูกกับสาขา กรุณาติดต่อ Owner",
    );
  const reason: Values = input.reason?.trim()
    ? { reason: input.reason.trim() }
    : {};
  // Lots whose cache is rebuilt once the entry is in (an edit, a delete, an undo).
  const touched = new Set<string>();
  let entry: Omit<Entry, "id" | "at">;
  if (kind === "void") {
    // A delete. Of an edit it undoes that; of a delete it puts the entry back.
    const target = db.entries.find((e) => e.id === input.targetId);
    assert(target, "ไม่พบรายการที่จะลบหรือย้อนกลับ");
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
        "รายการนี้ย้ายไป PO อื่นไม่ได้",
      );
      lotOf(db, note, toLotId);
      onceOnLot(db, note, toLotId);
    }
    /* Checked like a new entry of the same kind by the account that recorded it: the form
     * that account had (its categories, its branch) is the one the entry stays within. */
    const recorder: Actor =
      target.role === "branch" && !target.actor
        ? { role: "branch", branch: target.branch }
        : { role: "owner" };
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
        "แก้สาขาไม่ได้ ให้ลบแล้วจดใหม่",
      );
    // So is the branch an expense bought into: from there it moves by a `transfer`.
    assert(
      note !== "expense" ||
        !branches.includes(values.warehouse) ||
        values.warehouse === target.branch,
      'แก้เป็นคลังของสาขาอื่นไม่ได้ ให้ใช้ "จัดสรรสินค้า" หรือลบแล้วจดใหม่',
    );
    // A payroll payment keeps its receipt in its own folder (Composer): it stays one.
    assert(
      (values.category === payrollCategory) ===
        (target.values.category === payrollCategory),
      "แก้หมวดค่าแรงไม่ได้ ให้ลบแล้วจดใหม่",
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
    assert(by.role === "owner", forbidden);
    const v = { ...input };
    // An unchanged legacy logo (a data URL, up to ~1.4 MB) would be copied into every
    // config entry of the append-only log. Left out, the merge below keeps it.
    if (v.logoData === db.config.logoData) delete v.logoData;
    checkConfig(v);
    if (v.materialList !== undefined) {
      // V2-LED-03: a material keeps its SKU (whatever is sent), a new one gets the next.
      const had = new Map(materialList(db).map((m) => [m.id, m.sku]));
      let sku = nextSku(db);
      const rows: Values[] = JSON.parse(v.materialList);
      v.materialList = JSON.stringify(
        rows.map((row) => {
          const kept = had.get(row.id);
          if (kept) return { ...row, sku: kept };
          const issued = sku;
          sku = skuAfter(sku);
          return { ...row, sku: issued };
        }),
      );
      // The list saved is the list from now on: the branches' `stockItem` notes so far are
      // in it (or were taken out of it), so only later ones are laid over it.
      v.materialListAfter =
        db.entries.findLast((e) => e.kind === "stockItem")?.id ?? "";
    }
    if (v.products !== undefined) {
      // A product keeps its code (whatever is sent); one with none gets the next, past
      // every code a list saved so far held (a removed product's is never given again).
      const had = new Map(products(db.config).map((p) => [p.id, p.code]));
      let high = lastProductCode(db);
      const rows: Values[] = JSON.parse(v.products);
      v.products = JSON.stringify(
        rows.map((row) => ({
          ...row,
          code: had.get(row.id) || productCodeText(++high),
        })),
      );
    }
    next.config = { ...db.config, ...v };
    // One name, one SKU: over the materials and the ledger items, renames included.
    if (v.materialList !== undefined || v.skuNames !== undefined) {
      const error = skuNameError(next);
      assert(!error, error);
    }
    entry = { kind, role: "owner", lotId: "", branch: "", date, values: v };
  } else {
    assert(isNoteKind(kind), "รายการชนิดนี้เลิกใช้แล้ว");
    // V2-ACC: a branch jots branch kinds and its payments; nobody else jots a branch kind.
    assert(kindsFor(by).includes(kind), forbidden);
    // The lot first: a step of a PO รมควัน has none to go on without one.
    if (kind !== "purchase" && kind !== "smokeOrder")
      lotId = lotOf(db, kind, lotId);
    const v = noteValues(db, by, kind, input, date, lotId);
    if (kind === "stockItem") {
      // One row of the material list, checked as a Settings save of the whole list is: an
      // id of the list, a name, no name twice. A new row gets an id and the next SKU.
      const list = materialList(db);
      const had = list.find((m) => m.id === v.id);
      assert(!v.id || had, "ไม่พบรายการนี้ในรายชื่อวัสดุ");
      v.id ||= newId();
      v.sku = had?.sku || nextSku(db);
      checkConfig({
        materialList: JSON.stringify([
          ...list.filter((m) => m.id !== v.id),
          { id: v.id, name: v.name },
        ]),
      });
    }
    let branch = own;
    if (by.role === "owner" && kind === "pay") {
      // V2-PAY-05: a payment that buys stock is stamped with the branch the stock goes to.
      assert(v.branch || !v.qty, "เลือกสาขา");
      branch = v.branch ?? "";
    }
    // What is bought straight into a branch is stamped with it: its stock line reaches it.
    if (kind === "expense" && branches.includes(v.warehouse))
      branch = v.warehouse;
    // A receipt is all of one transfer still waiting for this branch, once.
    if (kind === "transferReceive")
      assert(
        pendingTransfers(db, own).some((e) => e.id === v.transferId),
        entries(db, "transferReceive", undefined, own).some(
          (e) => e.values.transferId === v.transferId,
        )
          ? "รายการนี้ยืนยันรับแล้ว"
          : selectError.transferId,
      );
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
  // One name, one SKU, over the ledger items too (those this account holds).
  if (kind === "stockItem") {
    const error = skuNameError(next);
    assert(!error, error);
  }
  /* A branch holds no ledger item of the Owner's that never reached it, so it cannot tell the
   * highest SKU from its log alone: the Owner's saves keep it in the settings a branch
   * receives, and `nextSku` reads it. */
  if (by.role === "owner" && skuHigh(next) !== next.config.skuHigh)
    next.config.skuHigh = skuHigh(next);
  if (touched.size)
    next.lots = next.lots.map((lot) =>
      touched.has(lot.id) ? recached(next, lot) : lot,
    );
  return next;
}
