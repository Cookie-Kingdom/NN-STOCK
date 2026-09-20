import {
  foodivaInvoiceRows,
  smokeOrderPrintRows,
  smokingInvoiceRows,
  transportDocumentRows,
  transportDocumentTitle,
  type DocumentRows,
} from "@/components/organisms/owner/documentRows";
import { purchaseOrderRows } from "@/components/organisms/shared/documentRows";
import { entries, type Database, type Entry, type Lot } from "@/lib/store";

export type ReferenceDocument = {
  title: string;
  number: string;
  /** Same rows the print button uses, so the form and the printout agree. */
  rows: DocumentRows;
  /** Labels from `rows` shown in the form. */
  summary: string[];
  /** The file the counterparty uploaded, when this document is a real upload. */
  attachment?: { name: string; data?: string; storageKey?: string };
};

const hasFile = (entry: Entry) =>
  Boolean(entry.values.attachmentData || entry.values.attachmentStorageKey);

/* An invoice the counterparty uploaded is never the generated sheet, so any
 * uploaded file on the document wins: the newest version that still carries the
 * bytes, and otherwise the latest entry, whose button says the file is missing.
 * Re-saving an invoice without picking the file again (Foodiva "แก้ไข / อัปโหลดใหม่")
 * used to leave the newest entry holding the file name only, and the form then
 * showed the generated sheet as if it were the upload. */
function attachmentOf(history: Entry[]) {
  const entry = history.filter(hasFile).at(-1) ?? history.at(-1);
  const v = entry?.values;
  if (!v || !v.attachment) return undefined;
  return {
    name: v.attachment,
    data: v.attachmentData,
    storageKey: v.attachmentStorageKey,
  };
}

/** The earlier document a lot form builds on, or undefined when the form has none. */
export function referenceDocument(
  db: Database,
  kind: string,
  lot: Lot,
): ReferenceDocument | undefined {
  const history = (k: string) => entries(db, k, lot.id);
  const latest = (k: string) => history(k).at(-1);
  const foodInvoice = latest("foodivaConfirm");
  const order = latest("smokeOrder");
  const smokeInvoice = latest("smokingInvoice");
  if (kind === "foodivaConfirm")
    return {
      title: "Purchase Order",
      number: lot.poId,
      rows: purchaseOrderRows(lot, db),
      summary: [
        "สินค้า",
        "ขนาดบรรจุ",
        "จำนวน",
        "ราคา / กก.",
        "ยอดรวมก่อน VAT",
        "หมายเหตุ",
      ],
    };
  if (kind === "smokeOrder" && foodInvoice)
    return {
      title: "Invoice Foodiva",
      number: foodInvoice.values.invoiceNo || lot.poId,
      rows: foodivaInvoiceRows(db, lot, foodInvoice),
      summary: ["วันที่ Invoice", "น้ำหนักยืนยัน", "พร้อมส่งเชียงใหม่"],
      attachment: attachmentOf(history("foodivaConfirm")),
    };
  if ((kind === "smokeOrderAccept" || kind === "smokingInvoice") && order)
    return {
      title: "Smoke Service Purchase Order",
      number: order.values.orderNumber,
      rows: smokeOrderPrintRows(db, lot, order, foodInvoice),
      summary: [
        "วันที่ PO",
        "กำหนดเสร็จ",
        "จำนวน",
        "ราคา / กก.",
        "ยอดรวมก่อน VAT",
        "หมายเหตุ",
      ],
    };
  if (
    ["invoiceReview", "invoicePayment", "dispatch"].includes(kind) &&
    smokeInvoice
  )
    return {
      title: "Invoice Chef_house",
      number: smokeInvoice.values.invoiceNumber || lot.poId,
      rows: smokingInvoiceRows(db, lot, smokeInvoice, order),
      summary: ["PO โรงรมควัน", "น้ำหนักคิดค่าบริการ", "ยอดสุทธิ", "สถานะ"],
      attachment: attachmentOf(history("smokingInvoice")),
    };
  const direction =
    kind === "cmReceive"
      ? "outbound"
      : kind === "foodivaReturnReceive"
        ? "return"
        : undefined;
  const trip =
    direction && latest(direction === "outbound" ? "dispatch" : "return");
  if (direction && trip)
    return {
      title: transportDocumentTitle[direction],
      number: trip.values.transferNumber || trip.id.slice(0, 8),
      rows: transportDocumentRows(lot, trip, direction),
      summary: ["วันที่รถรับ", "ทะเบียนรถ", "คนขับ", "น้ำหนักส่ง"],
    };
  return undefined;
}
