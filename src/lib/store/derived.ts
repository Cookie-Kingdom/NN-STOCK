/** Figures recomputed from the entry log (stock, cost, yield, money); nothing here is stored.
 *  `today` is always a parameter (`YYYY-MM-DD`, Bangkok), so every function stays pure. */
import {
  canChange,
  capexCategory,
  changeKinds,
  companyPayer,
  coreLotKinds,
  isEditOverlay,
  materialList,
  payCategories,
  salesChannels,
  type Database,
  type Entry,
  type EntryKind,
  type Lot,
  type Values,
  unpack,
} from "./model";
const num = (v: Values, key: string) => Number(v[key] || 0);
export const n = num;
export const sum = (items: Entry[], key: string) =>
  items.reduce((a, e) => a + num(e.values, key), 0);
/** A typed plain decimal ("12", "12.5", ".5") as a number, else NaN. `Number()` alone
 *  also takes "0x10", "1e3" and "Infinity", which no form means. */
export const decimal = (value = "") =>
  /^\s*(\d+\.?\d*|\.\d+)\s*$/.test(value) ? Number(value) : NaN;
const typed = (v: Values, key: string) => (v[key] ?? "") !== "";
type EntryIndex = {
  length: number;
  voided: Set<string>;
  live: Entry[];
  byKind: Map<EntryKind, Entry[]>;
};
/* The void set, the live entries with their edits laid over and a by-kind list are built
 * once per log and reused by every entries() call on it. The log only grows, so its length
 * tells a stale index apart. */
const entryIndexes = new WeakMap<Entry[], EntryIndex>();
function entryIndex(db: Database): EntryIndex {
  const cached = entryIndexes.get(db.entries);
  if (cached?.length === db.entries.length) return cached;
  /* A delete counts when its author may change the target (canChange), and only while it is
   * not deleted itself: that is the undo. A void of a void always comes later in the log, so
   * walking newest first settles each one before it is read. */
  const byId = new Map(db.entries.map((entry) => [entry.id, entry]));
  const voided = new Set<string>();
  for (let i = db.entries.length - 1; i >= 0; i--) {
    const entry = db.entries[i];
    if (entry.kind !== "void" || voided.has(entry.id)) continue;
    const target = byId.get(entry.values.targetId);
    if (entry.role === "owner" || (target && canChange(entry, target)))
      voided.add(entry.values.targetId);
  }
  // Edits overlay their target in log order (a later edit wins); one may also re-date it or
  // move it to another lot.
  const edits = new Map<string, Pick<Entry, "values" | "date" | "lotId">>();
  for (const e of db.entries) {
    const target = byId.get(e.values.targetId);
    if (!target || voided.has(e.id) || !isEditOverlay(e, target)) continue;
    const now = edits.get(target.id) ?? target;
    edits.set(target.id, {
      values: { ...now.values, ...unpack("to.", e.values) },
      date: e.values.toDate || now.date,
      lotId: e.values.toLotId || now.lotId,
    });
  }
  const live = db.entries
    .filter((e) => !voided.has(e.id) && !changeKinds.includes(e.kind))
    .map((e) => (edits.has(e.id) ? { ...e, ...edits.get(e.id) } : e));
  const byKind = new Map<EntryKind, Entry[]>();
  for (const e of live) {
    const list = byKind.get(e.kind);
    if (list) list.push(e);
    else byKind.set(e.kind, [e]);
  }
  const index = { length: db.entries.length, voided, live, byKind };
  entryIndexes.set(db.entries, index);
  return index;
}
/** Whether a void that counts (see entryIndex) names this entry. */
export const isVoided = (db: Database, id: string) =>
  entryIndex(db).voided.has(id);
/** Live entries of one kind, with edits (values, date, lot) overlaid, in log order.
 *  `lotId === ""` is "no lot"; leave it `undefined` for every lot. */
export function entries(
  db: Database,
  kind: EntryKind,
  lotId?: string,
  branch?: string,
  date?: string,
) {
  return (entryIndex(db).byKind.get(kind) ?? []).filter(
    (e) =>
      (lotId === undefined || e.lotId === lotId) &&
      (!branch || e.branch === branch) &&
      (!date || e.date === date),
  );
}
/** Box weights typed one per line or comma-separated. Bad tokens stay NaN so `mutate` can reject them. */
export const packWeights = (packs = "") =>
  packs
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
/** Every live entry in log order: a deleted one is none, an edited one is where the edit put
 *  it, and an edit or a delete is no entry of its own. */
export const liveEntries = (db: Database) => entryIndex(db).live;
/** Lots still in use. A PO whose `purchase` was deleted, or a Lot with every note deleted,
 *  stays in `lots` (ids and numbers are never reused) with only `deleted` in its cache: the
 *  Owner's save writes it, so a branch, which holds no Owner entries, reads it too. */
export const liveLots = (db: Database) =>
  db.lots.filter((lot) => !lot.values.deleted);
export const purchaseLots = (db: Database) =>
  liveLots(db).filter((lot) => !lot.kind);
/** Every Lot รมควัน. */
export function shipments(db: Database) {
  return liveLots(db).filter((lot) => lot.kind === "shipment");
}
/** Oldest first: by business date, then by when it was typed (then log order: sort is stable). */
export const byDateAt = (
  a: { date: string; at: string },
  b: { date: string; at: string },
) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at);
/** V2-CAL-01: a sale's money in over every channel, and the GP the channels take from it. */
export function saleMoney(config: Values, sale: Entry) {
  let sales = 0,
    gp = 0;
  for (const channel of salesChannels(config)) {
    sales += num(sale.values, channel.key);
    gp += (num(sale.values, channel.key) * channel.gp) / 100;
  }
  return { sales, gp };
}
type Outflow = {
  date: string;
  category: string;
  amount: number;
  payer: string;
  branch: string;
  entryId: string;
};
/** V2-PAY-06: every money-out line, each counted once: a payment, a sale's branch expense
 *  (อื่น ๆ) and a gift box's shipping fee (การตลาด). The only reader of money out. */
export function outflows(db: Database): Outflow[] {
  const out: Outflow[] = [];
  const add = (e: Entry, key: string, category: string, payer = "") => {
    if (typed(e.values, key))
      out.push({
        date: e.date,
        category,
        amount: num(e.values, key),
        payer,
        branch: e.branch,
        entryId: e.id,
      });
  };
  for (const e of liveEntries(db)) {
    if (e.kind === "pay")
      add(e, "amount", e.values.category || "other", e.values.payer);
    if (e.kind === "sale") add(e, "expense", "other", e.values.payer);
    if (e.kind === "influencerBox") add(e, "shippingFee", "marketing");
  }
  return out;
}
type MonthPl = {
  sales: number;
  gp: number;
  byCategory: Record<string, number>;
  opex: number;
  profit: number;
  capex: number;
};
/** V2-CAL-02: one month (`YYYY-MM`, by entry date). อุปกรณ์/ลงทุน stays out of the profit. */
export function monthPl(db: Database, month: string): MonthPl {
  let sales = 0,
    gp = 0;
  for (const sale of entries(db, "sale"))
    if (sale.date.startsWith(month)) {
      const money = saleMoney(db.config, sale);
      sales += money.sales;
      gp += money.gp;
    }
  const byCategory: Record<string, number> = Object.fromEntries(
    payCategories(db.config).map((c) => [c.id, 0]),
  );
  for (const o of outflows(db))
    if (o.date.startsWith(month))
      byCategory[o.category] = (byCategory[o.category] ?? 0) + o.amount;
  const capex = byCategory[capexCategory] ?? 0;
  const opex = Object.values(byCategory).reduce((a, b) => a + b, 0) - capex;
  return { sales, gp, byCategory, opex, profit: sales - gp - opex, capex };
}
type LotInfo = {
  lot: Lot;
  sentKg: number;
  backKg: number;
  boxes: number;
  fee: number;
  meatCost: number;
  /** Core kinds with no live entry on the lot (V2-LOT-01). */
  missing: (typeof coreLotKinds)[number][];
  /** The first dispatch with no live PO in `poLotId` (V2-LOT-03). */
  unlinked: Entry | undefined;
  linked: boolean;
  /** How many things are yellow on the Lot: the missing kinds, plus one for an unlinked dispatch. */
  yellow: number;
  complete: boolean;
  yield: number | null;
  centralKg: number;
  costPerKg: number | null;
  meatPerBox: number | null;
  costPerBox: number | null;
};
/** The live `purchase` entry of a PO lot. */
const purchaseOf = (db: Database, poLotId: string) =>
  entries(db, "purchase", poLotId).at(-1);
/** V2-CAL-03..06, 08 and the Lot's status (V2-LOT-01..03). */
export function lotInfo(db: Database, lotId: string): LotInfo {
  const pos = new Set(purchaseLots(db).map((lot) => lot.id));
  const dispatches = entries(db, "dispatch", lotId);
  const sentKg = sum(dispatches, "dispatchKg");
  const backKg = sum(entries(db, "central", lotId), "centralKg");
  const fee = sum(entries(db, "smokingInvoice", lotId), "netPayable");
  const unlinked = dispatches.find((e) => !pos.has(e.values.poLotId));
  const linked = dispatches.length > 0 && !unlinked;
  const meatCost = dispatches.reduce(
    (total, e) =>
      total +
      (pos.has(e.values.poLotId)
        ? num(e.values, "dispatchKg") *
          num(purchaseOf(db, e.values.poLotId)?.values ?? {}, "price")
        : 0),
    0,
  );
  const missing = coreLotKinds.filter(
    (kind) => !entries(db, kind, lotId).length,
  );
  const yellow = missing.length + (dispatches.length && !linked ? 1 : 0);
  const costPerKg =
    linked && backKg > 0 && fee > 0 ? (meatCost + fee) / backKg : null;
  const meatPerBox =
    costPerKg === null ? null : costPerKg * num(db.config, "packKg");
  return {
    lot: db.lots.find((lot) => lot.id === lotId)!,
    sentKg,
    backKg,
    boxes: sum(entries(db, "central", lotId), "boxes"),
    fee,
    meatCost,
    missing,
    unlinked,
    linked,
    yellow,
    complete: yellow === 0,
    yield: sentKg && backKg ? backKg / sentKg : null,
    centralKg: backKg - sum(entries(db, "receive", lotId), "kg"),
    costPerKg,
    meatPerBox,
    costPerBox:
      meatPerBox === null ? null : meatPerBox + num(db.config, "packCost"),
  };
}
/** The cost of one box sold, from the newest Lot that has one (V2-CAL-06). */
export function boxCost(db: Database) {
  const info = shipments(db)
    .map((lot) => lotInfo(db, lot.id))
    .findLast((lot) => lot.meatPerBox !== null);
  return info?.meatPerBox == null
    ? null
    : {
        lotId: info.lot.id,
        meat: info.meatPerBox,
        pack: num(db.config, "packCost"),
        total: info.costPerBox!,
      };
}
/** V2-CAL-07: what a PO เนื้อ ordered, what went to the smoker from it, and what the seller still holds. */
export function poInfo(db: Database, poLotId: string) {
  const sent = entries(db, "dispatch").filter(
    (e) => e.values.poLotId === poLotId,
  );
  const orderedKg = num(purchaseOf(db, poLotId)?.values ?? {}, "orderedKg");
  const sentKg = sum(sent, "dispatchKg");
  return {
    orderedKg,
    sentKg,
    heldKg: orderedKg - sentKg,
    lotIds: [...new Set(sent.map((e) => e.lotId))],
  };
}
/** V2-CAL-09: the meat a sale or a gift box takes: the kg typed, else boxes × kg per box, plus waste. */
function meatUsedKg(config: Values, e: Entry) {
  const byBox = num(e.values, "boxes") * num(config, "packKg");
  if (e.kind === "influencerBox") return byBox;
  if (e.kind !== "sale") return 0;
  return (
    (typed(e.values, "soldKg") ? num(e.values, "soldKg") : byBox) +
    num(e.values, "wasteKg")
  );
}
/** One branch's live entries in the order a stock walk reads them. */
const branchWalk = (db: Database, branch: string) =>
  liveEntries(db)
    .filter((e) => e.branch === branch)
    .sort(byDateAt);
/** V2-CAL-10 / V2-BR-02: the last count is the truth; receipts add to it, sales and gifts take from it. */
export function branchMeat(db: Database, branch: string, today: string) {
  let kg = 0,
    counted: Entry | undefined;
  for (const e of branchWalk(db, branch))
    if (e.kind === "meatCount" && typed(e.values, "kg")) {
      kg = num(e.values, "kg");
      counted = e;
    } else if (e.kind === "receive") kg += num(e.values, "kg");
    else kg -= meatUsedKg(db.config, e);
  return { kg, counted, countedToday: counted?.date === today };
}
/** V2-CAL-11 / V2-BR-03: the last count, plus what payments bought for the branch since, less
 *  the boxes sold and given × `perBox`. Stale = never counted, or more than 7 days ago. */
export function branchMaterial(
  db: Database,
  branch: string,
  materialId: string,
  today: string,
) {
  const perBox =
    materialList(db.config).find((m) => m.id === materialId)?.perBox ?? 0;
  let qty = 0,
    countedOn = "";
  for (const e of branchWalk(db, branch))
    if (e.kind === "materials" && typed(e.values, `count.${materialId}`)) {
      qty = num(e.values, `count.${materialId}`);
      countedOn = e.date;
    } else if (e.kind === "pay" && e.values.item === materialId)
      qty += num(e.values, "qty");
    else if (e.kind === "sale" || e.kind === "influencerBox")
      qty -= num(e.values, "boxes") * perBox;
  const stale =
    !countedOn || Date.parse(today) - Date.parse(countedOn) > 7 * 86400000;
  return { qty, countedOn, stale };
}
/** V2-CAL-12: chili is counted in the sale form only; payments add, sales and gifts take. */
export function branchChili(db: Database, branch: string) {
  let qty = 0,
    countedOn = "";
  for (const e of branchWalk(db, branch))
    if (e.kind === "sale" && typed(e.values, "chiliCount")) {
      qty = num(e.values, "chiliCount");
      countedOn = e.date;
    } else if (e.kind === "sale" || e.kind === "influencerBox")
      qty -= num(e.values, "chiliAddons");
    else if (e.kind === "pay" && e.values.item === "chili")
      qty += num(e.values, "qty");
  return { qty, countedOn };
}
type SupplierBalance = {
  supplier: string;
  billed: number;
  paid: number;
  left: number;
};
/** V2-CAL-13: per supplier, the bills (a PO's Invoice amount, a Lot's ค่ารม, a payment's
 *  "ยอดเต็มของใบนี้") less the payments naming it. Only suppliers with a bill are listed. */
export function supplierBalances(db: Database): SupplierBalance[] {
  const all = new Map<string, { billed: number; paid: number; on: boolean }>();
  const of = (supplier: string) => {
    if (!all.has(supplier))
      all.set(supplier, { billed: 0, paid: 0, on: false });
    return all.get(supplier)!;
  };
  const bill = (supplier: string, amount: number) => {
    of(supplier).billed += amount;
    of(supplier).on = true;
  };
  for (const e of entries(db, "purchase"))
    if (e.values.supplier && typed(e.values, "invoiceAmount"))
      bill(e.values.supplier, num(e.values, "invoiceAmount"));
  for (const e of entries(db, "smokingInvoice"))
    bill(
      entries(db, "smokeOrder", e.lotId).at(-1)?.values.smoker || "Chef House",
      num(e.values, "netPayable"),
    );
  for (const e of entries(db, "pay")) {
    if (!e.values.supplier) continue;
    of(e.values.supplier).paid += num(e.values, "amount");
    if (typed(e.values, "fullAmount"))
      bill(e.values.supplier, num(e.values, "fullAmount"));
  }
  return [...all]
    .filter(([, balance]) => balance.on)
    .map(([supplier, { billed, paid }]) => ({
      supplier,
      billed,
      paid,
      left: billed - paid,
    }));
}
/** V2-PAY-07: what each person paid out of pocket, over every money-out line. */
export function advances(db: Database) {
  const by = new Map<string, number>();
  for (const o of outflows(db))
    if (o.payer && o.payer !== companyPayer)
      by.set(o.payer, (by.get(o.payer) ?? 0) + o.amount);
  return [...by].map(([payer, amount]) => ({ payer, amount }));
}
/** V2-CAL-14: the month's gift boxes and roughly what they cost; never part of the P&L. */
export function giftBoxes(db: Database, month: string) {
  const boxes = sum(
    entries(db, "influencerBox").filter((e) => e.date.startsWith(month)),
    "boxes",
  );
  const cost = boxCost(db);
  return { boxes, value: cost ? boxes * cost.total : null };
}
/** V2-PG-01: a day is green once the branch has a sale on it. */
export const hasSale = (db: Database, branch: string, date: string) =>
  entries(db, "sale", undefined, branch, date).length > 0;
