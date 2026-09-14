"use client";

import { DataTable } from "@/components/shared/DataTable";
import { DocumentPrintButton } from "@/components/shared/DocumentPrintButton";
import { Stat } from "@/components/shared/primitives";
import { entries, n, readyForChefHouse, smokingInvoiceStatus, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

export function SmokingPurchaseOrderView({ db, open }: { db: Database; open: (kind: string, lotId?: string) => void }) {
  const eligibleLots = db.lots.filter((lot) => entries(db, "foodDivaConfirm", lot.id).length > 0);
  return <div className="settings-stack">
    <section className="panel config-heading">
      <div><span className="overline">CHEF_HOUSE SERVICE PO</span><h2>ใบสั่ง PO โรงรมควัน</h2><p className="muted">Owner ออก PO รมควันหลัง Food Diva ออก Invoice แล้ว Chef_house ต้องกดยืนยันรับ PO และ Submit ใบวางบิลก่อน Owner เรียกรถไปรับเนื้อ</p></div>
      <Stat label="PO รอยืนยันจาก Chef_house" value={`${eligibleLots.filter((lot) => entries(db, "smokeOrder", lot.id).length && !entries(db, "smokeOrderAccept", lot.id).length).length} ใบ`} />
    </section>
    <DataTable
      title="รายการ PO โรงรมควัน"
      columns={["PO เนื้อ / Lot", "Invoice Food Diva", "น้ำหนักสั่งรม", "อัตราค่ารม", "Chef_house รับ PO", "ใบวางบิล", "การทำงาน"]}
      rows={eligibleLots.map((lot) => {
        const supplierInvoice = entries(db, "foodDivaConfirm", lot.id).at(-1);
        const order = entries(db, "smokeOrder", lot.id).at(-1);
        const accepted = entries(db, "smokeOrderAccept", lot.id).at(-1);
        const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
        const invoiceStatus = invoice ? smokingInvoiceStatus(db, invoice) : "รอ Chef_house Submit";
        return [
          <span key="lot"><strong>{lot.poId}</strong><br />{lot.id}</span>,
          `${supplierInvoice?.values.invoiceNo || "-"} · พร้อมส่งเชียงใหม่ ${fmt(readyForChefHouse(db, lot.id))} กก.`,
          order ? `${fmt(n(order.values, "rawKg"))} กก.` : "ยังไม่ออก PO",
          order ? `฿${fmt(n(order.values, "serviceRate"))} / กก.` : "—",
          accepted ? `${accepted.values.acceptedBy} · รับแล้ว` : order ? <span className="badge danger" key="accept">รอยืนยัน</span> : "—",
          invoice ? `${invoice.values.invoiceNumber} · ${invoiceStatus}` : "รอ Chef_house",
          <div className="button-row" key="actions">
            {!order ? <button className="table-action" onClick={() => open("smokeOrder", lot.id)}>ออก PO รมควันเนื้อ</button> : <DocumentPrintButton title="Smoke Service Purchase Order" number={order.values.orderNumber} rows={[
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
              ["Food Diva Invoice", supplierInvoice?.values.invoiceNo || "—"],
              ["สินค้า", "บริการรมควันเนื้อ"],
              ["ขนาดบรรจุ", lot.id],
              ["จำนวน", `${fmt(n(order.values, "rawKg"))} กก.`],
              ["ราคา / กก.", `฿${fmt(n(order.values, "serviceRate"))}`],
              ["ยอดรวมก่อน VAT", `฿${fmt(n(order.values, "estimatedCost"))}`],
              ["หมายเหตุ", order.values.instruction || "—"],
            ]} />}
          </div>,
        ];
      })}
    />
    {!eligibleLots.length && <div className="notice">ยังไม่มี PO เนื้อที่ Food Diva ออก Invoice แล้ว</div>}
  </div>;
}
