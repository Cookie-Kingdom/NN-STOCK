/** Figures recomputed from the entry log (stock, cost, yield, money); nothing here is stored.
 *  `today` is always a parameter (`YYYY-MM-DD`, Bangkok), so every function stays pure. */
import {
  canChange,
  capexCategory,
  centralPlace,
  changeKinds,
  companyPayer,
  coreLotKinds,
  type CoreLotKind,
  isRoundKind,
  roundKinds,
  type RoundKind,
  isEditOverlay,
  materialList,
  payCategories,
  salesChannels,
  legacySale,
  shopProject,
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
/** Every PO รมควัน (a shipment lot). */
export function shipments(db: Database) {
  return liveLots(db).filter((lot) => lot.kind === "shipment");
}
/** Oldest first: by business date, then by when it was typed (then log order: sort is stable). */
export const byDateAt = (
  a: { date: string; at: string },
  b: { date: string; at: string },
) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at);
/** V2-CAL-01: a sale's money in over every channel, and the GP the channels take from it.
 *  Money from the old books (`legacySale`) is already after GP: counted whole, GP 0. */
export function saleMoney(config: Values, sale: Entry) {
  let sales = num(sale.values, legacySale.key),
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
type Pl = {
  sales: number;
  gp: number;
  /** Boxes sold. */
  boxes: number;
  /** Sales per channel key (`legacySale.key` too, when there is some) and per branch ("": a
   *  sale with no branch, `noBranch`). */
  byChannel: Record<string, number>;
  byBranch: Record<string, number>;
  byCategory: Record<string, number>;
  opex: number;
  profit: number;
  capex: number;
};
/** V2-CAL-02 over the entries dated `from`..`to`, both ends included. อุปกรณ์/ลงทุน stays out
 *  of the profit. The bounds compare as text: a prefix is a `from` (`2026-09`), and a prefix
 *  with `~` behind it a `to` that takes in every date under it. */
export function plBetween(db: Database, from: string, to: string): Pl {
  const within = (date: string) => date >= from && date <= to;
  let sales = 0,
    gp = 0,
    boxes = 0;
  const byChannel: Record<string, number> = {};
  const byBranch: Record<string, number> = {};
  const channels = salesChannels(db.config);
  for (const sale of entries(db, "sale"))
    if (within(sale.date)) {
      const money = saleMoney(db.config, sale);
      sales += money.sales;
      gp += money.gp;
      boxes += num(sale.values, "boxes");
      byBranch[sale.branch] = (byBranch[sale.branch] ?? 0) + money.sales;
      for (const c of channels)
        byChannel[c.key] = (byChannel[c.key] ?? 0) + num(sale.values, c.key);
      // Listed only when there is some: `legacySale` is not a channel of Settings.
      const legacy = num(sale.values, legacySale.key);
      if (legacy)
        byChannel[legacySale.key] = (byChannel[legacySale.key] ?? 0) + legacy;
    }
  const byCategory: Record<string, number> = Object.fromEntries(
    payCategories(db.config).map((c) => [c.id, 0]),
  );
  for (const o of outflows(db))
    if (within(o.date))
      byCategory[o.category] = (byCategory[o.category] ?? 0) + o.amount;
  const capex = byCategory[capexCategory] ?? 0;
  const opex = Object.values(byCategory).reduce((a, b) => a + b, 0) - capex;
  return {
    sales,
    gp,
    boxes,
    byChannel,
    byBranch,
    byCategory,
    opex,
    profit: sales - gp - opex,
    capex,
  };
}
/** V2-CAL-02: one month (`YYYY-MM`, by entry date); a year (`YYYY`) or a day works the same. */
export const monthPl = (db: Database, month: string) =>
  plBetween(db, month, `${month}~`);
/** One PO เนื้อ a dispatch draws meat from (`poLines`). */
export type PoLine = { poLotId: string; kg: number };
/** Lines stored as JSON `[{ poLotId, kg }]`; `kg` "" reads as 0. Anything unreadable is no line. */
export function poLines(json = ""): PoLine[] {
  let rows: unknown = [];
  try {
    rows = JSON.parse(json || "[]");
  } catch {}
  return Array.isArray(rows)
    ? rows
        .filter((row) => row && typeof row.poLotId === "string")
        .map((row) => ({ poLotId: row.poLotId, kg: Number(row.kg) || 0 }))
    : [];
}
/** The POs เนื้อ a dispatch drew from. A dispatch saved before several POs (one `poLotId`)
 *  reads as one line of its whole `dispatchKg`. */
export const dispatchLines = (v: Values): PoLine[] =>
  v.poLines
    ? poLines(v.poLines)
    : v.poLotId
      ? [{ poLotId: v.poLotId, kg: num(v, "dispatchKg") }]
      : [];
/** The live `purchase` entry of a PO lot. */
const purchaseOf = (db: Database, poLotId: string) =>
  entries(db, "purchase", poLotId).at(-1);
/** The live invoice of a PO เนื้อ (`meatInvoice`) or a PO รมควัน (`smokingInvoice`): one per
 *  PO, `mutate` refuses a second. */
export const invoiceOf = (db: Database, lotId: string) =>
  entries(db, "meatInvoice", lotId).at(-1) ??
  entries(db, "smokingInvoice", lotId).at(-1);
/** A PO เนื้อ's terms: the invoice's meat kg, waste kg and price where it gives them (the real
 *  goods may differ from the PO), else the PO's. */
export function poTerms(db: Database, poLotId: string) {
  const po = purchaseOf(db, poLotId)?.values ?? {};
  const invoice = entries(db, "meatInvoice", poLotId).at(-1)?.values ?? {};
  const pick = (key: string) => num(typed(invoice, key) ? invoice : po, key);
  return {
    meatKg: pick("orderedKg"),
    wasteKg: pick("wasteKg"),
    price: pick("price"),
  };
}
/** Whether a dispatch's lines name live POs เนื้อ only and add up to its dispatchKg. `mutate`
 *  refuses a new one that does not; one saved before that rule (or whose PO was deleted since)
 *  can still be off. */
function isLinked(pos: Set<string>, e: Entry) {
  const lines = dispatchLines(e.values);
  if (!lines.length || lines.some((line) => !pos.has(line.poLotId)))
    return false;
  const total = lines.reduce((a, line) => a + line.kg, 0);
  return (
    !typed(e.values, "dispatchKg") ||
    Math.abs(total - num(e.values, "dispatchKg")) < 0.005
  );
}
/** Whether a dispatch is not fully linked to live POs เนื้อ (V2-LOT-03). */
export const isUnlinkedDispatch = (db: Database, e: Entry) =>
  e.kind === "dispatch" &&
  !isLinked(new Set(purchaseLots(db).map((lot) => lot.id)), e);
/** One dispatch round of a PO รมควัน and its steps (entries naming it in `dispatchId`). */
export type Round = {
  dispatch: Entry;
  /** TR-YYYY-NNNN */
  number: string;
  sentKg: number;
  /** Σ cmReceive.receivedKg, and whether one with a weight is jotted. */
  receivedKg: number;
  received: boolean;
  /** receivedKg − sentKg once received (0 = "ตรงกับตอนส่ง"), else null. */
  receiveDiffKg: number | null;
  /** Σ smoked.smokedKg, Σ smoked.boxes. */
  smokedKg: number;
  boxes: number;
  /** The waste base: receivedKg when received, else sentKg. */
  wasteBaseKg: number;
  /** wasteBaseKg − smokedKg once a smoked weight is jotted, else null; and as % of the base. */
  wasteKg: number | null;
  wastePct: number | null;
  /** Σ return.returnKg, Σ return.shippingFee (a round trip, both legs). */
  returnKg: number;
  shippingFee: number;
  /** The round's steps with no live entry. */
  missing: RoundKind[];
};
const roundLabel = (e: Entry) => e.values.transferNumber || e.date;
/** The dispatch rounds of a PO รมควัน, oldest first. A step whose `dispatchId` names no live
 *  dispatch of this lot belongs to no round and counts nowhere. */
export function roundsOf(db: Database, lotId: string): Round[] {
  return entries(db, "dispatch", lotId).map((dispatch) => {
    const of = (kind: RoundKind) =>
      entries(db, kind, lotId).filter(
        (e) => e.values.dispatchId === dispatch.id,
      );
    const sentKg = num(dispatch.values, "dispatchKg");
    const receives = of("cmReceive");
    const received = receives.some((e) => typed(e.values, "receivedKg"));
    const receivedKg = sum(receives, "receivedKg");
    const smoked = of("smoked");
    const smokedKg = sum(smoked, "smokedKg");
    const wasteBaseKg = received ? receivedKg : sentKg;
    const weighed = smoked.some((e) => typed(e.values, "smokedKg"));
    const wasteKg = weighed ? wasteBaseKg - smokedKg : null;
    const returns = of("return");
    return {
      dispatch,
      number: roundLabel(dispatch),
      sentKg,
      receivedKg,
      received,
      receiveDiffKg: received ? receivedKg - sentKg : null,
      smokedKg,
      boxes: sum(smoked, "boxes"),
      wasteBaseKg,
      wasteKg,
      wastePct:
        wasteKg !== null && wasteBaseKg > 0
          ? (wasteKg / wasteBaseKg) * 100
          : null,
      returnKg: sum(returns, "returnKg"),
      shippingFee: sum(returns, "shippingFee"),
      missing: roundKinds.filter((kind) => !of(kind).length),
    };
  });
}
/** The round a new `kind` note on `lotId` starts on: the newest one still missing that step,
 *  else the newest one. Undefined with no dispatch. */
export function defaultRound(db: Database, lotId: string, kind: RoundKind) {
  const rounds = roundsOf(db, lotId);
  return (
    rounds.findLast((round) => round.missing.includes(kind)) ?? rounds.at(-1)
  )?.dispatch;
}
type LotInfo = {
  lot: Lot;
  /** Σ smokeOrder.rawKg: the smoking bought (normally the one PO รมควัน note). */
  capacityKg: number;
  /** Σ dispatchKg over the rounds, and capacityKg − that (below 0 when sent past it). */
  sentKg: number;
  remainingKg: number;
  rounds: Round[];
  /** Totals over the rounds. backKg = Σ smokedKg: what yield, cost and the central stock use. */
  receivedKg: number;
  backKg: number;
  wasteKg: number;
  boxes: number;
  shippingFee: number;
  /** The PO รมควัน's one Chef House invoice: its netPayable. */
  fee: number;
  /** Σ over the dispatches' lines of kg × that PO เนื้อ's price (poTerms; live POs only). */
  meatCost: number;
  /** The steps not done (V2-LOT-01): `dispatch` with no round; a round kind when there is
   *  no round or a round lacks it; `smokingInvoice` with no invoice. */
  missing: CoreLotKind[];
  /** The first dispatch not fully linked (V2-LOT-03): only data saved before the rule, or
   *  whose PO เนื้อ was deleted since. */
  unlinked: Entry | undefined;
  linked: boolean;
  /** Missing steps, each round's missing steps beyond the first, and an unlinked dispatch. */
  yellow: number;
  complete: boolean;
  yield: number | null;
  centralKg: number;
  costPerKg: number | null;
  meatPerBox: number | null;
  costPerBox: number | null;
};
/** V2-CAL-03..06, 08, 16, 17 and the PO รมควัน's status (V2-LOT-01..03). */
export function lotInfo(db: Database, lotId: string): LotInfo {
  const pos = new Set(purchaseLots(db).map((lot) => lot.id));
  const dispatches = entries(db, "dispatch", lotId);
  const rounds = roundsOf(db, lotId);
  const total = (key: "receivedKg" | "smokedKg" | "boxes" | "shippingFee") =>
    rounds.reduce((a, round) => a + round[key], 0);
  const capacityKg = sum(entries(db, "smokeOrder", lotId), "rawKg");
  const sentKg = sum(dispatches, "dispatchKg");
  const backKg = total("smokedKg");
  const shippingFee = total("shippingFee");
  const fee = num(invoiceOf(db, lotId)?.values ?? {}, "netPayable");
  const unlinked = dispatches.find((e) => !isLinked(pos, e));
  const linked = dispatches.length > 0 && !unlinked;
  let meatCost = 0;
  for (const e of dispatches)
    for (const line of dispatchLines(e.values))
      if (pos.has(line.poLotId))
        meatCost += line.kg * poTerms(db, line.poLotId).price;
  const missing = coreLotKinds.filter((kind) =>
    kind === "dispatch"
      ? !rounds.length
      : kind === "smokingInvoice"
        ? !entries(db, kind, lotId).length
        : !rounds.length ||
          rounds.some((round) => round.missing.includes(kind)),
  );
  const roundGaps = rounds.reduce((a, round) => a + round.missing.length, 0);
  const yellow =
    missing.length +
    Math.max(0, roundGaps - missing.filter(isRoundKind).length) +
    (dispatches.length && !linked ? 1 : 0);
  // V2-CAL-05: (meat + the Chef House invoice + shipping) ÷ the weight after smoking.
  const costPerKg =
    linked && backKg > 0 && fee > 0
      ? (meatCost + fee + shippingFee) / backKg
      : null;
  const meatPerBox =
    costPerKg === null ? null : costPerKg * num(db.config, "packKg");
  return {
    lot: db.lots.find((lot) => lot.id === lotId)!,
    capacityKg,
    sentKg,
    remainingKg: capacityKg - sentKg,
    rounds,
    receivedKg: total("receivedKg"),
    backKg,
    wasteKg: rounds.reduce((a, round) => a + (round.wasteKg ?? 0), 0),
    boxes: total("boxes"),
    shippingFee,
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
/** What a PO รมควัน has left to send, without the dispatch `exceptId` (the one being edited):
 *  what a dispatch form prefills. Below 0 when sent past it. */
export function remainingKg(db: Database, lotId: string, exceptId?: string) {
  return (
    sum(entries(db, "smokeOrder", lotId), "rawKg") -
    sum(
      entries(db, "dispatch", lotId).filter((e) => e.id !== exceptId),
      "dispatchKg",
    )
  );
}
/** The warning a dispatch form shows (never a refusal): "" while `kg` fits what the PO
 *  รมควัน has left, else how far past it. */
export function capacityWarning(
  db: Database,
  lotId: string,
  kg: number,
  exceptId?: string,
) {
  const left = remainingKg(db, lotId, exceptId);
  return kg > left + 0.005
    ? `เกินน้ำหนักของ PO รมควัน ${fmtKg(kg - left)} กก. (เหลือ ${fmtKg(Math.max(0, left))} กก.) แต่ยังบันทึกได้`
    : "";
}
const fmtKg = (x: number) =>
  x.toLocaleString("th-TH", { maximumFractionDigits: 2 });
/** The cost of one box sold, from the newest PO รมควัน that has one (V2-CAL-06). */
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
/** V2-CAL-07: what a PO เนื้อ holds (its meat kg, the invoice's when it gives one), what went to
 *  the smoker from it (its lines on every dispatch, without `exceptId`: the one being edited),
 *  and what the seller still holds. Waste is apart: it is never sent. `wastePending`: waste to
 *  receive and no `ownerWasteReceive` jotted yet. */
export function poInfo(db: Database, poLotId: string, exceptId?: string) {
  const terms = poTerms(db, poLotId);
  let sentKg = 0;
  const lotIds = new Set<string>();
  for (const e of entries(db, "dispatch")) {
    if (e.id === exceptId) continue;
    for (const line of dispatchLines(e.values))
      if (line.poLotId === poLotId) {
        sentKg += line.kg;
        lotIds.add(e.lotId);
      }
  }
  const received = entries(db, "ownerWasteReceive", poLotId);
  return {
    orderedKg: terms.meatKg,
    price: terms.price,
    sentKg,
    heldKg: terms.meatKg - sentKg,
    lotIds: [...lotIds],
    wasteKg: terms.wasteKg,
    wasteReceivedKg: sum(received, "receivedKg"),
    wastePending: terms.wasteKg > 0 && !received.length,
    invoice: entries(db, "meatInvoice", poLotId).at(-1),
  };
}
/** The meat lines of the Stock page before the branches: what each PO เนื้อ still holds at
 *  the seller (V2-CAL-07) and what each PO รมควัน holds in the central warehouse (V2-CAL-08),
 *  only those with some. A lot carried over from the old workbook (`old`) holds no stock:
 *  backdated stock is never the true one, so stock starts from what is jotted from now on.
 *  Its own page (Old Lots), cost and money still read `poInfo` / `lotInfo`. */
export function meatStock(db: Database) {
  return {
    held: purchaseLots(db)
      .filter((lot) => !lot.old)
      .map((lot) => ({ lot, kg: poInfo(db, lot.id).heldKg }))
      .filter((po) => po.kg > 0),
    central: shipments(db)
      .filter((lot) => !lot.old)
      .map((lot) => lotInfo(db, lot.id))
      .filter((info) => info.backKg > 0),
  };
}
/** The kg a dispatch form prefills for a PO เนื้อ just added to its lines: what that PO still
 *  holds (without the dispatch being edited, `exceptId`), capped by what the other lines still
 *  leave of `targetKg` (the typed dispatchKg). With no target: all it holds. Never below 0.
 *  Target 1000, PO-001 holds 500, PO-002 holds 600: PO-001 → 500, then PO-002 → 500. */
export function prefillLineKg(
  db: Database,
  poLotId: string,
  lines: { poLotId: string; kg: number | string }[],
  targetKg?: number | null,
  exceptId?: string,
): number {
  const held = poInfo(db, poLotId, exceptId).heldKg;
  if (!targetKg || !(targetKg > 0)) return Math.max(0, held);
  const others = lines
    .filter((line) => line.poLotId !== poLotId)
    .reduce((a, line) => a + (Number(line.kg) || 0), 0);
  return Math.max(0, Math.min(held, targetKg - others));
}
/** The smoke service rate per kg for `kg` (Settings tiers): from 1,500 kg, from 1,000, below. */
export function smokeServiceRate(config: Values, kg: number) {
  if (kg >= 1500) return num(config, "smokeRate1500");
  if (kg >= 1000) return num(config, "smokeRate1000");
  return num(config, "smokeRate");
}
/** The number the next document of `kind` gets, as `mutate` issues it on `date`: PO เนื้อ
 *  `PO-YYYY-NNNN`, PO รมควัน `SO-YYYY-NNNN` (the lot's number and the entry's orderNumber),
 *  dispatch `TR-YYYY-NNNN`, return `TR-YYYY-RNNNN`. Deleted ones count: a number is never given
 *  twice. Null for a kind with no number. A draft shows it; the saved one may differ when
 *  another device saved first. */
export function nextNumberPreview(
  db: Database,
  kind: EntryKind,
  date: string,
): string | null {
  const year = date.slice(0, 4);
  const pad = (count: number) => String(count).padStart(4, "0");
  const of = (k: EntryKind) =>
    pad(db.entries.filter((e) => e.kind === k).length + 1);
  if (kind === "purchase")
    return `PO-${year}-${pad(db.lots.filter((lot) => !lot.kind).length + 1)}`;
  if (kind === "smokeOrder")
    return `SO-${year}-${pad(db.lots.filter((lot) => lot.kind).length + 1)}`;
  if (kind === "dispatch") return `TR-${year}-${of("dispatch")}`;
  if (kind === "return") return `TR-${year}-R${of("return")}`;
  return null;
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
/** V2-CAL-10 / V2-BR-02: the last count is the truth; receipts add to it, sales and gifts take
 *  from it. A receipt of an old lot adds nothing: that lot holds no stock (`meatStock`). */
export function branchMeat(db: Database, branch: string, today: string) {
  const old = new Set(db.lots.filter((lot) => lot.old).map((lot) => lot.id));
  let kg = 0,
    counted: Entry | undefined,
    variance: CountVariance | undefined;
  for (const e of branchWalk(db, branch))
    if (e.kind === "meatCount" && typed(e.values, "kg")) {
      const now = num(e.values, "kg");
      variance = counted && varianceAt(kg, now, e.date);
      kg = now;
      counted = e;
    } else if (e.kind === "receive")
      kg += old.has(e.lotId) ? 0 : num(e.values, "kg");
    else kg -= meatUsedKg(db.config, e);
  return { kg, counted, countedToday: counted?.date === today, variance };
}
/** The latest count of a stock line against the walk just before it: what the web expected
 *  to be left (the count before it, plus what came in, less what was used), what was
 *  counted, and `diff` = counted − expected. Only a count with a live count before it has
 *  one: a first count has nothing true to start from, so the web invents no figure. */
export type CountVariance = {
  expected: number;
  counted: number;
  diff: number;
  date: string;
};
const varianceAt = (
  expected: number,
  counted: number,
  date: string,
): CountVariance => ({ expected, counted, diff: counted - expected, date });
/** A count is late when there is none, or the last one is more than 7 days before `today`. */
const staleCount = (countedOn: string, today: string) =>
  !countedOn || Date.parse(today) - Date.parse(countedOn) > 7 * 86400000;
/** The live receipt of a `transfer` sent with "confirm": the destination branch's own. */
const receiptOf = (db: Database, transfer: Entry) =>
  entries(db, "transferReceive", undefined, transfer.values.to).find(
    (e) => e.values.transferId === transfer.id,
  );
const awaitsReceipt = (e: Entry) =>
  e.values.to !== centralPlace && e.values.receive === "confirm";
/** The `transfer` entries still waiting for `branch` to confirm, oldest first. */
export const pendingTransfers = (db: Database, branch: string) =>
  entries(db, "transfer")
    .filter(
      (e) => e.values.to === branch && awaitsReceipt(e) && !receiptOf(db, e),
    )
    .sort(byDateAt);
/** One SKU's quantity into (+) or out of (−) a place: "central" or a branch name. */
type StockMove = {
  sku: string;
  place: string;
  qty: number;
  date: string;
  at: string;
};
/** Every move of SKU stock in the log: what an `expense` of the shop project bought goes into
 *  its warehouse (the central one unless it names a branch; a cancelled row buys nothing), and
 *  a `transfer` leaves `from` on its date and arrives at `to`, at once or, sent with "confirm",
 *  when the branch's receipt says so. Until then it is in `transit`, in neither place. Only a
 *  SKU with a typed quantity moves. Nothing is refused: a balance may go below zero.
 *  ponytail: walks the expenses and transfers per call; cache per log (as entryIndex) if a
 *  long one gets slow. */
export function stockMoves(db: Database) {
  const moves: StockMove[] = [];
  const transit: Entry[] = [];
  const move = (v: Values, place: string, sign: number, on: Entry) => {
    if (place)
      moves.push({
        sku: v.sku,
        place,
        qty: sign * num(v, "qty"),
        date: on.date,
        at: on.at,
      });
  };
  for (const e of entries(db, "expense")) {
    const v = e.values;
    if (
      v.sku &&
      typed(v, "qty") &&
      v.purpose === "project" &&
      (v.project ?? "").trim() === shopProject &&
      v.status !== "cancelled"
    )
      move(v, v.warehouse || centralPlace, 1, e);
  }
  for (const e of entries(db, "transfer")) {
    const v = e.values;
    if (!v.sku || !typed(v, "qty")) continue;
    move(v, v.from, -1, e);
    const arrived = awaitsReceipt(e) ? receiptOf(db, e) : e;
    if (arrived) move(v, v.to, 1, arrived);
    else transit.push(e);
  }
  return { moves, transit };
}
/** V2-CAL-11 / V2-BR-03: the last count, plus what payments bought for the branch since and
 *  what the warehouses moved in or out of it (`stockMoves`), less the boxes sold and given ×
 *  `perBox`. Stale = never counted, or more than 7 days ago. */
export function branchMaterial(
  db: Database,
  branch: string,
  materialId: string,
  today: string,
) {
  const material = materialList(db.config).find((m) => m.id === materialId);
  const perBox = material?.perBox ?? 0;
  const moved = material?.sku
    ? stockMoves(db).moves.filter(
        (m) => m.sku === material.sku && m.place === branch,
      )
    : [];
  let qty = 0,
    countedOn = "",
    variance: CountVariance | undefined;
  for (const e of moved.length
    ? [...branchWalk(db, branch), ...moved].sort(byDateAt)
    : branchWalk(db, branch))
    if (!("kind" in e)) qty += e.qty;
    else if (e.kind === "materials" && typed(e.values, `count.${materialId}`)) {
      const now = num(e.values, `count.${materialId}`);
      variance = countedOn ? varianceAt(qty, now, e.date) : undefined;
      qty = now;
      countedOn = e.date;
    } else if (e.kind === "pay" && e.values.item === materialId)
      qty += num(e.values, "qty");
    else if (e.kind === "sale" || e.kind === "influencerBox")
      qty -= num(e.values, "boxes") * perBox;
  return { qty, countedOn, stale: staleCount(countedOn, today), variance };
}
/** V2-CAL-12: chili is counted in the sale form only; payments add, sales and gifts take.
 *  Stale as a material is. */
export function branchChili(db: Database, branch: string, today: string) {
  let qty = 0,
    countedOn = "",
    variance: CountVariance | undefined;
  for (const e of branchWalk(db, branch))
    if (e.kind === "sale" && typed(e.values, "chiliCount")) {
      // The count is the end of that day's sale form: its own tubes were sold before it.
      const now = num(e.values, "chiliCount");
      variance = countedOn
        ? varianceAt(qty - num(e.values, "chiliAddons"), now, e.date)
        : undefined;
      qty = now;
      countedOn = e.date;
    } else if (e.kind === "sale" || e.kind === "influencerBox")
      qty -= num(e.values, "chiliAddons");
    else if (e.kind === "pay" && e.values.item === "chili")
      qty += num(e.values, "qty");
  return { qty, countedOn, stale: staleCount(countedOn, today), variance };
}
/** V2-CAL-19: raw sticky rice (kg) is counted only, in the materials count: the last count
 *  plus what payments bought for the branch since. Nothing is taken off between counts (cooked
 *  rice is not kept overnight and is not tracked). Stale as a material is. */
export function branchRice(db: Database, branch: string, today: string) {
  let qty = 0,
    countedOn = "";
  for (const e of branchWalk(db, branch))
    if (e.kind === "materials" && typed(e.values, "count.rice")) {
      qty = num(e.values, "count.rice");
      countedOn = e.date;
    } else if (e.kind === "pay" && e.values.item === "rice")
      qty += num(e.values, "qty");
  return { qty, countedOn, stale: staleCount(countedOn, today) };
}
type SupplierBalance = {
  supplier: string;
  billed: number;
  paid: number;
  left: number;
};
/** V2-CAL-13: per supplier, the bills (a PO เนื้อ's Invoice Foodiva, a PO รมควัน's Chef House invoice, a payment's
 *  "ยอดเต็มจำนวน") less the payments naming it. Only suppliers with a bill are listed. */
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
  // A PO เนื้อ's invoice (or, saved before meatInvoice, the PO's own Invoice amount).
  for (const e of entries(db, "purchase")) {
    const invoice = entries(db, "meatInvoice", e.lotId).at(-1);
    const amount = invoice
      ? num(invoice.values, "netPayable")
      : num(e.values, "invoiceAmount");
    if (e.values.supplier && (invoice || typed(e.values, "invoiceAmount")))
      bill(e.values.supplier, amount);
  }
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
/** A money-out line a person paid out of pocket, not the company (V2-PAY-07). */
const isAdvance = (o: Outflow) => !!o.payer && o.payer !== companyPayer;
/** V2-PAY-07: per person, what they paid out of pocket over every money-out line, what the
 *  shop paid back (`reimburse`) and what it still owes them. */
export function advances(db: Database) {
  const by = new Map<string, { advanced: number; repaid: number }>();
  const of = (payer: string) => {
    if (!by.has(payer)) by.set(payer, { advanced: 0, repaid: 0 });
    return by.get(payer)!;
  };
  for (const o of outflows(db))
    if (isAdvance(o)) of(o.payer).advanced += o.amount;
  for (const e of entries(db, "reimburse"))
    if (e.values.payer) of(e.values.payer).repaid += num(e.values, "amount");
  return [...by].map(([payer, x]) => ({
    payer,
    ...x,
    left: x.advanced - x.repaid,
  }));
}
/** V2-PAY-08: the money of the entries dated `from`..`to` (text bounds, as `plBetween`), by
 *  whose pocket it left. `paid` is every money-out line, the expense the P&L counts (capex
 *  with it): `company` of it left the shop then, `advanced` left a person's pocket. `repaid`
 *  is what the shop paid people back in the span: no expense, it was one when they paid.
 *  `out` is what really left the shop: `company` + `repaid`. */
export function cashBetween(db: Database, from: string, to: string) {
  const within = (date: string) => date >= from && date <= to;
  let company = 0,
    advanced = 0;
  for (const o of outflows(db))
    if (within(o.date)) {
      if (isAdvance(o)) advanced += o.amount;
      else company += o.amount;
    }
  const repaid = sum(
    entries(db, "reimburse").filter((e) => within(e.date)),
    "amount",
  );
  return {
    paid: company + advanced,
    company,
    advanced,
    repaid,
    out: company + repaid,
  };
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
