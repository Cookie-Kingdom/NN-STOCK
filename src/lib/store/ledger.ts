/** The Accounting page's purchase ledger (V2-LED-01): every PO เนื้อ and PO รมควัน as a row
 *  worked out from the log, plus the `expense` notes jotted by hand. Nothing here is stored. */
import { type Database, type Entry, type Values } from "./model";
import {
  byDateAt,
  entries,
  invoiceOf,
  purchaseLots,
  shipments,
} from "./derived";

export const ledgerSources = {
  po: "ดึงจากระบบ PO",
  petty: "เงินสดย่อย",
  advance: "พนักงานสำรองจ่าย",
  transfer: "โอนจ่ายตรง",
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
  source: LedgerSource;
  /** A PO row: its lot (the link to the Lots page). */
  lotId?: string;
  /** A hand-jotted row: its entry (edit, delete, attachment). */
  entry?: Entry;
  reference: string;
  itemType: string;
  item: string;
  itemNo: string;
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

/** Every item already in the ledger (hand-jotted rows), one per Item No., oldest first. */
export function ledgerItems(db: Database) {
  const seen = new Map<string, string>();
  for (const e of entries(db, "expense"))
    if (e.values.itemNo && !seen.has(e.values.itemNo))
      seen.set(e.values.itemNo, e.values.item);
  return [...seen].map(([itemNo, name]) => ({ itemNo, name }));
}
/** The next Item No.: one past the highest ever issued, deleted entries and edits included,
 *  so a number is never given twice. */
function nextItemNo(db: Database) {
  let max = 0;
  for (const e of db.entries)
    for (const value of [e.values.itemNo, e.values["to.itemNo"]]) {
      const match = /^ITM-(\d+)$/.exec(value ?? "");
      if (match) max = Math.max(max, Number(match[1]));
    }
  return `ITM-${String(max + 1).padStart(4, "0")}`;
}
/** The Item No. an `expense` note of item `name` gets: the one it already had (`kept`, an edit
 *  that kept the name), the one of the same item in the ledger, or the next one (`isNew`). */
export function itemNoFor(db: Database, name: string, kept: Values = {}) {
  const key = norm(name);
  if (!key) return { no: "", isNew: false };
  if (kept.itemNo && norm(kept.item) === key)
    return { no: kept.itemNo, isNew: false };
  const same = ledgerItems(db).find((item) => norm(item.name) === key);
  return same
    ? { no: same.itemNo, isNew: false }
    : { no: nextItemNo(db), isNew: true };
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
    itemNo: "",
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
  for (const e of entries(db, "expense")) {
    const v = e.values;
    rows.push({
      id: e.id,
      date: e.date,
      at: e.at,
      source: v.source in ledgerSources ? (v.source as LedgerSource) : "petty",
      entry: e,
      reference: v.reference ?? "",
      itemType: v.itemType ?? "",
      item: v.item ?? "",
      itemNo: v.itemNo ?? "",
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
