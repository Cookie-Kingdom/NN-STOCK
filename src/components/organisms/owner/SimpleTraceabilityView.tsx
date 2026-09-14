"use client";

import { Fragment, type ReactNode, useState } from "react";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import { DocumentFilterBar, lotIssueDate, matchesDocumentFilter, purchaseOrderRows, type DocumentReferenceType } from "@/components/organisms/shared/documents";
import { entries, n, processLoss, processed, produced, producedBags, roleName, smokingInvoiceStatus, stages, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

export function SimpleTraceabilityView({ db }: { db: Database }) {
  const [referenceType, setReferenceType] = useState<DocumentReferenceType>("po");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedLot, setExpandedLot] = useState<string | null>(null);
  const visibleLots = db.lots.filter((lot) =>
    matchesDocumentFilter(db, lot, referenceType, query, fromDate, toDate),
  );
  const preview = (title: string, number: string, rows: [string, string][]) => (
    <DocumentPrintButton title={title} number={number} rows={rows} label="พรีวิว / PDF" preview />
  );
  return (
    <div className="settings-stack document-module">
      <section className="panel config-heading">
        <div>
          <span className="overline">READ-ONLY TRACEABILITY</span>
          <h2>เอกสารและการตรวจสอบย้อนกลับ</h2>
          <p className="muted">
            ตารางสำหรับอ่านเส้นทางของแต่ละ Lot เท่านั้น การตรวจยอด ชำระเงิน และดาวน์โหลด Invoice
            ให้ทำจากเมนูใบ Invoice
          </p>
        </div>
      </section>

      <DocumentFilterBar
        referenceType={referenceType}
        query={query}
        fromDate={fromDate}
        toDate={toDate}
        onReferenceType={setReferenceType}
        onQuery={setQuery}
        onFromDate={setFromDate}
        onToDate={setToDate}
      />

      <section className="table-section traceability-table">
        <div className="table-title">
          <div><h2>ทะเบียนเอกสารตาม Lot</h2><span>{visibleLots.length} รายการ</span></div>
          <span className="muted">กด ดู เพื่อเปิดเส้นทางเอกสาร</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th aria-label="ขยายรายละเอียด" />
                <th>สถานะ</th>
                <th>เลข PO / Lot</th>
                <th>วันที่ออก PO</th>
                <th>เอกสารล่าสุด</th>
                <th>เส้นทางล่าสุด</th>
                <th>ผู้ดำเนินการล่าสุด</th>
                <th>การทำงาน</th>
              </tr>
            </thead>
            <tbody>
              {visibleLots.length ? visibleLots.map((lot) => {
                const foodInvoice = entries(db, "foodDivaConfirm", lot.id).at(-1);
                const smokeOrder = entries(db, "smokeOrder", lot.id).at(-1);
                const chefInvoice = entries(db, "smokingInvoice", lot.id).at(-1);
                const dispatch = entries(db, "dispatch", lot.id).at(-1);
                const chefReceive = entries(db, "cmReceive", lot.id).at(-1);
                const returnTrip = entries(db, "return", lot.id).at(-1);
                const smokeEntries = entries(db, "smoke", lot.id);
                const latest = [returnTrip, chefReceive, dispatch, chefInvoice, smokeOrder, foodInvoice].find(Boolean);
                const latestDocument = returnTrip
                  ? `ใบขนส่งกลับ · ${fmt(n(returnTrip.values, "returnKg"))} กก.`
                  : chefInvoice
                    ? `Invoice Chef_house · ${chefInvoice.values.invoiceNumber}`
                    : smokeOrder
                      ? `PO โรงรมควัน · ${smokeOrder.values.orderNumber}`
                      : foodInvoice
                        ? `Invoice Foodiva · ${foodInvoice.values.invoiceNo}`
                        : "รอ Invoice Foodiva";
                const route = returnTrip
                  ? "Chef_house → Foodiva"
                  : lot.stage >= 2 && lot.stage <= 5
                    ? "Foodiva → Chef_house"
                    : lot.stage >= 6
                      ? "Chef_house → Foodiva"
                      : "Foodiva · รอเริ่มขนส่ง";
                const detailRows: [string, ReactNode, string, string, ReactNode][] = [
                  ["PO เนื้อ", lot.poId, lotIssueDate(db, lot), "ออกแล้ว", preview("Purchase Order", lot.poId, purchaseOrderRows(lot, db))],
                  ["Invoice Foodiva", foodInvoice?.values.invoiceNo || "—", foodInvoice?.values.invoiceDate || "—", foodInvoice ? `ยืนยัน ${fmt(n(foodInvoice.values, "confirmedKg"))} กก.` : "รอ Foodiva", foodInvoice ? preview("Invoice Foodiva", foodInvoice.values.invoiceNo || lot.poId, [["วันที่ Invoice", foodInvoice.values.invoiceDate], ["PO", lot.poId], ["Lot เนื้อ", lot.id], ["น้ำหนักยืนยัน", `${fmt(n(foodInvoice.values, "confirmedKg"))} กก.`], ["ยอด Invoice", `฿${fmt(n(foodInvoice.values, "invoiceAmount"))}`], ["ผู้ยืนยัน", foodInvoice.values.confirmedBy || "—"]]) : "—"],
                  ["PO โรงรมควัน", smokeOrder?.values.orderNumber || "—", smokeOrder?.date || "—", smokeOrder ? `${fmt(n(smokeOrder.values, "rawKg"))} กก.` : "รอ Owner ออก PO", smokeOrder ? preview("Smoke Service Purchase Order", smokeOrder.values.orderNumber || lot.poId, [["วันที่ PO", smokeOrder.date], ["Supplier", smokeOrder.values.smoker || "Chef_house"], ["ลูกค้า", lot.values.customerName], ["ที่อยู่", lot.values.customerAddress], ["Attention", lot.values.attention], ["โทร.", lot.values.phone], ["Tax ID", lot.values.taxId], ["สินค้า", "บริการรมควันเนื้อ"], ["ขนาดบรรจุ", "—"], ["จำนวน", `${fmt(n(smokeOrder.values, "rawKg"))} กก.`], ["ราคา / กก.", `฿${fmt(n(smokeOrder.values, "serviceRate"))}`], ["ยอดรวมก่อน VAT", `฿${fmt(n(smokeOrder.values, "estimatedCost"))}`], ["Lot เนื้อ", lot.id], ["ผู้รับออเดอร์", smokeOrder.values.contactName || "—"], ["ที่อยู่ผู้ให้บริการ", smokeOrder.values.address || "—"], ["Foodiva Invoice", foodInvoice?.values.invoiceNo || "รอระบุ"], ["กำหนดเสร็จ", smokeOrder.values.expectedFinishedDate || "—"], ["หมายเหตุ", smokeOrder.values.instruction || "—"]]) : "—"],
                  ["Invoice Chef_house", chefInvoice?.values.invoiceNumber || "—", chefInvoice?.values.invoiceDate || "—", chefInvoice ? smokingInvoiceStatus(db, chefInvoice) : "รอ Chef_house Submit", chefInvoice ? preview("Invoice Chef_house", chefInvoice.values.invoiceNumber || lot.poId, [["วันที่ Invoice", chefInvoice.values.invoiceDate], ["PO โรงรมควัน", smokeOrder?.values.orderNumber || "—"], ["Lot เนื้อ", lot.id], ["ผู้ให้บริการ", chefInvoice.values.serviceProvider || "Chef_house"], ["น้ำหนักคิดค่าบริการ", `${fmt(n(chefInvoice.values, "serviceQuantity"))} กก.`], ["ยอดสุทธิ", `฿${fmt(n(chefInvoice.values, "netPayable"))}`], ["สถานะ", smokingInvoiceStatus(db, chefInvoice)]]) : "—"],
                  ["ใบขนส่งไป Chef_house", dispatch?.values.transferNumber || "—", dispatch?.values.pickupDate || "—", dispatch ? `${fmt(n(dispatch.values, "dispatchKg"))} กก.` : "รอเรียกรถ", dispatch ? preview("ใบขนส่งเนื้อขาไป", dispatch.values.transferNumber || lot.id, [["วันที่รถรับ", dispatch.values.pickupDate || dispatch.date], ["PO", lot.poId], ["Lot เนื้อ", lot.id], ["ต้นทาง", dispatch.values.origin], ["ปลายทาง", dispatch.values.destination], ["น้ำหนักส่ง", `${fmt(n(dispatch.values, "dispatchKg"))} กก.`], ["ประเภทรถ", dispatch.values.vehicleType || "—"], ["ทะเบียนรถ", dispatch.values.plate || "—"], ["คนขับ", dispatch.values.driverName || "—"], ["เบอร์ติดต่อ", dispatch.values.driverPhone || "—"]]) : "—"],
                  ["รับที่ Chef_house", chefReceive ? `${fmt(n(chefReceive.values, "receivedKg"))} กก.` : "—", chefReceive?.date || "—", chefReceive ? "รับแล้ว" : "รอยืนยันรับ", chefReceive ? preview("ใบยืนยันรับเนื้อ Chef_house", `RCV-${lot.id}`, [["PO", lot.poId], ["Lot เนื้อ", lot.id], ["วันที่รับ", chefReceive.date], ["เวลาถึง", chefReceive.values.arrival], ["น้ำหนักรับจริง", `${fmt(n(chefReceive.values, "receivedKg"))} กก.`], ["หมายเหตุ", chefReceive.values.note || "—"]]) : "—"],
                  ...smokeEntries.map((entry) => [
                    "Lot สโมครายวัน",
                    entry.values.subLot || "—",
                    entry.values.smokeDate || entry.date,
                    `เข้าเตา ${fmt(n(entry.values, "inputKg"))} กก. · หลังรม ${fmt(n(entry.values, "outputKg"))} กก. · Waste ${fmt(n(entry.values, "wasteKg"))} กก. · ${entry.values.packCount || "0"} ถุง`,
                    preview("บันทึก Lot สโมครายวัน", entry.values.subLot || entry.id, [["Lot หลัก", lot.id], ["Lot สโมค", entry.values.subLot || "—"], ["วันที่สโมค", entry.values.smokeDate || entry.date], ["น้ำหนักเข้าเตา", `${fmt(n(entry.values, "inputKg"))} กก.`], ["น้ำหนักหลังรม", `${fmt(n(entry.values, "outputKg"))} กก.`], ["น้ำหนัก Waste", `${fmt(n(entry.values, "wasteKg"))} กก.`], ["จำนวนถุง", `${entry.values.packCount || "0"} ถุง`], ["น้ำหนักถุง", entry.values.packs || "—"]]),
                  ] as [string, ReactNode, string, string, ReactNode]),
                  ["ผลผลิตหลังรม", produced(db, lot.id) ? `${fmt(produced(db, lot.id))} กก. · ${producedBags(db, lot.id)} ถุง` : "—", produced(db, lot.id) ? "บันทึกแล้ว" : "รอผลิต", produced(db, lot.id) ? "ผลิตแล้ว" : "รอ Chef_house", smokeEntries.length ? preview("สรุปผลผลิตหลังรม", `YIELD-${lot.id}`, [["PO", lot.poId], ["Lot เนื้อ", lot.id], ["จำนวน Lot สโมค", `${smokeEntries.length} รอบ`], ["น้ำหนักเข้าเตารวม", `${fmt(processed(db, lot.id))} กก.`], ["น้ำหนักหลังรมรวม", `${fmt(produced(db, lot.id))} กก.`], ["จำนวนถุง", `${producedBags(db, lot.id)} ถุง`], ["Waste รวม", `${fmt(processLoss(db, lot.id))} กก.`]]) : "—"],
                  ["ใบขนส่งกลับ Foodiva", returnTrip?.values.transferNumber || "—", returnTrip?.values.returnDate || "—", returnTrip ? `${fmt(n(returnTrip.values, "returnKg"))} กก.` : "รอเรียกรถกลับ", returnTrip ? preview("ใบขนส่งเนื้อขากลับ", returnTrip.values.transferNumber || lot.id, [["วันที่รถรับ", returnTrip.values.returnDate || returnTrip.date], ["PO", lot.poId], ["Lot เนื้อ", lot.id], ["ต้นทาง", returnTrip.values.origin], ["ปลายทาง", returnTrip.values.destination], ["น้ำหนักส่ง", `${fmt(n(returnTrip.values, "returnKg"))} กก.`], ["ประเภทรถ", returnTrip.values.vehicleType || "—"], ["ทะเบียนรถ", returnTrip.values.plate || "—"], ["คนขับ", returnTrip.values.driverName || "—"], ["เบอร์ติดต่อ", returnTrip.values.driverPhone || "—"]]) : "—"],
                ];
                const isOpen = expandedLot === lot.id;
                return <Fragment key={lot.id}>
                  <tr>
                    <td><button type="button" className="trace-expand" aria-label={`${isOpen ? "ย่อ" : "ขยาย"}รายละเอียด ${lot.id}`} onClick={() => setExpandedLot((current) => current === lot.id ? null : lot.id)}>{isOpen ? "−" : "+"}</button></td>
                    <td><span className={lot.stage >= 8 ? "badge success" : "badge danger"}>{stages[lot.stage]}</span></td>
                    <td><strong>{lot.poId}</strong><br /><span className="muted">{lot.id}</span></td>
                    <td>{lotIssueDate(db, lot)}</td>
                    <td>{latestDocument}</td>
                    <td>{route}</td>
                    <td>{latest ? roleName[latest.role] : "Owner"}</td>
                    <td><button type="button" className="table-action" onClick={() => setExpandedLot((current) => current === lot.id ? null : lot.id)}>{isOpen ? "ซ่อน" : "ดู"}</button></td>
                  </tr>
                  {isOpen && <tr className="trace-detail-row"><td colSpan={8}>
                    <div className="trace-detail-heading"><div><strong>{lot.poId} / {lot.id}</strong><span>ลำดับเอกสารและจุดตรวจสอบย้อนกลับ</span></div>{preview("สรุปเอกสารตาม Lot", `TRACE-${lot.id}`, [["PO", lot.poId], ["Lot", lot.id], ["สถานะล่าสุด", stages[lot.stage]], ["Invoice Foodiva", foodInvoice?.values.invoiceNo || "—"], ["PO โรงรมควัน", smokeOrder?.values.orderNumber || "—"], ["Invoice Chef_house", chefInvoice?.values.invoiceNumber || "—"], ["Lot สโมค", smokeEntries.map((entry) => entry.values.subLot).filter(Boolean).join(", ") || "—"], ["ใบขนส่งขาไป", dispatch?.values.transferNumber || "—"], ["ใบขนส่งขากลับ", returnTrip?.values.transferNumber || "—"]])}</div>
                    <div className="trace-detail-scroll"><table className="trace-detail-table"><thead><tr><th>เอกสาร / ขั้นตอน</th><th>เลขอ้างอิง</th><th>วันที่</th><th>สถานะ / น้ำหนัก</th><th>เอกสาร</th></tr></thead><tbody>{detailRows.map(([type, number, documentDate, status, action], index) => <tr key={`${type}-${index}`}><td>{type}</td><td>{number}</td><td>{documentDate}</td><td>{status}</td><td>{action}</td></tr>)}</tbody></table></div>
                  </td></tr>}
                </Fragment>;
              }) : <tr><td className="no-data" colSpan={8}>ยังไม่มีเอกสารตามเงื่อนไขที่เลือก</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <p className="footnote">
        หน้านี้อ่านอย่างเดียวและไม่เปลี่ยนข้อมูลใด ๆ ทุกขั้นตอนยังทำจากเมนู PO, ใบ Invoice,
        ใบขนส่ง, งานผลิต และสต๊อกตามเดิม
      </p>
    </div>
  );
}
