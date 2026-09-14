"use client";

import { entries, n, type Database, type Lot } from "@/lib/store";
import { fmt } from "@/lib/format";

export function purchaseOrderRows(lot: Lot, db: Database): [string, string][] {
  const purchase = entries(db, "purchase", lot.id).at(-1);
  // Same fallbacks as PurchaseOrderDocumentPreview; lot.config is the config snapshot taken when the PO was created.
  const config = (key: string) => lot.config?.[key] || db.config[key] || "";
  return [
    ["วันที่ PO", purchase?.date || lot.values.purchaseDate || "—"],
    ["Supplier", lot.values.supplier || "Food Diva"],
    ["ผู้รับออเดอร์", config("foodDivaContact") || "ยังไม่ได้ตั้งค่า"],
    ["ที่อยู่ผู้ให้บริการ", config("foodDivaAddress") || "ยังไม่ได้ตั้งค่า"],
    ["ลูกค้า", lot.values.customerName || config("companyName") || "NerdNuea Stock"],
    ["ที่อยู่", lot.values.customerAddress || config("companyAddress") || "—"],
    ["Attention", lot.values.attention || config("attention") || "—"],
    ["โทร.", lot.values.phone || config("companyPhone") || "—"],
    ["Tax ID", lot.values.taxId || config("taxId") || "—"],
    ["โลโก้", config("logoData")],
    ["สินค้า", lot.values.productName || "เนื้อวัว"],
    ["ขนาดบรรจุ", lot.values.packSize],
    ["จำนวน", `${fmt(n(lot.values, "orderedKg"))} กก.`],
    ["ราคา / กก.", `฿${fmt(n(lot.values, "price"))}`],
    ["ยอดรวมก่อน VAT", `฿${fmt(n(lot.values, "orderedKg") * n(lot.values, "price"))}`],
    ["อ้างอิงผู้ขาย", lot.values.reference || "—"],
    ["หมายเหตุ", lot.values.note || "—"],
  ];
}

export type DocumentReferenceType = "po" | "lot";

export function lotIssueDate(db: Database, lot: Lot) {
  const purchase = entries(db, "purchase", lot.id).at(-1);
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

export function DocumentFilterBar({
  referenceType,
  query,
  fromDate,
  toDate,
  onReferenceType,
  onQuery,
  onFromDate,
  onToDate,
}: {
  referenceType: DocumentReferenceType;
  query: string;
  fromDate: string;
  toDate: string;
  onReferenceType: (value: DocumentReferenceType) => void;
  onQuery: (value: string) => void;
  onFromDate: (value: string) => void;
  onToDate: (value: string) => void;
}) {
  const label = referenceType === "po" ? "เลข PO" : "เลข Lot";
  return (
    <section className="panel document-filter-panel">
      <div>
        <span className="overline">FILTER DOCUMENTS</span>
        <p className="muted">กรองจากวันที่ออก PO / วันที่เปิด Lot เป็นหลัก</p>
      </div>
      <div className="table-filters">
        <label className="table-filter">
          กรองตาม
          <select value={referenceType} onChange={(event) => onReferenceType(event.target.value as DocumentReferenceType)}>
            <option value="po">เลข PO</option>
            <option value="lot">เลข Lot</option>
          </select>
        </label>
        <label className="table-filter">
          ค้นหา {label}
          <input value={query} placeholder={`เช่น ${referenceType === "po" ? "PO-2026..." : "NN-2026..."}`} onChange={(event) => onQuery(event.target.value)} />
        </label>
        <label className="table-filter">
          ตั้งแต่วันที่ PO / Lot
          <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => onFromDate(event.target.value)} />
        </label>
        <label className="table-filter">
          ถึงวันที่ PO / Lot
          <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => onToDate(event.target.value)} />
        </label>
        <button type="button" className="secondary" onClick={() => { onQuery(""); onFromDate(""); onToDate(""); }}>
          ล้าง Filter
        </button>
      </div>
    </section>
  );
}
