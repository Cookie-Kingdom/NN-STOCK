/** Figures recomputed from the entry log (stock, cost, yield, invoices); nothing here is stored. */
import { fmt, today } from "../format";
import {
  batchKinds,
  canChange,
  canLink,
  isEditOverlay,
  materials,
  titles,
  type Database,
  type Entry,
  type EntryKind,
  type Lot,
  type ShipmentLine,
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
type EntryIndex = {
  length: number;
  voided: Set<string>;
  fixes: Map<string, Values>;
  byKind: Map<EntryKind, Entry[]>;
};
/* The void set, the edit overlays and a by-kind list are built once per log and reused by
 * every entries() call on it. The log only grows, so its length tells a stale index apart. */
const entryIndexes = new WeakMap<Entry[], EntryIndex>();
function entryIndex(db: Database): EntryIndex {
  const cached = entryIndexes.get(db.entries);
  if (cached?.length === db.entries.length) return cached;
  /* A delete counts when its author may change the target (canChange), and only while it is
   * not deleted itself: that is the undo (EDT-23). A void of a void always comes later in the
   * log, so walking newest first settles each one before it is read. */
  const byId = new Map(db.entries.map((entry) => [entry.id, entry]));
  const voided = new Set<string>();
  for (let i = db.entries.length - 1; i >= 0; i--) {
    const entry = db.entries[i];
    if (entry.kind !== "void" || voided.has(entry.id)) continue;
    const target = byId.get(entry.values.targetId);
    if (entry.role === "owner" || (target && canChange(entry, target)))
      voided.add(entry.values.targetId);
  }
  // chefEdit is append-only: its corrections overlay the receive/prepare/smoke entries it names.
  const fixes = new Map<string, Values>();
  const fix = (id: string | undefined, values: Values) => {
    if (id) fixes.set(id, { ...fixes.get(id), ...values });
  };
  // EDT-24: an edit may also re-date its target or move it to another lot.
  const moves = new Map<string, { date?: string; lotId?: string }>();
  for (const e of db.entries) {
    if (voided.has(e.id)) continue;
    // B5 edits overlay the same way, in log order: a later edit wins.
    if (isEditOverlay(e, byId.get(e.values.targetId))) {
      fix(e.values.targetId, unpack("to.", e.values));
      if (e.values.toDate || e.values.toLotId)
        moves.set(e.values.targetId, {
          ...moves.get(e.values.targetId),
          ...(e.values.toDate && { date: e.values.toDate }),
          ...(e.values.toLotId && { lotId: e.values.toLotId }),
        });
    }
    if (e.kind !== "chefEdit") continue;
    fix(e.values.receiveId, {
      receivedKg: e.values.receivedKg,
      arrival: e.values.arrival,
    });
    fix(e.values.prepareId, { preSmokeKg: e.values.preSmokeKg });
    for (const { id, ...batch } of JSON.parse(
      e.values.batches || "[]",
    ) as Values[])
      fix(id, batch);
  }
  /* A `link` ties its target to a batch (`lotId`) after the fact (DM-07). Log order, voided
   * links skipped: the latest live link wins, and voiding it falls back to the one before
   * (LNK-05). A link `canLink` refuses (another branch's entry) is ignored. */
  const lots = new Map<string, string>();
  for (const e of db.entries) {
    const target = e.kind === "link" && byId.get(e.values.targetId);
    if (target && e.values.lotId && !voided.has(e.id) && canLink(e, target))
      lots.set(e.values.targetId, e.values.lotId);
  }
  const byKind = new Map<EntryKind, Entry[]>();
  for (const raw of db.entries) {
    if (voided.has(raw.id)) continue;
    const linked = lots.get(raw.id);
    const move = moves.get(raw.id);
    const e =
      linked || move
        ? {
            ...raw,
            date: move?.date || raw.date,
            lotId: linked || move?.lotId || raw.lotId,
          }
        : raw;
    const list = byKind.get(e.kind);
    if (list) list.push(e);
    else byKind.set(e.kind, [e]);
  }
  const index = { length: db.entries.length, voided, fixes, byKind };
  entryIndexes.set(db.entries, index);
  return index;
}
/** Whether a void that counts (see entryIndex) names this entry. */
export const isVoided = (db: Database, id: string) =>
  entryIndex(db).voided.has(id);
/** Live entries of one kind, with edits (values, date, lot), chefEdit and `link` overlaid. `lotId === ""` is the
 *  branch's "ไม่ระบุ Lot" bucket (BR-04); leave it `undefined` for every lot. */
export function entries(
  db: Database,
  kind: EntryKind,
  lotId?: string,
  branch?: string,
  date?: string,
) {
  const { fixes, byKind } = entryIndex(db);
  return (byKind.get(kind) ?? [])
    .filter(
      (e) =>
        (lotId === undefined || e.lotId === lotId) &&
        (!branch || e.branch === branch) &&
        (!date || e.date === date),
    )
    .map((e) => {
      const values = fixes.get(e.id);
      return values ? { ...e, values: { ...e.values, ...values } } : e;
    });
}
/** Bag total of one smoke batch. Batches written before the preKg/outputKg rename
 * carry no `postSmokeKg`, but `packs` was never renamed, so it recovers the weight. */
const smokeOutputKg = (values: Values) =>
  values.postSmokeKg !== undefined
    ? num(values, "postSmokeKg")
    : validPackWeights(values.packs).reduce((a, b) => a + b, 0);
export function produced(db: Database, lotId: string) {
  return entries(db, "smoke", lotId).reduce(
    (a, e) => a + smokeOutputKg(e.values),
    0,
  );
}
export function producedBags(db: Database, lotId: string) {
  return sum(entries(db, "smoke", lotId), "packCount");
}
/** Bag weights typed one per line or comma-separated. Bad tokens stay NaN so `mutate` can reject them. */
export const packWeights = (packs = "") =>
  packs
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
export const isPackWeight = (weight: number) =>
  Number.isFinite(weight) && weight > 0;
export const validPackWeights = (packs = "") =>
  packWeights(packs).filter(isPackWeight);
export function processed(db: Database, lotId: string) {
  return sum(entries(db, "smoke", lotId), "inputKg");
}
/** Kinds already recorded (not voided) on a lot: what "ยังขาด" chips and alerts read (SMK-07).
 *  Never a gate. Edits, links and voids are bookkeeping, not steps. */
const bookkeeping: EntryKind[] = [
  "link",
  "entryEdit",
  "editRequest",
  "editDecision",
  "void",
];
/** Every live entry that is a step: a deleted one is none, an edited one is where the edit
 *  put it (EDT-24), and an edit, a link or a delete is no entry of its own. */
export const liveEntries = (db: Database) =>
  [...entryIndex(db).byKind.keys()]
    .filter((kind) => !bookkeeping.includes(kind))
    .flatMap((kind) => entries(db, kind));
export function lotProgress(db: Database, lotId: string): Set<EntryKind> {
  const done = new Set<EntryKind>();
  for (const [kind, list] of entryIndex(db).byKind)
    if (!bookkeeping.includes(kind) && list.some((e) => e.lotId === lotId))
      done.add(kind);
  return done;
}
/** RET-04: central kg less allocations and less what branches took straight from the batch
 *  (a `receive` on it with no allocation, beyond what fills an allocation: DM-08). The kg is
 *  the live `central` entry's (edits and voids applied); a branch's payload has no Owner
 *  entries, so there it is the lot cache. */
export function centralStock(db: Database, lotId: string) {
  const lot = db.lots.find((l) => l.id === lotId);
  const recorded = db.entries.some(
    (e) => e.kind === "central" && e.lotId === lotId,
  );
  const central = recorded
    ? entries(db, "central", lotId).at(-1)?.values
    : lot?.values;
  const unallocated = entries(db, "receive", lotId).filter(
    (r) => !r.values.allocation,
  );
  return (
    num(central || {}, "centralKg") -
    sum(entries(db, "allocate", lotId), "kg") -
    [...new Set(unallocated.map((r) => r.branch))].reduce(
      (total, branch) => total + unallocatedFill(db, lotId, branch).straight,
      0,
    )
  );
}
/** Raw beef at Foodiva waiting to go to Chef House, the one figure every screen shows for it:
 *  the PO's ready-for-Chiang-Mai kg (the ordered kg until Foodiva invoices) less what trucks
 *  have taken. The part kept for the Owner (Waste) is apart: `ownerWasteOutstanding`. */
export function rawAtFoodiva(db: Database, lot: Lot) {
  // A shipment's beef is counted on the purchase POs it draws from.
  if (lot.kind) return 0;
  const ready = entries(db, "foodivaConfirm", lot.id).length
    ? readyForChefHouse(db, lot.id)
    : n(lot.values, "orderedKg");
  const smoker = drawnKg(db, lot.id, true);
  // Legacy: early builds could record "steakTransfer" (raw beef moved to Steak). No UI creates
  // it any more, but app_state history is append-only, so old transfers still leave Foodiva.
  const steak = sum(entries(db, "steakTransfer", lot.id), "quantityKg");
  return Math.max(0, ready - smoker - steak);
}
/** Smoked beef Foodiva took into its freezer that the Owner has not counted into central yet. */
export function smokedAtFoodiva(db: Database, lot: Lot) {
  const received = entries(db, "foodivaReturnReceive", lot.id).at(-1);
  return Math.max(
    0,
    n(received?.values || {}, "receivedKg") - n(lot.values, "centralKg"),
  );
}
export function readyForChefHouse(db: Database, lotId: string) {
  const confirmation = entries(db, "foodivaConfirm", lotId).at(-1);
  if (!confirmation) return 0;
  return confirmation.values.readyForChiangMaiKg !== undefined
    ? n(confirmation.values, "readyForChiangMaiKg")
    : n(confirmation.values, "confirmedKg");
}
/** Lots still in use. A PO whose `purchase` was deleted, or a batch with every step deleted,
 *  stays in `lots` (ids and numbers are never reused) with only `deleted` in its cache: the
 *  Owner's save writes it, so a branch, which holds no Owner entries, reads it too. */
export const liveLots = (db: Database) =>
  db.lots.filter((lot) => !lot.values.deleted);
export const purchaseLots = (db: Database) =>
  liveLots(db).filter((lot) => !lot.kind);
/** EDT-23: other live entries stand on this PO, or a live smoke PO draws from it. */
export const poInUse = (db: Database, lotId: string) =>
  lotProgress(db, lotId).size > 1 ||
  shipments(db).some((lot) =>
    batchLines(db, lot).some((line) => line.lotId === lotId),
  );
/** A batch's live steps in log order: what its values cache is rebuilt from (DM-09). */
export function batchEntries(db: Database, lotId: string) {
  const position = new Map(db.entries.map((e, index) => [e.id, index]));
  return batchKinds
    .flatMap((kind) => entries(db, kind, lotId))
    .sort((a, b) => position.get(a.id)! - position.get(b.id)!);
}
export function shipmentLines(lot: Lot): ShipmentLine[] {
  return (JSON.parse(lot.values.lines || "[]") as Values[]).map((line) => ({
    lotId: line.lotId,
    kg: Number(line.kg),
  }));
}
/** The lines of a batch's live smoke PO (edits and voids applied); the lot cache is only a
 *  copy of them. Nothing without a smoke PO. */
const batchLines = (db: Database, lot: Lot): ShipmentLine[] => {
  const order = entries(db, "smokeOrder", lot.id).at(-1);
  return order ? shipmentLines({ ...lot, values: order.values }) : [];
};
/** RET-07: the batch's smoke PO names at least one purchase PO, so its meat can be traced
 *  back and costed. Advice only: an unmatched batch still moves on (SMK-05 matches it later). */
export function poMatched(db: Database, lotId: string) {
  const lot = db.lots.find((l) => l.id === lotId);
  return !!lot && batchLines(db, lot).length > 0;
}
/** Every shipment batch (Lot S). */
export function shipments(db: Database) {
  return liveLots(db).filter((lot) => lot.kind === "shipment");
}
/** Shipments with no truck home yet (RET-06): the Owner may book the return whenever the
 *  truck is arranged, closed lot or not. The return screen lists these and the Owner's
 *  "Chef House closed the lot" alert is the closed subset, so an alerted lot is always a row. */
export function awaitingReturn(db: Database) {
  return shipments(db).filter((lot) => !entries(db, "return", lot.id).length);
}
/** Kg of one purchase PO that smoke POs draw (only batches already trucked with `dispatchedOnly`, PO-05). */
export function drawnKg(
  db: Database,
  purchaseLotId: string,
  dispatchedOnly = false,
) {
  return shipments(db)
    .filter((lot) => !dispatchedOnly || entries(db, "dispatch", lot.id).length)
    .flatMap((lot) => batchLines(db, lot))
    .filter((line) => line.lotId === purchaseLotId)
    .reduce((total, line) => total + line.kg, 0);
}
/** PO-06: what a purchase PO can still send to Chef House — Foodiva's ready-for-Chiang-Mai kg
 *  (the ordered kg until it invoices) less every smoke PO line that draws on it. */
export function poRemainingKg(db: Database, purchaseLotId: string) {
  const lot = db.lots.find((l) => l.id === purchaseLotId);
  const ready = entries(db, "foodivaConfirm", purchaseLotId).length
    ? readyForChefHouse(db, purchaseLotId)
    : n(lot?.values || {}, "orderedKg");
  return ready - drawnKg(db, purchaseLotId);
}
export function latestPackingList(db: Database, lotId: string) {
  return entries(db, "packingList", lotId).at(-1);
}
/** What actually went to Chef House: the box total of the shipment's latest Packing List.
 *  `undefined` until Foodiva makes one; the Request kg is only what was asked for. */
export function packingListKg(db: Database, lotId: string) {
  const list = latestPackingList(db, lotId);
  // A list saved without its total (GEN-02) says nothing about the kg.
  return list?.values.slicedNetKg?.trim()
    ? n(list.values, "slicedNetKg")
    : undefined;
}
/** A batch's kg and meat cost split back to the purchase POs its smoke PO draws on, pro rata
 * to each line: on Chef House's received kg once weighed in, on the line kg before that. */
export function shipmentShares(db: Database, shipment: Lot) {
  const lines = batchLines(db, shipment);
  const requested = lines.reduce((total, line) => total + line.kg, 0);
  const base = n(shipment.values, "receivedKg") || requested;
  return lines.map((line) => {
    const po = db.lots.find((lot) => lot.id === line.lotId);
    const kg = requested > 0 ? (base * line.kg) / requested : 0;
    const price = n(po?.values || {}, "price");
    return {
      lotId: line.lotId,
      poId: po?.poId || "",
      requestedKg: line.kg,
      kg,
      price,
      meat: kg * price,
    };
  });
}
/** One batch end to end for the Owner: purchase POs → truck → Chef House's yellow total →
 *  smoked boxes → return truck → Foodiva's freezer. Each step is `undefined` on its own when
 *  not recorded, whatever the others are (RET-05). */
export function shipmentChain(db: Database, shipment: Lot) {
  const kg = (kind: EntryKind, key: string) => {
    const entry = entries(db, kind, shipment.id).at(-1);
    return entry ? n(entry.values, key) : undefined;
  };
  const smoked = entries(db, "smoke", shipment.id).length > 0;
  return {
    lines: shipmentShares(db, shipment),
    requestedKg: n(shipment.values, "requestedKg"),
    sentKg: packingListKg(db, shipment.id),
    chefReceivedKg: entries(db, "cmReceive", shipment.id).length
      ? n(shipment.values, "receivedKg")
      : undefined,
    smokedBoxes: smoked ? producedBags(db, shipment.id) : undefined,
    smokedKg: smoked ? produced(db, shipment.id) : undefined,
    returnKg: kg("return", "returnKg"),
    foodivaKg: kg("foodivaReturnReceive", "receivedKg"),
    foodivaBoxes: kg("foodivaReturnReceive", "receivedBags"),
  };
}
export function reservedForOwnerContent(db: Database, lotId: string) {
  const confirmation = entries(db, "foodivaConfirm", lotId).at(-1);
  return confirmation ? n(confirmation.values, "reservedForOwnerKg") : 0;
}
export function ownerWasteReceived(db: Database, lotId: string) {
  return sum(entries(db, "ownerWasteReceive", lotId), "receivedKg");
}
/** A8 — of the meat Foodiva keeps for the Owner on a purchase PO (`reservedForOwnerKg` on its
 *  latest invoice), what the Owner has not picked up yet (`ownerWasteReceive`). It is apart
 *  from `poRemainingKg`, which counts only the ready-for-Chiang-Mai kg. */
export function ownerWasteOutstanding(db: Database, lotId: string) {
  return Math.max(
    0,
    reservedForOwnerContent(db, lotId) - ownerWasteReceived(db, lotId),
  );
}
/** Trim between what Chef House weighed in and what went to pre-smoke prep. It is
 * loss, not stock: without naming it the remainder sat at the smoker forever. */
export function preSmokeTrimKg(db: Database, lot: Lot) {
  if (!entries(db, "prepare", lot.id).length) return 0;
  return Math.max(0, n(lot.values, "receivedKg") - n(lot.values, "preSmokeKg"));
}
export function rawAtSmoker(db: Database, lot: Lot) {
  return Math.max(
    0,
    n(lot.values, "receivedKg") -
      preSmokeTrimKg(db, lot) -
      processed(db, lot.id),
  );
}
/** Pre-smoke weight not yet through the smoker; never negative, even for lots whose old payload lacks the field. */
export function pendingSmokeKg(db: Database, lot: Lot) {
  return Math.max(0, n(lot.values, "preSmokeKg") - processed(db, lot.id));
}
export function processLoss(db: Database, lotId: string) {
  return Math.max(0, processed(db, lotId) - produced(db, lotId));
}
export function averageYield(db: Database) {
  const input = sum(entries(db, "smoke"), "inputKg");
  const output = entries(db, "smoke").reduce(
    (a, e) => a + smokeOutputKg(e.values),
    0,
  );
  return input > 0 ? (output / input) * 100 : 0;
}
/** Sales and influencer boxes both take finished product off the branch shelf.
 * Every branch stock number reads both, or the day will not tie out. */
export function offShelf(
  db: Database,
  lotId?: string,
  branch?: string,
  date?: string,
) {
  return [
    ...entries(db, "sale", lotId, branch, date),
    ...entries(db, "influencerBox", lotId, branch, date),
  ];
}
const usedKg = (items: Entry[]) => sum(items, "soldKg");
const wastedKg = (items: Entry[]) => sum(items, "wasteKg");
/** Branch meat of one lot, all dates. `ready` is thawed meat not yet used or wasted:
 * the chill the branch can still use, whatever day it was thawed. */
export function balance(db: Database, lotId: string, branch: string) {
  const received = sum(entries(db, "receive", lotId, branch), "kg"),
    thawed = sum(entries(db, "thaw", lotId, branch), "kg");
  const out = offShelf(db, lotId, branch);
  return {
    received,
    frozen: received - thawed,
    ready: thawed - usedKg(out) - wastedKg(out),
  };
}
/** One branch day of one lot. Thawed meat left at the end of a day stays in the chiller
 * and carries into the next day (`chillIn`); nothing forces it to zero at close.
 * chillIn + thawed = used + waste + chillOut. The end-of-day stock as of `date`:
 * `pending` still to receive, `received` so far, `frozen` (received − thawed),
 * and `usedTotal` so far (waste excluded). */
export function branchMeatDay(
  db: Database,
  lotId: string,
  branch: string,
  date: string,
) {
  const before = (items: Entry[]) => items.filter((e) => e.date < date);
  const thaws = entries(db, "thaw", lotId, branch);
  const out = offShelf(db, lotId, branch);
  const today = offShelf(db, lotId, branch, date);
  const chillIn =
    sum(before(thaws), "kg") - usedKg(before(out)) - wastedKg(before(out));
  const thawed = sum(entries(db, "thaw", lotId, branch, date), "kg");
  const used = usedKg(today),
    waste = wastedKg(today);
  const through = (items: Entry[]) => items.filter((e) => e.date <= date);
  const received = sum(through(entries(db, "receive", lotId, branch)), "kg");
  return {
    chillIn,
    thawed,
    used,
    waste,
    chillOut: chillIn + thawed - used - waste,
    pending: pendingReceiveKg(db, lotId, branch, date),
    received,
    frozen: received - sum(through(thaws), "kg"),
    usedTotal: usedKg(through(out)),
  };
}
/** Meat used per sealed pack outside 100–103 g: a warning for the form, never a
 * block — the branch types what it really used. "" when it is fine. */
export function packWeightWarning(v: Values) {
  const packs = num(v, "boxes"),
    kg = num(v, "soldKg");
  if (!packs) return kg > 0 ? "มีน้ำหนักเนื้อที่ใช้ แต่ยังไม่มีจำนวนซีล" : "";
  const grams = (kg / packs) * 1000;
  return grams < 99.99 || grams > 103.01
    ? `เฉลี่ย ${grams.toFixed(1)} กรัมต่อซีล อยู่นอกช่วง 100–103 กรัม · บันทึกได้ แต่ควรตรวจน้ำหนักอีกครั้ง`
    : "";
}
/** Kg a branch still has to receive on one allocation, rounded to the 0.01 the user
 * sees and types; the allocation is done once that reaches 0, or once a receive was
 * marked `complete` (a shortfall the branch accepted, its reason on that receive).
 * Receives on the batch with no `allocation` fill it too (DM-08, `unallocatedFill`). */
export function allocationOutstanding(
  db: Database,
  allocation: Entry,
  throughDate?: string,
) {
  const filled =
    unallocatedFill(
      db,
      allocation.lotId,
      allocation.branch,
      throughDate,
    ).filled.get(allocation.id) ?? 0;
  const kg =
    Math.round(
      (recordedOutstanding(db, allocation, throughDate) - filled) * 100,
    ) / 100;
  return Math.max(0, kg);
}
/** `allocationOutstanding` counting only receives recorded against the allocation. */
function recordedOutstanding(
  db: Database,
  allocation: Entry,
  throughDate?: string,
) {
  const received = entries(
    db,
    "receive",
    allocation.lotId,
    allocation.branch,
  ).filter(
    (r) =>
      r.values.allocation === allocation.id &&
      (!throughDate || r.date <= throughDate),
  );
  if (received.some((r) => r.values.complete === "1")) return 0;
  return Math.max(0, n(allocation.values, "kg") - sum(received, "kg"));
}
/** DM-08: a branch's receives on a batch with no `allocation` (typed as รับตรง, or a ไม่ระบุ Lot
 *  receive linked to the batch later) fill that branch's outstanding allocations on the batch,
 *  in log order, exactly as if recorded against them. Only the kg beyond every outstanding
 *  allocation is a straight receive (RET-04) and comes off central stock on its own.
 *  ponytail: no date order between receive and allocation, since a receive linked later may
 *  predate the allocation it fills. A branch that really took extra meat straight before an
 *  allocation should record the receive against that allocation or mark it complete. */
function unallocatedFill(
  db: Database,
  lotId: string,
  branch: string,
  throughDate?: string,
) {
  const upTo = (e: Entry) => !throughDate || e.date <= throughDate;
  let left = sum(
    entries(db, "receive", lotId, branch).filter(
      (r) => !r.values.allocation && upTo(r),
    ),
    "kg",
  );
  const filled = new Map<string, number>();
  for (const allocation of entries(db, "allocate", lotId, branch).filter(
    upTo,
  )) {
    const kg = Math.min(left, recordedOutstanding(db, allocation, throughDate));
    filled.set(allocation.id, kg);
    left -= kg;
  }
  return { filled, straight: left };
}
/** Kg allocated to a branch and not yet received; with `throughDate`, as of the end
 * of that day (allocations and receives dated after it do not count). */
export function pendingReceiveKg(
  db: Database,
  lotId: string,
  branch: string,
  throughDate?: string,
) {
  return entries(db, "allocate", lotId, branch)
    .filter((a) => !throughDate || a.date <= throughDate)
    .reduce(
      (total, allocation) =>
        total + allocationOutstanding(db, allocation, throughDate),
      0,
    );
}
/** The two ways a branch gets its sticky rice, picked on every `ricePurchase` (B2). */
export const riceSources = ["นึ่งเอง (ซื้อข้าวดิบ)", "ซื้อข้าวสุกจากข้างนอก"];
/** Rice records a branch owes for `date`, from what it did rather than which branch it is:
 *  every day ends with a cooked-rice confirmation (`riceCarry`); a day that issued raw rice
 *  for cooking also owes the cook itself (`rice`). closeDay and the Owner's daily status
 *  both read this. */
export function requiredRiceKinds(
  db: Database,
  branch: string,
  date: string,
): EntryKind[] {
  const issuedRaw = (["riceIssue", "supplyIssue"] as const).some((kind) =>
    entries(db, kind, undefined, branch, date).some(
      (entry) => num(entry.values, "rawRiceIssuedKg") > 0,
    ),
  );
  return issuedRaw ? ["rice", "riceCarry"] : ["riceCarry"];
}
/** What closing `date` needs, in the order the close dialog lists it. mutate's closeDay
 *  refuses on the first required item not done, with its `message`, so the dialog and
 *  the save never disagree. `kind` is the form that fills the item, when it has one
 *  (materials are counted in the day screen's own table). Influencer giveaways are no
 *  longer a line here: they are entered inside the sale form (saleWithInfluencers), so
 *  the `sale` line above already covers the moment they are recorded. The chill line is
 *  information only: thawed meat left over carries into tomorrow. */
export function closeDayChecklist(db: Database, branch: string, date: string) {
  const has = (kind: EntryKind) =>
    entries(db, kind, undefined, branch, date).length > 0;
  const chillOut = db.lots.reduce(
    (total, lot) => total + branchMeatDay(db, lot.id, branch, date).chillOut,
    0,
  );
  return [
    {
      key: "sale",
      label: "ยอดขายวันนี้",
      done: has("sale"),
      required: true,
      message: "ยังไม่มีรายการขายวันนี้",
      kind: "sale" as EntryKind | undefined,
    },
    {
      key: "materials",
      label: "เช็ควัสดุ",
      done: has("materials"),
      required: true,
      message: "ยังไม่เช็ควัสดุวันนี้",
      kind: undefined,
    },
    ...requiredRiceKinds(db, branch, date).map((kind) => ({
      key: kind,
      label: titles[kind],
      done: has(kind),
      required: true,
      message:
        kind === "rice"
          ? "เบิกข้าวเหนียวดิบวันนี้แล้ว ยังไม่บันทึกข้าวช่วงเช้า (หุงข้าว)"
          : "ยังไม่ยืนยันข้าวเหนียวสุกคงเหลือ",
      kind,
    })),
    {
      key: "chill",
      label: `เนื้อชิลยกไปวันถัดไป ${fmt(chillOut)} กก.`,
      done: true,
      required: false,
      message: "",
      kind: undefined,
    },
  ];
}
export type CloseDayItem = ReturnType<typeof closeDayChecklist>[number];
export function rawRiceStock(db: Database, branch: string) {
  return (
    sum(entries(db, "supplyPurchase", undefined, branch), "rawRiceKg") +
    sum(entries(db, "ricePurchase", undefined, branch), "rawRiceKg") -
    sum(entries(db, "supplyIssue", undefined, branch), "rawRiceIssuedKg") -
    sum(entries(db, "riceIssue", undefined, branch), "rawRiceIssuedKg")
  );
}
export function issuedRawRiceStock(db: Database, branch: string) {
  return (
    sum(entries(db, "supplyIssue", undefined, branch), "rawRiceIssuedKg") +
    sum(entries(db, "riceIssue", undefined, branch), "rawRiceIssuedKg") -
    sum(entries(db, "rice", undefined, branch), "rawUsedKg")
  );
}
/** Cooked rice is never carried over: whatever is left at the end of the day is waste. */
export const riceCarryWasteKg = (items: Entry[]) => sum(items, "leftoverKg");
/** Cooked sticky rice left at `branch` on `date`. Rice is cooked fresh every day, so only
 *  that day counts: bought cooked + cooked − served (sales and influencer boxes) − wasted. */
export function cookedRiceStock(
  db: Database,
  branch: string,
  date: string = today(),
) {
  return (
    sum(
      entries(db, "supplyPurchase", undefined, branch, date),
      "cookedRiceKg",
    ) +
    sum(entries(db, "ricePurchase", undefined, branch, date), "cookedRiceKg") +
    sum(entries(db, "rice", undefined, branch, date), "riceKg") -
    riceCarryWasteKg(entries(db, "riceCarry", undefined, branch, date)) -
    offShelf(db, undefined, branch, date).reduce(
      (total, entry) =>
        total +
        num(entry.values, "riceServings") * 0.2 +
        num(entry.values, "riceWasteKg"),
      0,
    )
  );
}
/** STK-43: chili tubes a branch wrote down as received. Sales reduce the branch balance. */
export function chiliReceived(
  db: Database,
  branch: string,
  throughDate?: string,
) {
  const inRange = (entry: Entry) => !throughDate || entry.date <= throughDate;
  return (
    sum(
      entries(db, "chiliReceive", undefined, branch).filter(inRange),
      "chiliTubes",
    ) +
    // Old branch chili purchases still count.
    sum(
      entries(db, "supplyPurchase", undefined, branch).filter(inRange),
      "chiliTubes",
    ) +
    sum(
      entries(db, "chiliPurchase", undefined, branch).filter(inRange),
      "chiliTubes",
    )
  );
}
/** STK-44: the Owner's store is what it bought less what branches wrote down as received, the
 *  way a straight `receive` comes off `centralStock`. Below zero when a branch got stock the
 *  Owner never recorded buying: shown as it is, never clamped. */
export function ownerChiliStock(db: Database) {
  const purchased = entries(db, "generalPurchase")
    .filter((entry) => entry.values.item === "น้ำพริกหลอด")
    .reduce((total, entry) => total + n(entry.values, "quantity"), 0);
  // Old branch chili purchases (chiliPurchase, supplyPurchase) went straight to the branch and
  // count in its chiliReceived only: they were never in the Owner's store.
  return purchased - sum(entries(db, "chiliReceive"), "chiliTubes");
}
export function chiliSold(db: Database, branch: string, throughDate?: string) {
  return sum(
    offShelf(db, undefined, branch).filter(
      (entry) => !throughDate || entry.date <= throughDate,
    ),
    "chiliSold",
  );
}
export function chiliStock(db: Database, branch: string, throughDate?: string) {
  return (
    chiliReceived(db, branch, throughDate) - chiliSold(db, branch, throughDate)
  );
}
/** MAT-01: what branches took in of one material: `materialConfirm` is the one way material
 *  reaches a branch. */
function materialReceived(
  db: Database,
  material: string,
  branch?: string,
  throughDate?: string,
) {
  return entries(db, "materialConfirm", undefined, branch)
    .filter(
      (entry) =>
        entry.values.material === material &&
        (!throughDate || entry.date <= throughDate),
    )
    .reduce((total, entry) => total + n(entry.values, "receivedQuantity"), 0);
}
/** STK-44: bought less received by every branch; may be below zero (see ownerChiliStock). */
export function ownerMaterialStock(db: Database, material: string) {
  const bought = entries(db, "materialReceive")
    .filter((entry) => entry.values.material === material)
    .reduce((total, entry) => total + n(entry.values, "quantity"), 0);
  return bought - materialReceived(db, material);
}
export function branchMaterialStock(
  db: Database,
  branch: string,
  materialIndex: number,
  throughDate?: string,
) {
  const received = materialReceived(
    db,
    materials[materialIndex],
    branch,
    throughDate,
  );
  /* A branch may save a day's count again to fix a typo, so only the newest record
   * of each day counts; the earlier ones stay in the log as the audit trail. */
  const counted = [
    ...new Map(
      entries(db, "materials", undefined, branch)
        .filter((entry) => !throughDate || entry.date < throughDate)
        .map((entry) => [entry.date, entry]),
    ).values(),
  ];
  const used = counted.reduce(
    (total, entry) => total + n(entry.values, "used" + materialIndex),
    0,
  );
  const adjustments = counted.reduce(
    (total, entry) =>
      total +
      n(entry.values, "material" + materialIndex) -
      (n(entry.values, "opening" + materialIndex) -
        n(entry.values, "used" + materialIndex)),
    0,
  );
  return received - used + adjustments;
}
export function materialPar(db: Database, branch: string, index: number) {
  return (
    n(db.config, `material${index}`) ||
    n(db.config, `material${index}_saladaeng`) ||
    n(db.config, `material${index}_minburi`)
  );
}
export function materialUnitPrice(db: Database, branch: string, index: number) {
  return (
    n(db.config, `materialPrice${index}`) ||
    n(db.config, `materialPrice${index}_saladaeng`) ||
    n(db.config, `materialPrice${index}_minburi`)
  );
}
export function isClosed(db: Database, branch: string, date: string) {
  /* Log order, not `at`: the log is append-only, while `at` is each device's own clock. */
  const position = (kind: EntryKind) => {
    const last = entries(db, kind, undefined, branch, date).at(-1);
    return last ? db.entries.findIndex((e) => e.id === last.id) : -1;
  };
  const closed = position("closeDay");
  return closed >= 0 && position("unlock") < closed;
}
/** DASH-03: meat (smoke PO lines × PO price, pro rata to Chef House's received kg), the
 *  smoking fee (D8: the batch's latest smoking invoice, else the smoke PO's estimate, else 0)
 *  and freight. `perKg` is 0 until the batch is in central stock, and leaves the meat out
 *  while `meatMatched` is false (RET-07). */
export function lotCost(db: Database, lot: Lot) {
  const v = lot.values;
  const shares = shipmentShares(db, lot);
  const meat = shares.reduce((total, share) => total + share.meat, 0);
  const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
  const order = entries(db, "smokeOrder", lot.id).at(-1);
  const smokingCostSource: "invoice" | "estimate" | "none" = invoice
    ? "invoice"
    : order
      ? "estimate"
      : "none";
  const smoke = invoice
    ? n(invoice.values, "netPayable")
    : n(order?.values || {}, "estimatedCost");
  const freight = num(v, "outboundCost") + num(v, "returnCost");
  const total = meat + smoke + freight;
  return {
    meat,
    /** RET-07: the smoke PO names no purchase PO yet (or only lines with no kg), so `meat`
     *  is 0 for want of a match. A PO picked without kg still traces, it just costs nothing. */
    meatMatched:
      shares.reduce((total, share) => total + share.requestedKg, 0) > 0,
    smoke,
    smokingCostSource,
    freight,
    total,
    perKg: num(v, "centralKg") > 0 ? total / num(v, "centralKg") : 0,
  };
}
/** BR-05: what a sale's (or giveaway's) meat cost at read time — `soldKg × lotCost.perKg` of its
 *  batch, 0 in the "ไม่ระบุ Lot" bucket. Nothing is stored on the sale. */
export function saleCost(db: Database, sale: Entry) {
  const lot = db.lots.find((l) => l.id === sale.lotId);
  const perKg = lot ? lotCost(db, lot).perKg : 0;
  return {
    meatCost: num(sale.values, "soldKg") * perKg,
    wasteCost: num(sale.values, "wasteKg") * perKg,
    unlinked: !sale.lotId,
  };
}
/** DASH-01: what is recorded but not tied to its source yet, for the Owner's dashboard. */
export function unlinkedSummary(db: Database) {
  const receives = entries(db, "receive", "");
  const meatKg: Record<string, number> = {};
  for (const branch of [...new Set(receives.map((e) => e.branch))]) {
    const { frozen, ready } = balance(db, "", branch);
    meatKg[branch] = frozen + ready;
  }
  return {
    /** Branch meat still on hand in the "ไม่ระบุ Lot" bucket (frozen + chill), kg per branch
     *  with an unlinked receive: selling from the bucket lowers it, linking moves it. */
    meatKg,
    /** Receives in that bucket still waiting to be linked to a batch. */
    meatReceives: receives.length,
    batchesWithoutSmokeOrder: shipments(db)
      .filter((lot) => !entries(db, "smokeOrder", lot.id).length)
      .map((lot) => lot.id),
    posWithoutInvoice: purchaseLots(db)
      .filter((lot) => !entries(db, "foodivaConfirm", lot.id).length)
      .map((lot) => lot.id),
  };
}
/** Purchase POs still open: beef left to send to Chef House, or the meat invoice unpaid. */
export function openPurchasePos(db: Database) {
  return purchaseLots(db).filter(
    (lot) =>
      poRemainingKg(db, lot.id) > 0.001 ||
      !entries(db, "meatPayment", lot.id).length,
  );
}
export function smokeServiceRate(quantityKg: number) {
  if (quantityKg >= 1500) return 180;
  if (quantityKg >= 1000) return 200;
  return 220;
}
/** The payment that settles this invoice: one naming it, or one made on its batch before any
 *  invoice existed (SVC-01, no `invoiceId`). A pre-paid batch has nothing left to pay, so
 *  every invoice on it reads "ชำระแล้ว" and skips review, the same as a paid invoice. */
export function smokingInvoicePayment(db: Database, invoice: Entry) {
  return entries(db, "invoicePayment", invoice.lotId).find(
    (entry) => !entry.values.invoiceId || entry.values.invoiceId === invoice.id,
  );
}
export function smokingInvoiceStatus(db: Database, invoice: Entry) {
  if (smokingInvoicePayment(db, invoice)) return "ชำระแล้ว";
  const review = entries(db, "invoiceReview", invoice.lotId)
    .filter((entry) => entry.values.invoiceId === invoice.id)
    .at(-1);
  if (review?.values.decision === "รับยอด") return "รอชำระ";
  if (review?.values.decision === "ส่งกลับแก้ไข") return "ส่งกลับแก้ไข";
  return "รอตรวจยอด";
}
/** The Owner's latest review of this invoice (either decision), if any. */
export function smokingInvoiceReview(db: Database, invoice: Entry) {
  return entries(db, "invoiceReview", invoice.lotId)
    .filter((entry) => entry.values.invoiceId === invoice.id)
    .at(-1);
}
/** The Owner's latest "ส่งกลับแก้ไข" review of this invoice, if that is its current state. */
export function smokingInvoiceRejection(db: Database, invoice: Entry) {
  if (smokingInvoiceStatus(db, invoice) !== "ส่งกลับแก้ไข") return undefined;
  return smokingInvoiceReview(db, invoice);
}
/** One smoking invoice per lot: the latest. Earlier ones were sent back and superseded by a resubmission. */
export function currentSmokingInvoices(db: Database) {
  const latest = new Map<string, Entry>();
  for (const invoice of entries(db, "smokingInvoice"))
    latest.set(invoice.lotId, invoice);
  return [...latest.values()];
}
/** Invoices the Owner has to act on: Foodiva meat invoices still unpaid, and current
 *  Chef House smoking invoices to review (`toReview`) or to pay (`toPay`). */
export function ownerPendingInvoices(db: Database) {
  const unpaidMeatLots = db.lots.filter(
    (lot) =>
      !lot.kind &&
      entries(db, "foodivaConfirm", lot.id).length &&
      !entries(db, "meatPayment", lot.id).length,
  );
  const smoking = currentSmokingInvoices(db);
  const toReview = smoking.filter(
    (invoice) => smokingInvoiceStatus(db, invoice) === "รอตรวจยอด",
  );
  const toPay = smoking.filter(
    (invoice) => smokingInvoiceStatus(db, invoice) === "รอชำระ",
  );
  return {
    unpaidMeatLots,
    toReview,
    toPay,
    total: unpaidMeatLots.length + toReview.length + toPay.length,
  };
}
export function revenue(db: Database) {
  return sum(entries(db, "sale"), "revenue");
}

/** Oldest first: by business date, then by when it was typed. */
export const byDateAt = (
  a: { date: string; at: string },
  b: { date: string; at: string },
) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at);
