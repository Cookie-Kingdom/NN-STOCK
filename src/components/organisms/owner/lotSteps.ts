import { today } from "@/lib/format";
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
  // Q1: no "Chef รับ PO" step; the Owner issues the smoke PO itself. It can still be recorded.
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

/** Where the Owner records each step, its own and the ones it types for Foodiva and
 *  Chef House. */
const ownerStepTab: Record<BatchStep, Tab> = {
  smokeOrder: "smoke-po",
  dispatch: "foodiva",
  packingList: "foodiva",
  cmReceive: "cm-receive",
  prepare: "work",
  smoke: "work",
  closeLot: "work",
  smokingInvoice: "work",
  invoicePayment: "invoices",
  return: "return-shipment",
  foodivaReturnReceive: "foodiva",
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

/** The tab of the first missing step, else the manifest. */
export function missingStepTab(missing: readonly BatchStep[]): Tab {
  return missing.length ? ownerStepTab[missing[0]] : "transport";
}

/** "PO รมควัน, ใบขนส่ง, … และอีก 3 ขั้น" */
export function missingText(missing: readonly BatchStep[], shown = 4) {
  const names = missing.slice(0, shown).map((step) => stepLabels[step]);
  const rest = missing.length - names.length;
  return `ยังขาด: ${names.join(", ")}${rest > 0 ? ` และอีก ${rest} ขั้น` : ""}`;
}

const DAY = 86400000;
/** Batches with an entry in the 30 days up to `asOf` (DASH-02): today in Bangkok. */
export function activeBatches(db: Database, asOf = today(), days = 30): Lot[] {
  const cutoff = new Date(Date.parse(`${asOf}T00:00:00Z`) - days * DAY)
    .toISOString()
    .slice(0, 10);
  const recent = new Set(
    db.entries.filter((e) => e.date >= cutoff).map((e) => e.lotId),
  );
  return shipments(db).filter((lot) => recent.has(lot.id));
}
