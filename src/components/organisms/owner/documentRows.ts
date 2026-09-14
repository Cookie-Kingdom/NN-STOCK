import { fmt } from "@/lib/format";
import { n, type Database, type Entry, type Lot } from "@/lib/store";

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

/** Print rows for a `dispatch` (outbound) or `return` transport entry. */
export function transportDocumentRows(
  lot: Lot,
  trip: Entry,
  direction: TransportDirection,
): DocumentRows {
  const keys = transportKeys[direction];
  return [
    ["วันที่รถรับ", trip.values[keys.date] || trip.date],
    ["PO", lot.poId],
    ["Lot เนื้อ", lot.id],
    ["ต้นทาง", trip.values.origin],
    ["ปลายทาง", trip.values.destination],
    ["น้ำหนักส่ง", `${fmt(n(trip.values, keys.kg))} กก.`],
    ["ประเภทรถ", trip.values.vehicleType || "—"],
    ["ทะเบียนรถ", trip.values.plate || "—"],
    ["คนขับ", trip.values.driverName || "—"],
    ["เบอร์ติดต่อ", trip.values.driverPhone || "—"],
  ];
}

/**
 * Smoke-service PO as printed from the smoking PO tab: customer block comes from
 * the current company config.
 */
export function smokeOrderPrintRows(
  db: Database,
  lot: Lot,
  order: Entry,
  supplierInvoice: Entry | undefined,
): DocumentRows {
  return [
    ["ลูกค้า", db.config.companyName || "บริษัท เนิร์ดเนื้อ จำกัด"],
    ["ที่อยู่", db.config.companyAddress || "—"],
    ["Attention", db.config.attention || "—"],
    ["โทร.", db.config.companyPhone || "—"],
    ["Tax ID", db.config.taxId || "—"],
    ["โลโก้", db.config.logoData || ""],
    ["Supplier", order.values.smoker || "Chef_house"],
    ["ผู้รับออเดอร์", db.config.chefHouseContact || "—"],
    ["ที่อยู่ผู้ให้บริการ", db.config.chefHouseAddress || "—"],
    ["วันที่ PO", order.values.requestedSmokeDate || order.date],
    ["กำหนดเสร็จ", order.values.expectedFinishedDate || "—"],
    ["Lot เนื้อ", lot.id],
    ["Foodiva Invoice", supplierInvoice?.values.invoiceNo || "—"],
    ["สินค้า", "บริการรมควันเนื้อ"],
    ["ขนาดบรรจุ", lot.id],
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
  lot: Lot,
  order: Entry,
  foodInvoice: Entry | undefined,
): DocumentRows {
  return [
    ["วันที่ PO", order.date],
    ["Supplier", order.values.smoker || "Chef_house"],
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
    ["Lot เนื้อ", lot.id],
    ["ผู้รับออเดอร์", order.values.contactName || "—"],
    ["ที่อยู่ผู้ให้บริการ", order.values.address || "—"],
    ["Foodiva Invoice", foodInvoice?.values.invoiceNo || "รอระบุ"],
    ["กำหนดเสร็จ", order.values.expectedFinishedDate || "—"],
    ["หมายเหตุ", order.values.instruction || "—"],
  ];
}
