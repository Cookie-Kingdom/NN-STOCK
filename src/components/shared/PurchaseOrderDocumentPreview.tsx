"use client";

import { entries, n, smokeServiceRate, type Database, type Lot, type Values } from "@/lib/store";
import { fmt } from "@/lib/format";

export function PurchaseOrderDocumentPreview({
  db,
  lot,
  kind,
  values,
  date,
}: {
  db: Database;
  lot?: Lot;
  kind: "purchase" | "smokeOrder";
  values: Values;
  date: string;
}) {
  const isSmokeOrder = kind === "smokeOrder";
  const latestFoodDivaInvoice = lot
    ? entries(db, "foodDivaConfirm", lot.id).slice(-1)[0]
    : undefined;
  const quantity = n(values, isSmokeOrder ? "rawKg" : "orderedKg");
  const rate = isSmokeOrder ? smokeServiceRate(quantity) : n(values, "price");
  const total = quantity * rate;
  const buyerName = values.customerName || db.config.companyName || "NerdNuea Stock";
  const buyerAddress = values.customerAddress || db.config.companyAddress || "—";
  const attention = values.attention || db.config.attention || "—";
  const phone = values.phone || db.config.companyPhone || "—";
  const taxId = values.taxId || db.config.taxId || "—";
  const supplier = values[isSmokeOrder ? "smoker" : "supplier"] || (isSmokeOrder ? "Chef_house" : "Food Diva");
  const supplierContact = db.config[isSmokeOrder ? "chefHouseContact" : "foodDivaContact"] || "ยังไม่ได้ตั้งค่า";
  const supplierAddress = db.config[isSmokeOrder ? "chefHouseAddress" : "foodDivaAddress"] || "ยังไม่ได้ตั้งค่า";
  const documentNumber = isSmokeOrder
    ? `SMK-PO-${date.slice(0, 4)}-${String(entries(db, "smokeOrder").length + 1).padStart(4, "0")}`
    : `PO-${date.slice(0, 4)}-${String(db.lots.length + 1).padStart(4, "0")}`;
  const issueDate = isSmokeOrder ? values.requestedSmokeDate || date : date;
  const dueDate = isSmokeOrder ? values.expectedFinishedDate || "—" : "ตามข้อตกลง";
  const itemName = isSmokeOrder
    ? "บริการรมควันเนื้อ"
    : values.productName || "เนื้อวัว";
  const packDetail = isSmokeOrder
    ? lot?.id || "เลือก Lot ที่ได้รับ Invoice จาก Food Diva"
    : values.packSize || "—";
  const dateLabel = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value || "—";
    return new Intl.DateTimeFormat("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${value}T00:00:00`));
  };

  return (
    <aside className="po-document-preview" aria-label="ตัวอย่างเอกสาร PO">
      <div className="po-preview-toolbar">
        <div>
          <strong>Preview</strong>
          <span>อัปเดตตามที่กรอก</span>
        </div>
        <span className="draft-badge">ฉบับร่าง</span>
      </div>
      <article className="po-paper">
        <div className="po-paper-heading">
          <div className="po-brand-block">
            {db.config.logoData ? (
              // Stored locally as a data URL, so Next image optimization cannot process it.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="po-logo" src={db.config.logoData} alt="โลโก้ NerdNuea" />
            ) : (
              <span className="po-logo-placeholder">พื้นที่โลโก้</span>
            )}
            <div>
              <h3>{isSmokeOrder ? "SMOKING SERVICE PO" : "PURCHASE ORDER"}</h3>
            </div>
          </div>
          <div className="po-number">
            <span>เลขที่เอกสาร</span>
            <strong>{documentNumber}</strong>
          </div>
        </div>

        <div className="po-party-grid">
          <section>
            <span>ผู้ซื้อ / Buyer</span>
            <strong>{buyerName}</strong>
            <p>{buyerAddress}</p>
            <p>Attention: {attention}</p>
            <p>โทร. {phone}</p>
            <p>Tax ID: {taxId}</p>
          </section>
          <section>
            <span>{isSmokeOrder ? "ผู้ให้บริการ / Service provider" : "ผู้ขาย / Supplier"}</span>
            <strong>{supplier}</strong>
            <p>ผู้รับออเดอร์: {supplierContact}</p>
            <p>ที่อยู่: {supplierAddress}</p>
            {isSmokeOrder && (
              <>
                <p>บริการรมควันเนื้อตามคำสั่งซื้อ</p>
                <p>อ้างอิง Invoice Food Diva: {latestFoodDivaInvoice?.values.invoiceNo || latestFoodDivaInvoice?.values.invoiceNumber || "รอระบุ"}</p>
              </>
            )}
          </section>
        </div>

        <div className="po-meta-grid">
          <div><span>วันที่ออก PO</span><strong>{dateLabel(issueDate)}</strong></div>
          <div><span>{isSmokeOrder ? "คาดว่าจะเสร็จ" : "กำหนดชำระ"}</span><strong>{dateLabel(dueDate)}</strong></div>
          <div><span>{isSmokeOrder ? "Lot เนื้อ" : "อ้างอิงผู้ขาย"}</span><strong>{isSmokeOrder ? lot?.id || "—" : values.reference || "—"}</strong></div>
        </div>

        <table className="po-item-table">
          <thead>
            <tr>
              <th>รายการ</th>
              <th>รายละเอียด</th>
              <th>จำนวน</th>
              <th>ราคา / กก.</th>
              <th>รวม</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{itemName}</td>
              <td>{packDetail}</td>
              <td>{fmt(quantity)} กก.</td>
              <td>฿{fmt(rate)}</td>
              <td>฿{fmt(total)}</td>
            </tr>
          </tbody>
        </table>

        {isSmokeOrder && (
          <div className="po-rate-note">
            อัตราอัตโนมัติ: ต่ำกว่า 1,000 กก. ฿220 · 1,000 กก. ฿200 · 1,500 กก. ฿180 ต่อกก.
          </div>
        )}

        <div className="po-total">
          <span>ยอดรวมประมาณการ</span>
          <strong>฿{fmt(total)}</strong>
        </div>
        <div className="po-note">
          <strong>หมายเหตุ</strong>
          <p>{(isSmokeOrder ? values.instruction : values.note) || "—"}</p>
        </div>
        <div className="po-paper-footer">
          <span>ผู้จัดทำ: {attention}</span>
          <span>สถานะ: รอการบันทึก</span>
        </div>
      </article>
    </aside>
  );
}
