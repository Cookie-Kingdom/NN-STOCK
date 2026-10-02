import { today } from "@/lib/format";
import type { Tab } from "@/lib/nav";
import {
  entries,
  liveEntries,
  lotProgress,
  poMatched,
  shipments,
  titles,
  type Database,
  type EntryKind,
  type Lot,
} from "@/lib/store";

/** The records a smoke batch (Lot S) usually ends up with. A label list, not a sequence:
 *  every one can be recorded at any time (PRIN-02), so one not recorded is "ยังไม่ได้จด",
 *  never a closed button. */
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
  // RET-07: not an entry of its own; the smoke PO's `lines` naming a purchase PO.
  "matchPo",
] as const satisfies readonly (EntryKind | "matchPo")[];
export type BatchStep = (typeof batchSteps)[number];

/** A once-per-batch step already saved keeps its button: a second save is said, not
 *  refused, and the newest counts (GEN-06). The label says so. */
export const again = (label: string, done: boolean) =>
  done ? `${label} · บันทึกเพิ่ม/แก้` : label;

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
  matchPo: "จับคู่ PO ซื้อ",
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
  matchPo: "central-receive",
};

/** Steps of `steps` the batch has no entry for yet (DASH-02). "จับคู่ PO ซื้อ" is missing
 *  once there is something to match: a smoke PO without purchase PO lines, or a batch that
 *  reached central stock with no smoke PO at all (RET-07). */
export function missingSteps(
  db: Database,
  lotId: string,
  steps: readonly BatchStep[] = batchSteps,
): BatchStep[] {
  const done = lotProgress(db, lotId);
  return steps.filter((step) =>
    step === "matchPo"
      ? (done.has("smokeOrder") || done.has("central")) && !poMatched(db, lotId)
      : !done.has(step),
  );
}

/** A tab one of the missing records is written on (the first listed), else the manifest. */
export function missingStepTab(missing: readonly BatchStep[]): Tab {
  return missing.length ? ownerStepTab[missing[0]] : "transport";
}

/** "ยังไม่ได้จด: PO รมควัน, ใบขนส่ง, … และอีก 3 รายการ" */
export function missingText(missing: readonly BatchStep[], shown = 4) {
  const names = missing.slice(0, shown).map((step) => stepLabels[step]);
  const rest = missing.length - names.length;
  return `ยังไม่ได้จด: ${names.join(", ")}${rest > 0 ? ` และอีก ${rest} รายการ` : ""}`;
}

/** 「จดล่าสุด」: the kind of the newest note on the lot, whichever kind it is; there is no
 *  order of steps to be furthest along (PRIN-02). Newest is log order. A voided note does
 *  not count, and one linked onto the lot afterwards does. */
export function latestNote(db: Database, lotId: string): EntryKind | undefined {
  const live = new Set(
    [...lotProgress(db, lotId)].flatMap((kind) =>
      entries(db, kind, lotId).map((e) => e.id),
    ),
  );
  return db.entries.findLast((e) => live.has(e.id))?.kind;
}

/** `latestNote` as a table cell. */
export function latestNoteLabel(db: Database, lotId: string) {
  const kind = latestNote(db, lotId);
  return kind ? titles[kind] : "—";
}

const DAY = 86400000;
/** Batches with an entry in the 30 days up to `asOf` (DASH-02): today in Bangkok. An entry
 *  counts by its business date or by when it was recorded, so backdated work still alerts.
 *  The entries are the live ones: a correction or a delete is no entry of the batch, so one
 *  made today does not by itself make an old batch active. */
export function activeBatches(db: Database, asOf = today(), days = 30): Lot[] {
  const cutoff = new Date(Date.parse(`${asOf}T00:00:00Z`) - days * DAY)
    .toISOString()
    .slice(0, 10);
  // One pass over the log, not one per batch: the Owner's screens ask on every render.
  const recent = new Set(
    liveEntries(db)
      .filter((e) => e.date >= cutoff || (e.at || "").slice(0, 10) >= cutoff)
      .map((e) => e.lotId),
  );
  return shipments(db).filter((lot) => recent.has(lot.id));
}
