import type { Tab } from "@/lib/nav";
import {
  lotProgress,
  shipments,
  type Database,
  type EntryKind,
  type Lot,
} from "@/lib/store";

/** The steps a smoke batch (Lot S) usually goes through, in the usual order. Only a
 *  checklist: every one can be recorded at any time (PRIN-02), so a step not done is
 *  "ยังขาด", never a closed button. */
export const batchSteps = [
  "smokeOrder",
  "dispatch",
  "packingList",
  "smokeOrderAccept",
  "cmReceive",
  "prepare",
  "smoke",
  "closeLot",
  "smokingInvoice",
  "invoicePayment",
  "return",
  "foodivaReturnReceive",
  "central",
] as const satisfies readonly EntryKind[];
export type BatchStep = (typeof batchSteps)[number];

/** Chip-sized names; the dialog titles are too long to line up in a table cell. */
export const stepLabels: Record<BatchStep, string> = {
  smokeOrder: "PO รมควัน",
  dispatch: "ใบขนส่ง",
  packingList: "Packing List",
  smokeOrderAccept: "Chef รับ PO",
  cmReceive: "ชั่งรับ",
  prepare: "ก่อนสโมค",
  smoke: "สโมค",
  closeLot: "ปิด Lot",
  smokingInvoice: "Invoice ค่ารม",
  invoicePayment: "ชำระค่ารม",
  return: "รถขากลับ",
  foodivaReturnReceive: "Foodiva รับเข้าตู้",
  central: "สต๊อกกลาง",
};

/** Where the Owner records each of its own steps. */
const ownerStepTab: Partial<Record<BatchStep, Tab>> = {
  smokeOrder: "smoke-po",
  invoicePayment: "invoices",
  return: "return-shipment",
  central: "central-receive",
};

/** Steps of `steps` the batch has no entry for yet (DASH-02). */
export function missingSteps(
  db: Database,
  lotId: string,
  steps: readonly BatchStep[] = batchSteps,
): BatchStep[] {
  const done = lotProgress(db, lotId);
  return steps.filter((step) => !done.has(step));
}

/** The tab of the first missing step the Owner itself records, else the manifest. */
export function missingStepTab(missing: readonly BatchStep[]): Tab {
  for (const step of missing) {
    const tab = ownerStepTab[step];
    if (tab) return tab;
  }
  return "transport";
}

/** "PO รมควัน, ใบขนส่ง, … และอีก 3 ขั้น" */
export function missingText(missing: readonly BatchStep[], shown = 4) {
  const names = missing.slice(0, shown).map((step) => stepLabels[step]);
  const rest = missing.length - names.length;
  return `ยังขาด: ${names.join(", ")}${rest > 0 ? ` และอีก ${rest} ขั้น` : ""}`;
}

const DAY = 86400000;
/** Batches with an entry in the 30 days before the newest entry in the database
 *  (DASH-02). Measured from the data, not the clock, so an old test round stays readable. */
export function activeBatches(db: Database, days = 30): Lot[] {
  const newest = db.entries.reduce(
    (max, e) => (e.date > max ? e.date : max),
    "",
  );
  if (!newest) return [];
  const cutoff = new Date(Date.parse(`${newest}T00:00:00Z`) - days * DAY)
    .toISOString()
    .slice(0, 10);
  const recent = new Set(
    db.entries.filter((e) => e.date >= cutoff).map((e) => e.lotId),
  );
  return shipments(db).filter((lot) => recent.has(lot.id));
}
