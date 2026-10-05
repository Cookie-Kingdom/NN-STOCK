/** The Accounting page's purchase ledger (V2-LED-01): every PO เนื้อ and PO รมควัน as a row
 *  worked out from the log, plus the `expense` notes jotted by hand. Nothing here is stored. */
import { materialList, type Database, type Entry, type Values } from "./model";
import {
  byDateAt,
  entries,
  invoiceOf,
  purchaseLots,
  shipments,
} from "./derived";

export const ledgerSources = {
  po: "ดึงจากระบบ PO",
  advance: "พนักงานสำรองจ่าย",
  transfer: "โอนจ่ายตรง",
  credit: "บัตรเครดิต",
} as const;
export type LedgerSource = keyof typeof ledgerSources;
export const ledgerPurposes = {
  company: "ซื้อเข้าบริษัทส่วนกลาง",
  project: "ใช้งานโปรเจกต์",
} as const;
export const ledgerStatuses = {
  pending: "รอจ่ายเงิน",
  paid: "จ่ายแล้ว",
  cancelled: "ยกเลิก",
} as const;
export type LedgerStatus = keyof typeof ledgerStatuses;
export const defaultLedgerTypes = [
  "วัสดุบรรจุภัณฑ์",
  "วัตถุดิบ",
  "สินทรัพย์",
  "อื่นๆ",
];
/** The project every PO belongs to: the sidebar section of the shop's pages (nav.ts). */
export const shopProject = "Nerdnuea x LINE MAN";

export type LedgerRow = {
  /** The PO's lot id, or the `expense` entry's id. */
  id: string;
  date: string;
  at: string;
  /** "" on a hand-jotted row with no source, or one no longer offered (the retired `petty`). */
  source: LedgerSource | "";
  /** A PO row: its lot (the link to the Lots page). */
  lotId?: string;
  /** A hand-jotted row: its entry (edit, delete, attachment). */
  entry?: Entry;
  reference: string;
  itemType: string;
  /** The name the item goes by now (`skuCatalogue`), not always the one typed. */
  item: string;
  sku: string;
  detail: string;
  vendor: string;
  purpose: keyof typeof ledgerPurposes;
  project: string;
  qty: number | null;
  unit: string;
  /** What the PO holds the budget for; null on a hand-jotted row. */
  poAmount: number | null;
  paid: number | null;
  status: LedgerStatus;
};

const numberOr = (v: Values, key: string) =>
  (v[key] ?? "") === "" ? null : Number(v[key]);
/** An item name as matched: trimmed, case-insensitive. */
const norm = (name = "") => name.trim().toLowerCase();

/* SKU (V2-LED-03): one sequence, `SKU-0001` up, for the materials of Settings and the items of
 * hand-jotted ledger rows. Nothing else has one (no meat, rice, chili or PO row). */
const skuNumber = (sku = "") => Number(/^SKU-(\d+)$/.exec(sku)?.[1] ?? 0);
const skuText = (n: number) => `SKU-${String(n).padStart(4, "0")}`;
/** The Owner's renames of ledger items (Settings 「รายการสินค้า (SKU)」): `[{ sku, name }]`. */
function skuNames(config: Values): Map<string, string> {
  try {
    const parsed: unknown = JSON.parse(config.skuNames || "[]");
    if (Array.isArray(parsed))
      return new Map(
        parsed.map((row) => [String(row?.sku), String(row?.name ?? "").trim()]),
      );
  } catch {}
  return new Map();
}
/** Every item with a SKU and the name it goes by: the materials (named in Settings), then the
 *  items of the live `expense` notes, oldest first, each under the Owner's rename if it has
 *  one, else the name first typed. A rename shows on every row of the SKU, old ones included. */
export function skuCatalogue(db: Database) {
  const items = new Map<
    string,
    { sku: string; name: string; material: boolean }
  >();
  for (const m of materialList(db.config))
    if (m.sku) items.set(m.sku, { sku: m.sku, name: m.name, material: true });
  const renamed = skuNames(db.config);
  for (const { values: v } of entries(db, "expense"))
    if (v.sku && !items.has(v.sku))
      items.set(v.sku, {
        sku: v.sku,
        name: renamed.get(v.sku) ?? (v.item ?? "").trim(),
        material: false,
      });
  return [...items.values()];
}
/** The name `sku` goes by now, else `typed` (a row with no SKU).
 *  ponytail: builds the catalogue per call; pass a Map around if a long ledger gets slow. */
export const skuName = (db: Database, sku: string | undefined, typed = "") =>
  (sku && skuCatalogue(db).find((item) => item.sku === sku)?.name) || typed;
/** The next SKU: one past the highest ever issued, in the materials (the lists of earlier
 *  saves included) and in every entry of the log, deleted and edited-away ones too, so a
 *  number is never given twice. The ones after it: `skuAfter`. */
export function nextSku(db: Database) {
  const issued = [
    ...materialList(db.config).map((m) => m.sku),
    ...db.entries.flatMap((e) => [
      e.values.sku,
      e.values["to.sku"],
      e.values["from.sku"],
      ...(e.kind === "config" && e.values.materialList
        ? materialList(e.values).map((m) => m.sku)
        : []),
    ]),
  ];
  return skuText(Math.max(0, ...issued.map(skuNumber)) + 1);
}
export const skuAfter = (sku: string) => skuText(skuNumber(sku) + 1);
/** The SKU an `expense` note of item `name` gets: the one it already had (`kept`, an edit that
 *  kept the name), the one of the item in the catalogue that goes by that name (a material
 *  included), or the next one (`isNew`). */
export function skuFor(db: Database, name: string, kept: Values = {}) {
  const key = norm(name);
  if (!key) return { sku: "", isNew: false };
  if (kept.sku && norm(kept.item) === key)
    return { sku: kept.sku, isNew: false };
  const same = skuCatalogue(db).find((item) => norm(item.name) === key);
  return same
    ? { sku: same.sku, isNew: false }
    : { sku: nextSku(db), isNew: true };
}
/** Why the catalogue of `db` cannot stand, or "": every item has a name, and no two share one. */
export function skuNameError(db: Database) {
  const items = skuCatalogue(db);
  const names = items.map((item) => norm(item.name));
  const twice = items.find((_, at) => names.indexOf(names[at]) !== at);
  return names.some((name) => !name)
    ? "รายการสินค้า (SKU): มีแถวที่ยังไม่ได้ใส่ชื่อ"
    : twice
      ? `รายการสินค้า (SKU): ชื่อ「${twice.name}」ซ้ำกัน`
      : "";
}
/** `first`, then every value typed under `key` on an `expense` note, once each. */
export const ledgerChoices = (
  db: Database,
  key: string,
  first: string[] = [],
) => [
  ...new Set([
    ...first,
    ...entries(db, "expense")
      .map((e) => e.values[key]?.trim())
      .filter(Boolean),
  ]),
];

/** A hand-jotted row's status: the one picked, else paid once an amount is typed. */
const expenseStatus = (v: Values): LedgerStatus =>
  v.status in ledgerStatuses
    ? (v.status as LedgerStatus)
    : v.amount
      ? "paid"
      : "pending";

/** Every row of the ledger, newest first. */
export function ledgerRows(db: Database): LedgerRow[] {
  const rows: LedgerRow[] = [];
  const po = (
    lotId: string,
    e: Entry,
    reference: string,
    item: string,
    detail: string,
    vendor: string,
    qty: number | null,
    amount: number | null,
  ): LedgerRow => ({
    id: lotId,
    date: e.date,
    at: e.at,
    source: "po",
    lotId,
    reference,
    itemType: "วัตถุดิบ",
    item,
    sku: "",
    detail,
    vendor,
    purpose: "project",
    project: shopProject,
    qty,
    unit: "กก.",
    poAmount: amount,
    paid: 0,
    status: "pending",
  });
  // A deleted PO is gone from the ledger with it (liveLots).
  for (const lot of purchaseLots(db)) {
    const e = entries(db, "purchase", lot.id).at(-1);
    if (!e) continue;
    const v = e.values;
    const invoice = invoiceOf(db, lot.id)?.values;
    // The Foodiva invoice once there is one (what supplierBalances bills), else kg × price.
    const amount = invoice?.netPayable
      ? Number(invoice.netPayable)
      : v.orderedKg && v.price
        ? Number(v.orderedKg) * Number(v.price)
        : null;
    rows.push(
      po(
        lot.id,
        e,
        lot.poId,
        v.productName || "เนื้อ",
        [v.packSize, v.productCode].filter(Boolean).join(" · "),
        v.supplier,
        numberOr(v, "orderedKg"),
        amount,
      ),
    );
  }
  for (const lot of shipments(db)) {
    const e = entries(db, "smokeOrder", lot.id).at(-1);
    if (!e) continue;
    const v = e.values;
    const invoice = invoiceOf(db, lot.id)?.values;
    // The Chef House invoice once there is one, else the estimate (kg × rate).
    const amount = invoice?.netPayable
      ? Number(invoice.netPayable)
      : v.estimatedCost
        ? Number(v.estimatedCost)
        : null;
    rows.push(
      po(
        lot.id,
        e,
        lot.poId,
        "ค่ารมควัน",
        invoice?.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : "",
        v.smoker || "Chef House",
        numberOr(v, "rawKg"),
        amount,
      ),
    );
  }
  /* ponytail: a `pay` note names a supplier, not a PO. A supplier's payments are spread over
   * its POs oldest first, each PO filled up to its amount before the next; what is left over
   * (a bill with no PO) is on no row. */
  const paidBy = new Map<string, number>();
  for (const e of entries(db, "pay"))
    if (e.values.supplier)
      paidBy.set(
        e.values.supplier,
        (paidBy.get(e.values.supplier) ?? 0) + Number(e.values.amount || 0),
      );
  for (const row of rows.toSorted(byDateAt)) {
    const left = paidBy.get(row.vendor) ?? 0;
    const paid = Math.min(left, row.poAmount ?? 0);
    paidBy.set(row.vendor, left - paid);
    row.paid = paid;
    row.status = row.poAmount && paid >= row.poAmount ? "paid" : "pending";
  }
  const names = new Map(skuCatalogue(db).map((item) => [item.sku, item.name]));
  for (const e of entries(db, "expense")) {
    const v = e.values;
    rows.push({
      id: e.id,
      date: e.date,
      at: e.at,
      source: v.source in ledgerSources ? (v.source as LedgerSource) : "",
      entry: e,
      reference: v.reference ?? "",
      itemType: v.itemType ?? "",
      item: names.get(v.sku) ?? v.item ?? "",
      sku: v.sku ?? "",
      detail: v.detail ?? "",
      vendor: v.vendor ?? "",
      purpose: v.purpose === "project" ? "project" : "company",
      project: v.purpose === "project" ? (v.project ?? "") : "",
      qty: numberOr(v, "qty"),
      unit: "",
      poAmount: null,
      paid: numberOr(v, "amount"),
      status: expenseStatus(v),
    });
  }
  return rows.sort(byDateAt).reverse();
}

export type ProjectAsset = {
  /** The SKU, else the name as matched. */
  key: string;
  sku: string;
  item: string;
  /** Of the latest purchase. */
  detail: string;
  vendor: string;
  lastDate: string;
  /** Every purchase's quantity; null when none has one. */
  qty: number | null;
  /** What was paid for it so far. */
  paid: number;
  times: number;
};

/** What `project` owns (Inventory): the hand-jotted rows of the ledger bought for it, a row
 *  per item (its SKU), in a group per ประเภทสินค้า, the suggested types first. A cancelled
 *  row is left out; the PO rows are the meat, which is on the Stock page.
 *  ponytail: what was bought, not what is left: nothing takes an item out again (used up,
 *  sold, broken). Needs a note of its own when the shop wants a balance. */
export function projectAssets(db: Database, project = shopProject) {
  const groups = new Map<string, Map<string, ProjectAsset>>(
    defaultLedgerTypes.map((type) => [type, new Map()]),
  );
  // Newest first: the first row of an item is its latest purchase.
  for (const row of ledgerRows(db)) {
    if (!row.entry || row.status === "cancelled") continue;
    if (row.purpose !== "project" || row.project.trim() !== project) continue;
    const type = row.itemType.trim();
    const items = groups.get(type) ?? new Map<string, ProjectAsset>();
    groups.set(type, items);
    const key = row.sku || norm(row.item);
    const asset = items.get(key) ?? {
      key,
      sku: row.sku,
      item: row.item,
      detail: row.detail,
      vendor: row.vendor,
      lastDate: row.date,
      qty: null,
      paid: 0,
      times: 0,
    };
    items.set(key, asset);
    if (row.qty !== null) asset.qty = (asset.qty ?? 0) + row.qty;
    asset.paid += row.paid ?? 0;
    asset.times += 1;
  }
  return [...groups]
    .filter(([, items]) => items.size)
    .map(([type, items]) => ({ type, rows: [...items.values()] }));
}

/** The Accounting page's two figures, from the rows: what the POs still waiting for payment
 *  hold the budget for, and what was paid in `month` (`YYYY-MM`) and in the month before it.
 *  A cancelled row holds no money. */
export function ledgerSummary(rows: LedgerRow[], month: string) {
  const waiting = rows.filter(
    (row) => row.source === "po" && row.status === "pending",
  );
  const before = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5) - 2, 1))
    .toISOString()
    .slice(0, 7);
  /* ponytail: a row's money counts in the month of the row (a PO's date, an expense's date),
   * not of each `pay` note: ledgerRows spreads a supplier's payments over its POs without
   * their dates. Carry the pay dates on the row if the month has to be exact. */
  const paidIn = (m: string) =>
    rows
      .filter((row) => row.status !== "cancelled" && row.date.startsWith(m))
      .reduce((a, row) => a + (row.paid ?? 0), 0);
  return {
    reserved: waiting.reduce((a, row) => a + (row.poAmount ?? 0), 0),
    waiting: waiting.length,
    paid: paidIn(month),
    paidBefore: paidIn(before),
  };
}
