import { fmt } from "@/lib/format";
import {
  latestPackingList,
  n,
  packingListKg,
  readyForChefHouse,
  shipmentLines,
  smokingInvoiceStatus,
  type Database,
  type Entry,
  type Lot,
} from "@/lib/store";

export type DocumentRows = [string, string][];

export type TransportDirection = "outbound" | "return";

const transportKeys: Record<TransportDirection, { date: string; kg: string }> =
  {
    outbound: { date: "pickupDate", kg: "dispatchKg" },
    return: { date: "returnDate", kg: "returnKg" },
  };

export const transportDocumentTitle: Record<TransportDirection, string> = {
  outbound: "ใบขนส่งเนื้อขาไป",
  return: "ใบขนส่งเนื้อขากลับ",
};

/** "PO-2026-0001 × 300.00 กก." for each purchase PO a shipment draws from (Owner and Foodiva only). */
export const shipmentPoLabels = (db: Database, lot: Lot) =>
  shipmentLines(lot).map(
    (line) =>
      `${db.lots.find((po) => po.id === line.lotId)?.poId || line.lotId} × ${fmt(line.kg)} กก.`,
  );

/** Print rows for a `dispatch` (outbound) or `return` transport entry of a shipment.
 *  Lists the purchase POs it carries, so only the Owner and Foodiva may see it. */
export function transportDocumentRows(
  db: Database,
  lot: Lot,
  trip: Entry,
  direction: TransportDirection,
): DocumentRows {
  const keys = transportKeys[direction];
  // The outbound truck carries the Packing List's boxes; the Request kg only until there is one.
  const kg =
    (direction === "outbound" ? packingListKg(db, lot.id) : undefined) ??
    n(trip.values, keys.kg);
  return [
    ["วันที่รถรับ", trip.values[keys.date] || trip.date],
    ["เลขที่การส่ง", lot.poId],
    ["PO ซื้อ", shipmentPoLabels(db, lot).join(", ") || "—"],
    ["ต้นทาง", trip.values.origin],
    ["ปลายทาง", trip.values.destination],
    ["น้ำหนักส่ง", `${fmt(kg)} กก.`],
    ["ประเภทรถ", trip.values.vehicleType || "—"],
    ["ทะเบียนรถ", trip.values.plate || "—"],
    ["คนขับ", trip.values.driverName || "—"],
    ["เบอร์ติดต่อ", trip.values.driverPhone || "—"],
  ];
}

/** Foodiva meat invoice (`foodivaConfirm` entry). */
export function foodivaInvoiceRows(
  db: Database,
  lot: Lot,
  invoice: Entry,
): DocumentRows {
  return [
    ["วันที่ Invoice", invoice.values.invoiceDate],
    ["PO", lot.poId],
    ["Lot เนื้อ", lot.id],
    ["น้ำหนักยืนยัน", `${fmt(n(invoice.values, "confirmedKg"))} กก.`],
    ["พร้อมส่งเชียงใหม่", `${fmt(readyForChefHouse(db, lot.id))} กก.`],
    ["ยอด Invoice", `฿${fmt(n(invoice.values, "invoiceAmount"))}`],
    ["ผู้ยืนยัน", invoice.values.confirmedBy || "—"],
  ];
}

/** Chef House smoking invoice (`smokingInvoice` entry). */
export function smokingInvoiceRows(
  db: Database,
  lot: Lot,
  invoice: Entry,
  order: Entry | undefined,
): DocumentRows {
  return [
    ["วันที่ Invoice", invoice.values.invoiceDate],
    ["PO โรงรมควัน", order?.values.orderNumber || "—"],
    ["Lot เนื้อ", lot.id],
    ["ผู้ให้บริการ", invoice.values.serviceProvider || "Chef House"],
    ["น้ำหนักคิดค่าบริการ", `${fmt(n(invoice.values, "serviceQuantity"))} กก.`],
    ["ยอดสุทธิ", `฿${fmt(n(invoice.values, "netPayable"))}`],
    ["สถานะ", smokingInvoiceStatus(db, invoice)],
  ];
}

/** Foodiva's Packing List of a shipment: what the smoke PO is ordered from. */
export function packingListRows(lot: Lot, list: Entry): DocumentRows {
  return [
    ["เลขที่การส่ง", lot.poId],
    ["สินค้า", list.values.product || "—"],
    ["กล่องรับเข้า", `${list.values.boxCount || "0"} กล่องรับเข้า`],
    // Not the box total any more: Foodiva types it, so the row says which figure it is.
    ["Sliced Weight Net", `${fmt(n(list.values, "slicedNetKg"))} กก.`],
    [
      "Inv. Weight",
      list.values.invWeightKg
        ? `${fmt(n(list.values, "invWeightKg"))} กก.`
        : "—",
    ],
    [
      "Sliced Weight Lost",
      list.values.slicedLostKg
        ? `${fmt(n(list.values, "slicedLostKg"))} กก.`
        : "—",
    ],
  ];
}

/** "N กล่องรับเข้า · X กก." of the shipment's latest Packing List, "" before there is one. */
export function packingListSummary(db: Database, lotId: string) {
  const list = latestPackingList(db, lotId);
  return list
    ? `${list.values.boxCount} กล่องรับเข้า · ${fmt(n(list.values, "slicedNetKg"))} กก.`
    : "";
}

/**
 * Smoke-service PO as printed from the smoking PO tab: customer block comes from
 * the current company config. Chef House reads it too, so it names the shipment and
 * its Packing List, never a purchase PO, meat price or Foodiva invoice.
 */
export function smokeOrderPrintRows(
  db: Database,
  lot: Lot,
  order: Entry,
): DocumentRows {
  const list = latestPackingList(db, lot.id);
  return [
    ["ลูกค้า", db.config.companyName || "บริษัท เนิร์ดเนื้อ จำกัด"],
    ["ที่อยู่", db.config.companyAddress || "—"],
    ["Attention", db.config.attention || "—"],
    ["โทร.", db.config.companyPhone || "—"],
    ["Tax ID", db.config.taxId || "—"],
    ["โลโก้", db.config.logoStorageKey || db.config.logoData || ""],
    ["Supplier", order.values.smoker || "Chef House"],
    ["ผู้รับออเดอร์", db.config.chefHouseContact || "—"],
    ["ที่อยู่ผู้ให้บริการ", db.config.chefHouseAddress || "—"],
    ["วันที่ PO", order.values.requestedSmokeDate || order.date],
    ["กำหนดเสร็จ", order.values.expectedFinishedDate || "—"],
    ["เลขที่การส่ง", lot.poId],
    ["Packing List", packingListSummary(db, lot.id) || "—"],
    ["สินค้า", "บริการรมควันเนื้อ"],
    ["ขนาดบรรจุ", list ? `${list.values.boxCount} กล่องรับเข้า` : "—"],
    ["จำนวน", `${fmt(n(order.values, "rawKg"))} กก.`],
    ["ราคา / กก.", `฿${fmt(n(order.values, "serviceRate"))}`],
    ["ยอดรวมก่อน VAT", `฿${fmt(n(order.values, "estimatedCost"))}`],
    ["หมายเหตุ", order.values.instruction || "—"],
  ];
}

/**
 * Smoke-service PO as previewed from the traceability register: customer block comes
 * from the lot and the contact / address from the order itself.
 */
export function smokeOrderTraceRows(
  db: Database,
  lot: Lot,
  order: Entry,
): DocumentRows {
  return [
    ["วันที่ PO", order.date],
    ["Supplier", order.values.smoker || "Chef House"],
    ["ลูกค้า", lot.values.customerName],
    ["ที่อยู่", lot.values.customerAddress],
    ["Attention", lot.values.attention],
    ["โทร.", lot.values.phone],
    ["Tax ID", lot.values.taxId],
    ["สินค้า", "บริการรมควันเนื้อ"],
    ["ขนาดบรรจุ", "—"],
    ["จำนวน", `${fmt(n(order.values, "rawKg"))} กก.`],
    ["ราคา / กก.", `฿${fmt(n(order.values, "serviceRate"))}`],
    ["ยอดรวมก่อน VAT", `฿${fmt(n(order.values, "estimatedCost"))}`],
    ["เลขที่การส่ง", lot.poId],
    ["ผู้รับออเดอร์", order.values.contactName || "—"],
    ["ที่อยู่ผู้ให้บริการ", order.values.address || "—"],
    ["Packing List", packingListSummary(db, lot.id) || "รอระบุ"],
    ["กำหนดเสร็จ", order.values.expectedFinishedDate || "—"],
    ["หมายเหตุ", order.values.instruction || "—"],
  ];
}
