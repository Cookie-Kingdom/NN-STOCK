import { entries, n, type Database, type Lot } from "@/lib/store";
import { fmt } from "@/lib/format";

export function purchaseOrderRows(lot: Lot, db: Database): [string, string][] {
  const purchase = entries(db, "purchase", lot.id).at(-1);
  // Same fallbacks as PurchaseOrderDocumentPreview; lot.config is the config snapshot taken when the PO was created.
  const config = (key: string) => lot.config?.[key] || db.config[key] || "";
  return [
    ["วันที่ PO", purchase?.date || lot.values.purchaseDate || "—"],
    ["Supplier", lot.values.supplier || "Foodiva"],
    ["ผู้รับออเดอร์", config("foodivaContact") || "ยังไม่ได้ตั้งค่า"],
    ["ที่อยู่ผู้ให้บริการ", config("foodivaAddress") || "ยังไม่ได้ตั้งค่า"],
    [
      "ลูกค้า",
      lot.values.customerName || config("companyName") || "NerdNuea Stock",
    ],
    ["ที่อยู่", lot.values.customerAddress || config("companyAddress") || "—"],
    ["Attention", lot.values.attention || config("attention") || "—"],
    ["โทร.", lot.values.phone || config("companyPhone") || "—"],
    ["Tax ID", lot.values.taxId || config("taxId") || "—"],
    // A storage key (`branding/…`), or a data URL saved before the move; the print button loads it.
    ["โลโก้", config("logoStorageKey") || config("logoData")],
    ["สินค้า", lot.values.productName || "เนื้อวัว"],
    ["ขนาดบรรจุ", lot.values.packSize],
    ["จำนวน", `${fmt(n(lot.values, "orderedKg"))} กก.`],
    ["ราคา / กก.", `฿${fmt(n(lot.values, "price"))}`],
    [
      "ยอดรวมก่อน VAT",
      `฿${fmt(n(lot.values, "orderedKg") * n(lot.values, "price"))}`,
    ],
    // Later stages merge their own `note`/`reference` into lot.values; the PO keeps what it was issued with.
    ["อ้างอิงผู้ขาย", (purchase?.values ?? lot.values).reference || "—"],
    ["หมายเหตุ", (purchase?.values ?? lot.values).note || "—"],
  ];
}

export type DocumentReferenceType = "po" | "lot";

export function lotIssueDate(db: Database, lot: Lot) {
  const purchase =
    entries(db, "purchase", lot.id).at(-1) ??
    entries(db, "shipmentRequest", lot.id).at(-1);
  if (purchase?.date) return purchase.date;
  const match = lot.id.match(/(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "—";
}

export function matchesDocumentFilter(
  db: Database,
  lot: Lot | undefined,
  referenceType: DocumentReferenceType,
  query: string,
  fromDate: string,
  toDate: string,
) {
  if (!lot) return false;
  const reference = referenceType === "po" ? lot.poId : lot.id;
  const issueDate = lotIssueDate(db, lot);
  return (
    (!query || reference.toLowerCase().includes(query.trim().toLowerCase())) &&
    (!fromDate || issueDate >= fromDate) &&
    (!toDate || issueDate <= toDate)
  );
}

const thaiDate = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** `YYYY-MM-DD` → Thai short date (e.g. "15 ก.ย. 2569"); anything else is returned as-is, empty → "—". */
export function dateLabel(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value || "—";
  return thaiDate.format(new Date(`${value}T00:00:00`));
}
