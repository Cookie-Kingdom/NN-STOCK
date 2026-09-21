"use client";

import "@/styles/print-document.css";
import { Badge } from "@/components/atoms/Badge";
import { packingListSummary } from "@/components/organisms/owner/documentRows";
import { dateLabel } from "@/components/organisms/shared/documentRows";
import {
  entries,
  latestPackingList,
  n,
  smokeServiceRate,
  type Database,
  type Lot,
  type Values,
} from "@/lib/store";
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
  // A smoke PO is ordered from its shipment's Packing List; mutate() fills rawKg from it.
  const packingList = lot ? latestPackingList(db, lot.id) : undefined;
  const quantity = isSmokeOrder
    ? n(values, "rawKg") || n(packingList?.values || {}, "slicedNetKg")
    : n(values, "orderedKg");
  const rate = isSmokeOrder ? smokeServiceRate(quantity) : n(values, "price");
  const total = quantity * rate;
  const buyerName =
    values.customerName || db.config.companyName || "NerdNuea Stock";
  const buyerAddress =
    values.customerAddress || db.config.companyAddress || "—";
  const attention = values.attention || db.config.attention || "—";
  const phone = values.phone || db.config.companyPhone || "—";
  const taxId = values.taxId || db.config.taxId || "—";
  const supplier =
    values[isSmokeOrder ? "smoker" : "supplier"] ||
    (isSmokeOrder ? "Chef House" : "Foodiva");
  const supplierContact =
    db.config[isSmokeOrder ? "chefHouseContact" : "foodivaContact"] ||
    "ยังไม่ได้ตั้งค่า";
  const supplierAddress =
    db.config[isSmokeOrder ? "chefHouseAddress" : "foodivaAddress"] ||
    "ยังไม่ได้ตั้งค่า";
  // A saved smoke PO carries the number mutate() gave it; otherwise predict the next one.
  const saved = Boolean(values.orderNumber);
  const documentNumber = saved
    ? values.orderNumber
    : isSmokeOrder
      ? `SO-${date.slice(0, 4)}-${String(entries(db, "smokeOrder").length + 1).padStart(4, "0")}`
      : `PO-${date.slice(0, 4)}-${String(db.lots.length + 1).padStart(4, "0")}`;
  const issueDate = isSmokeOrder ? values.requestedSmokeDate || date : date;
  const dueDate = isSmokeOrder
    ? values.expectedFinishedDate || "—"
    : "ตามข้อตกลง";
  const itemName = isSmokeOrder
    ? "บริการรมควันเนื้อ"
    : values.productName || "เนื้อวัว";
  const packDetail = isSmokeOrder
    ? packingList
      ? `${packingList.values.boxCount} กล่องรับเข้า`
      : "รอ Foodiva ทำ Packing List"
    : values.packSize || "—";

  return (
    <aside
      className="min-h-0 flex-1 bg-bg p-5.5 max-md:p-4 lg:overflow-auto"
      aria-label="ตัวอย่างเอกสาร PO"
    >
      <div className="mx-auto mb-3.5 flex max-w-135 items-center justify-between text-text-primary">
        <div>
          <strong className="block text-h3">Preview</strong>
          <span className="mt-0.5 block text-caption text-text-secondary">
            {saved ? "เอกสารที่บันทึกแล้ว" : "อัปเดตตามที่กรอก"}
          </span>
        </div>
        {saved ? (
          <Badge tone="success">บันทึกแล้ว</Badge>
        ) : (
          <Badge tone="warning">ฉบับร่าง</Badge>
        )}
      </div>
      <article className="po-paper">
        <div className="po-paper-heading">
          <div className="po-brand-block">
            {db.config.logoData ? (
              // Stored locally as a data URL, so Next image optimization cannot process it.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="po-logo"
                src={db.config.logoData}
                alt="โลโก้ NerdNuea"
              />
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
            <span>
              {isSmokeOrder
                ? "ผู้ให้บริการ / Service provider"
                : "ผู้ขาย / Supplier"}
            </span>
            <strong>{supplier}</strong>
            <p>ผู้รับออเดอร์: {supplierContact}</p>
            <p>ที่อยู่: {supplierAddress}</p>
            {isSmokeOrder && (
              <>
                <p>บริการรมควันเนื้อตามคำสั่งซื้อ</p>
                <p>
                  อ้างอิง Packing List:{" "}
                  {(lot && packingListSummary(db, lot.id)) || "รอระบุ"}
                </p>
              </>
            )}
          </section>
        </div>

        <div className="po-meta-grid">
          <div>
            <span>วันที่ออก PO</span>
            <strong>{dateLabel(issueDate)}</strong>
          </div>
          <div>
            <span>{isSmokeOrder ? "คาดว่าจะเสร็จ" : "กำหนดชำระ"}</span>
            <strong>{dateLabel(dueDate)}</strong>
          </div>
          <div>
            <span>{isSmokeOrder ? "เลขที่การส่ง" : "อ้างอิงผู้ขาย"}</span>
            <strong>
              {isSmokeOrder ? lot?.poId || "—" : values.reference || "—"}
            </strong>
          </div>
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
            อัตราอัตโนมัติ: ต่ำกว่า 1,000 กก. ฿220 · 1,000 กก. ฿200 · 1,500 กก.
            ฿180 ต่อกก.
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
