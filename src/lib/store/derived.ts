/** Figures recomputed from the entry log (stock, cost, yield, invoices); nothing here is stored. */
import { fmt } from "../format";
import {
  STAGE,
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
  const voided = new Set(
    db.entries
      // Only the Owner voids; a void appended under another role changes nothing.
      .filter((entry) => entry.kind === "void" && entry.role === "owner")
      .map((entry) => entry.values.targetId),
  );
  // chefEdit is append-only: its corrections overlay the receive/prepare/smoke entries it names.
  const fixes = new Map<string, Values>();
  const fix = (id: string | undefined, values: Values) => {
    if (id) fixes.set(id, { ...fixes.get(id), ...values });
  };
  for (const e of db.entries) {
    if (voided.has(e.id)) continue;
    // B5 edits overlay the same way, in log order: a later edit wins.
    if (isEditOverlay(e)) fix(e.values.targetId, unpack("to.", e.values));
    if (e.kind !== "chefEdit") continue;
    fix(e.values.receiveId, {
      receivedKg: e.values.receivedKg,
      arrival: e.values.arrival,
      ...(e.values.receivedBoxes !== undefined && {
        receivedBoxes: e.values.receivedBoxes,
      }),
    });
    fix(e.values.prepareId, { preSmokeKg: e.values.preSmokeKg });
    for (const { id, ...batch } of JSON.parse(
      e.values.batches || "[]",
    ) as Values[])
      fix(id, batch);
  }
  const byKind = new Map<EntryKind, Entry[]>();
  for (const e of db.entries) {
    if (voided.has(e.id)) continue;
    const list = byKind.get(e.kind);
    if (list) list.push(e);
    else byKind.set(e.kind, [e]);
  }
  const index = { length: db.entries.length, voided, fixes, byKind };
  entryIndexes.set(db.entries, index);
  return index;
}
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
        (!lotId || e.lotId === lotId) &&
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
export function centralStock(db: Database, lotId: string) {
  const lot = db.lots.find((l) => l.id === lotId);
  return (
    num(lot?.values || {}, "centralKg") -
    sum(entries(db, "allocate", lotId), "kg")
  );
}
/** Raw beef is held by Foodiva until it is dispatched to the smoker or picked up by the Owner. */
export function rawAtFoodiva(db: Database, lot: Lot) {
  // A shipment's beef is counted on the purchase POs it draws from.
  if (lot.kind) return 0;
  const confirmation = entries(db, "foodivaConfirm", lot.id).at(-1);
  const invoicedKg = confirmation
    ? n(confirmation.values, "confirmedKg")
    : n(lot.values, "orderedKg");
  const smoker = drawnKg(db, lot.id, true);
  // Legacy: early builds could record "steakTransfer" (raw beef moved to Steak). No UI creates
  // it any more, but app_state history is append-only, so old transfers still leave Foodiva.
  const steak = sum(entries(db, "steakTransfer", lot.id), "quantityKg");
  const ownerReceived = ownerWasteReceived(db, lot.id);
  return Math.max(0, invoicedKg - smoker - steak - ownerReceived);
}
export function readyForChefHouse(db: Database, lotId: string) {
  const confirmation = entries(db, "foodivaConfirm", lotId).at(-1);
  if (!confirmation) return 0;
  return confirmation.values.readyForChiangMaiKg !== undefined
    ? n(confirmation.values, "readyForChiangMaiKg")
    : n(confirmation.values, "confirmedKg");
}
export const purchaseLots = (db: Database) =>
  db.lots.filter((lot) => !lot.kind);
export function shipmentLines(lot: Lot): ShipmentLine[] {
  return (JSON.parse(lot.values.lines || "[]") as Values[]).map((line) => ({
    lotId: line.lotId,
    kg: Number(line.kg),
  }));
}
/** Shipment lots whose Request was not voided. Reads only the log's voids, so it also works on visibleDatabase. */
export function shipments(db: Database) {
  const voided = new Set(
    entries(db, "void")
      .filter((e) => e.role === "owner")
      .map((e) => e.values.targetId),
  );
  const cancelled = new Set(
    db.entries
      .filter((e) => e.kind === "shipmentRequest" && voided.has(e.id))
      .map((e) => e.lotId),
  );
  return db.lots.filter(
    (lot) => lot.kind === "shipment" && !cancelled.has(lot.id),
  );
}
/** Kg of one purchase PO that shipments have requested (only those already trucked with `dispatchedOnly`). */
export function drawnKg(
  db: Database,
  purchaseLotId: string,
  dispatchedOnly = false,
) {
  return shipments(db)
    .filter((lot) => !dispatchedOnly || lot.stage >= STAGE.cmReceive)
    .flatMap(shipmentLines)
    .filter((line) => line.lotId === purchaseLotId)
    .reduce((total, line) => total + line.kg, 0);
}
/** What a purchase PO can still send to Chef House: Foodiva's ready-for-Chiang-Mai kg less every Request. */
export function poRemainingKg(db: Database, purchaseLotId: string) {
  return readyForChefHouse(db, purchaseLotId) - drawnKg(db, purchaseLotId);
}
export function latestPackingList(db: Database, lotId: string) {
  return entries(db, "packingList", lotId).at(-1);
}
/** What actually went to Chef House: the box total of the shipment's latest Packing List.
 *  `undefined` until Foodiva makes one; the Request kg is only what was asked for. */
export function packingListKg(db: Database, lotId: string) {
  const list = latestPackingList(db, lotId);
  return list ? n(list.values, "slicedNetKg") : undefined;
}
/** A shipment's kg and meat cost split back to its purchase POs, pro rata to what each was asked
 * for: on Chef House's received kg once weighed in, on the requested kg before that. */
export function shipmentShares(db: Database, shipment: Lot) {
  const lines = shipmentLines(shipment);
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
/** One shipment end to end for the Owner: purchase POs → truck → Chef House's yellow total →
 *  smoked boxes → return truck → Foodiva's freezer. A step not reached yet is `undefined`. */
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
  const packs = num(v, "boxes") + num(v, "addons"),
    kg = num(v, "soldKg");
  if (!packs) return kg > 0 ? "มีน้ำหนักเนื้อที่ใช้ แต่ยังไม่มีจำนวนซีล" : "";
  const grams = (kg / packs) * 1000;
  return grams < 99.99 || grams > 103.01
    ? `เฉลี่ย ${grams.toFixed(1)} กรัมต่อซีล อยู่นอกช่วง 100–103 กรัม · บันทึกได้ แต่ควรตรวจน้ำหนักอีกครั้ง`
    : "";
}
/** Kg a branch still has to receive on one allocation, rounded to the 0.01 the user
 * sees and types; the allocation is done once that reaches 0, or once a receive was
 * marked `complete` (a shortfall the branch accepted, its reason on that receive). */
export function allocationOutstanding(
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
  const kg =
    Math.round((n(allocation.values, "kg") - sum(received, "kg")) * 100) / 100;
  return Math.max(0, kg);
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
/** Minburi never cooks rice: it only buys cooked rice. Only Saladaeng may self-cook. */
export const cooksRice = (branch: string) => branch !== "มีนบุรี";
export const noCookMessage =
  "สาขามีนบุรีไม่หุงข้าวเหนียว ซื้อข้าวสุกอย่างเดียว";
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
/** Leftover cooked rice marked ไม่นำกลับมาใช้ is thrown out: rice waste. Read from
 *  `reheat`, not a stamped key, so entries saved before this rule count too. */
export const riceCarryWasteKg = (items: Entry[]) =>
  sum(
    items.filter((entry) => entry.values.reheat === "ไม่นำกลับมาใช้"),
    "leftoverKg",
  );
export function cookedRiceStock(db: Database, branch: string) {
  return (
    sum(entries(db, "supplyPurchase", undefined, branch), "cookedRiceKg") +
    sum(entries(db, "ricePurchase", undefined, branch), "cookedRiceKg") +
    sum(entries(db, "rice", undefined, branch), "riceKg") -
    riceCarryWasteKg(entries(db, "riceCarry", undefined, branch)) -
    offShelf(db, undefined, branch).reduce(
      (total, entry) =>
        total +
        num(entry.values, "riceServings") * 0.2 +
        num(entry.values, "riceWasteKg"),
      0,
    )
  );
}
/** Chili tubes are issued to branches only by Owner. Sales reduce the branch balance. */
export function chiliAllocated(
  db: Database,
  branch: string,
  throughDate?: string,
) {
  const inRange = (entry: Entry) => !throughDate || entry.date <= throughDate;
  return (
    sum(
      entries(db, "chiliAllocate", undefined, branch).filter(inRange),
      "chiliTubes",
    ) +
    // Keep old demo records readable after the workflow changed to Owner allocation.
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
/** Owner stock is purchased centrally, then reduced only by allocations to branches. */
export function ownerChiliStock(db: Database) {
  const purchased = entries(db, "generalPurchase")
    .filter((entry) => entry.values.item === "น้ำพริกหลอด")
    .reduce((total, entry) => total + n(entry.values, "quantity"), 0);
  const legacyBranchPurchases =
    sum(entries(db, "supplyPurchase"), "chiliTubes") +
    sum(entries(db, "chiliPurchase"), "chiliTubes");
  return (
    purchased +
    legacyBranchPurchases -
    sum(entries(db, "chiliAllocate"), "chiliTubes")
  );
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
    chiliAllocated(db, branch, throughDate) - chiliSold(db, branch, throughDate)
  );
}
/** Kept for old components; it now means the current branch balance, not a branch issue. */
export function issuedChiliStock(db: Database, branch: string) {
  return chiliStock(db, branch);
}
export function materialSent(
  db: Database,
  material: string,
  branch?: string,
  date?: string,
) {
  return entries(db, "materialTransfer", undefined, branch, date)
    .filter((entry) => entry.values.material === material)
    .reduce((total, entry) => total + n(entry.values, "quantity"), 0);
}
export function ownerMaterialStock(db: Database, material: string) {
  const received = entries(db, "materialReceive")
    .filter((entry) => entry.values.material === material)
    .reduce((total, entry) => total + n(entry.values, "quantity"), 0);
  return received - materialSent(db, material);
}
export function branchMaterialStock(
  db: Database,
  branch: string,
  materialIndex: number,
  throughDate?: string,
) {
  const material = materials[materialIndex];
  const confirmations = new Map<string, Entry>();
  for (const item of entries(db, "materialConfirm", undefined, branch))
    if (!confirmations.has(item.values.transferId))
      confirmations.set(item.values.transferId, item);
  const transferred = entries(db, "materialTransfer", undefined, branch)
    .filter(
      (entry) =>
        entry.values.material === material &&
        (!throughDate || entry.date <= throughDate),
    )
    .reduce((total, entry) => {
      if (!entry.values.requiresConfirm)
        return total + n(entry.values, "quantity");
      const confirmation = confirmations.get(entry.id);
      return (
        total + (confirmation ? n(confirmation.values, "receivedQuantity") : 0)
      );
    }, 0);
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
  return transferred - used + adjustments;
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
export function lotCost(db: Database, lot: Lot) {
  const v = lot.values;
  const meat = shipmentShares(db, lot).reduce(
    (total, share) => total + share.meat,
    0,
  );
  const smoke = n(
    entries(db, "smokeOrder", lot.id).at(-1)?.values || {},
    "estimatedCost",
  );
  const freight = num(v, "outboundCost") + num(v, "returnCost");
  return {
    meat,
    smoke,
    freight,
    total: meat + smoke + freight,
    perKg:
      num(v, "centralKg") > 0
        ? (meat + smoke + freight) / num(v, "centralKg")
        : null,
  };
}
export function smokeServiceRate(quantityKg: number) {
  if (quantityKg >= 1500) return 180;
  if (quantityKg >= 1000) return 200;
  return 220;
}
export function smokingInvoiceStatus(db: Database, invoice: Entry) {
  if (
    entries(db, "invoicePayment", invoice.lotId).some(
      (entry) => entry.values.invoiceId === invoice.id,
    )
  )
    return "ชำระแล้ว";
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
