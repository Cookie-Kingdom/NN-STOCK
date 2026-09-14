"use client";

import { DataTable } from "@/components/shared/DataTable";
import { DocumentPrintButton } from "@/components/shared/DocumentPrintButton";
import { averageYield, entries, n, processLoss, processed, produced, rawAtFoodiva, rawAtSmoker, smokingInvoiceStatus, steakRawStock, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

export function DocumentModuleView({ db, open }: { db: Database; open: (kind: string, lotId?: string) => void }) {
  const openPo = db.lots.filter((lot) => lot.stage < 8).length;
  const outstandingSupplier = entries(db, "supplierInvoice").filter((entry) => entry.values.paymentStatus !== "Paid");
  const outstandingSmoking = entries(db, "smokingInvoice").filter((entry) => smokingInvoiceStatus(db, entry) !== "ชำระแล้ว");
  const printDocument = () => window.print();
  return <div className="settings-stack document-module">
    <section className="panel config-heading">
      <div><span className="overline">DOCUMENT CONTROL</span><h2>เอกสารและการตรวจสอบย้อนกลับ</h2><p className="muted">เอกสารทุกฉบับอ้างอิง PO และ Beef Lot เดียวกับสต๊อก ไม่มีการลบรายการที่ยืนยันแล้ว ให้ใช้ยกเลิกเพื่อรักษาประวัติ</p></div>
      <button className="secondary" onClick={printDocument}>พิมพ์ / บันทึก PDF</button>
    </section>
    <section className="dashboard-kpis document-kpis">
      <article className="kpi-card"><small>Open PO</small><strong>{openPo}</strong><small>Lot ที่ยังดำเนินการ</small></article>
      <article className="kpi-card"><small>Supplier Invoice ค้างชำระ</small><strong>{outstandingSupplier.length}</strong><small>ใบ</small></article>
      <article className="kpi-card"><small>Smoking Invoice ค้างชำระ</small><strong>{outstandingSmoking.length}</strong><small>ใบ</small></article>
      <article className="kpi-card"><small>Average Yield</small><strong>{fmt(averageYield(db))}%</strong><small>ทุก Smoke Batch</small></article>
    </section>
    <DataTable title="Beef Lot traceability และสถานะสต๊อก" columns={["PO / Beef Lot", "ซื้อจาก", "Foodiva", "ที่โรงรม", "Steak", "หลังรม", "Loss / Yield", "เอกสารต่อไป"]} rows={db.lots.map((lot) => {
      const smokeInput = processed(db, lot.id);
      const yieldPct = smokeInput > 0 ? produced(db, lot.id) / smokeInput * 100 : 0;
      const hasSmokeOrder = entries(db, "smokeOrder", lot.id).length;
      return [
        <span key="lot"><strong>{lot.poId}</strong><br />{lot.id}</span>,
        `${lot.values.supplier || "Foodiva"} · ${fmt(n(lot.values, "orderedKg"))} กก.`,
        `${fmt(rawAtFoodiva(db, lot))} กก.`, `${fmt(rawAtSmoker(db, lot))} กก.`, `${fmt(steakRawStock(db, lot.id))} กก.`, `${fmt(produced(db, lot.id))} กก.`,
        smokeInput ? `${fmt(processLoss(db, lot.id))} กก. / ${fmt(yieldPct)}%` : "รอผลิต",
        <div className="button-row" key="action">
          <button className="table-action" onClick={() => open("taxDocument", lot.id)}>ภาษี</button>
          {entries(db, "foodDivaConfirm", lot.id).length > 0 && !hasSmokeOrder && <span className="muted">ออก PO จากเมนูใบสั่ง PO โรงรมควัน</span>}
          {rawAtFoodiva(db, lot) > 0.001 && <button className="table-action" onClick={() => open("steakTransfer", lot.id)}>โอนไป Steak</button>}
          {entries(db, "smokeOrder", lot.id).length > 0 && <span className="muted">Chef_house ออกใบวางบิลจากเมนูงานผลิต</span>}
        </div>,
      ];
    })} />
    <DataTable title="Stock Transfer Document" columns={["เลขโอน", "วันที่", "PO / Lot", "ต้นทาง → ปลายทาง", "ส่งออก", "รับจริง", "สถานะ", "เอกสาร"]} rows={[
      ...entries(db, "dispatch").map((entry) => { const lot = db.lots.find((item) => item.id === entry.lotId); const number = entry.values.transferNumber || entry.id.slice(0, 8); return [number, entry.date, `${lot?.poId || "-"} / ${entry.lotId}`, `${entry.values.origin} → ${entry.values.destination}`, `${fmt(n(entry.values, "dispatchKg"))} กก.`, `${fmt(n(lot?.values || {}, "receivedKg"))} กก.`, lot?.stage && lot.stage >= 2 ? "Received by Chef_house" : "In Transit", <DocumentPrintButton key={entry.id} title="Stock Transfer Document" number={number} rows={[["วันที่", entry.date], ["PO", lot?.poId || "-"], ["Beef Lot", entry.lotId], ["ต้นทาง", entry.values.origin], ["ปลายทาง", entry.values.destination], ["น้ำหนักส่ง", `${fmt(n(entry.values, "dispatchKg"))} กก.`], ["ทะเบียนรถ", entry.values.plate || "-"], ["คนขับ", entry.values.driverName || "-"]]} />]; }),
      ...entries(db, "steakTransfer").map((entry) => { const lot = db.lots.find((item) => item.id === entry.lotId); return [entry.values.transferNumber, entry.values.transferDate, `${lot?.poId || "-"} / ${entry.lotId}`, "Foodiva / Raw Meat Storage → Steak Production", `${fmt(n(entry.values, "quantityKg"))} กก.`, `${fmt(n(entry.values, "quantityKg"))} กก.`, "Received", <DocumentPrintButton key={entry.id} title="Internal Stock Transfer to Steak" number={entry.values.transferNumber} rows={[["วันที่", entry.values.transferDate], ["PO", lot?.poId || "-"], ["Beef Lot", entry.lotId], ["ต้นทาง", entry.values.sourceLocation], ["ปลายทาง", entry.values.destinationLocation], ["จำนวน", `${fmt(n(entry.values, "quantityKg"))} กก.`], ["เหตุผล", entry.values.reason]]} />]; }),
    ]} />
    <DataTable title="Supplier Invoice และ Tax documents" columns={["ประเภท", "เลขที่", "วันที่", "PO / Lot", "ยอดรวม", "VAT", "สถานะ", "เอกสาร"]} rows={[
      ...entries(db, "foodDivaConfirm").map((entry) => { const lot = db.lots.find((item) => item.id === entry.lotId); return ["Foodiva Meat Invoice", entry.values.invoiceNo, entry.values.invoiceDate, `${lot?.poId || "-"} / ${entry.lotId}`, `฿${fmt(n(entry.values, "invoiceAmount"))}`, "—", "Foodiva ยืนยันแล้ว", <DocumentPrintButton key={entry.id} title="Foodiva Meat Invoice" number={entry.values.invoiceNo} rows={[["วันที่ Invoice", entry.values.invoiceDate], ["Foodiva", entry.values.confirmedBy], ["PO", lot?.poId || "-"], ["Beef Lot", entry.lotId], ["จำนวน", `${fmt(n(entry.values, "confirmedKg"))} กก.`], ["ยอดรวม", `฿${fmt(n(entry.values, "invoiceAmount"))}`], ["ไฟล์แนบ", entry.values.attachment]]} />]; }),
      ...entries(db, "supplierInvoice").map((entry) => { const lot = db.lots.find((item) => item.id === entry.lotId); return ["Supplier Invoice", entry.values.invoiceNumber, entry.values.invoiceDate, `${lot?.poId || "-"} / ${entry.lotId}`, `฿${fmt(n(entry.values, "totalAmount"))}`, `฿${fmt(n(entry.values, "vat"))}`, entry.values.paymentStatus, <DocumentPrintButton key={entry.id} title="Supplier Invoice Record" number={entry.values.invoiceNumber} rows={[["วันที่ Invoice", entry.values.invoiceDate], ["Supplier", lot?.values.supplier || "Foodiva"], ["PO", lot?.poId || "-"], ["Beef Lot", entry.lotId], ["จำนวน", `${fmt(n(entry.values, "quantityKg"))} กก.`], ["ยอดก่อน VAT", `฿${fmt(n(entry.values, "amountBeforeVat"))}`], ["VAT", `฿${fmt(n(entry.values, "vat"))}`], ["ยอดรวม", `฿${fmt(n(entry.values, "totalAmount"))}`], ["ครบกำหนด", entry.values.dueDate], ["สถานะชำระ", entry.values.paymentStatus]]} />]; }),
      ...entries(db, "taxDocument").map((entry) => { const lot = db.lots.find((item) => item.id === entry.lotId); return [entry.values.documentType, entry.values.documentNumber, entry.values.documentDate, `${lot?.poId || "-"} / ${entry.lotId}`, `฿${fmt(n(entry.values, "amount"))}`, `฿${fmt(n(entry.values, "vat"))}`, entry.values.attachment ? "แนบไฟล์แล้ว" : "รอแนบไฟล์", <DocumentPrintButton key={entry.id} title={entry.values.documentType} number={entry.values.documentNumber} rows={[["วันที่เอกสาร", entry.values.documentDate], ["Supplier", lot?.values.supplier || "Foodiva"], ["PO", lot?.poId || "-"], ["ยอด", `฿${fmt(n(entry.values, "amount"))}`], ["VAT", `฿${fmt(n(entry.values, "vat"))}`], ["ไฟล์แนบ", entry.values.attachment || "—"]]} />]; }),
      ...entries(db, "smokingInvoice").map((entry) => { const lot = db.lots.find((item) => item.id === entry.lotId); const status = smokingInvoiceStatus(db, entry); return ["Smoking Service Invoice", entry.values.invoiceNumber, entry.values.invoiceDate, `${lot?.poId || "-"} / ${entry.lotId}`, `฿${fmt(n(entry.values, "netPayable"))}`, `฿${fmt(n(entry.values, "vat"))}`, status, <div className="button-row" key={entry.id}><DocumentPrintButton title="Smoking Service Invoice" number={entry.values.invoiceNumber} rows={[["วันที่ Invoice", entry.values.invoiceDate], ["ผู้ให้บริการ", entry.values.serviceProvider], ["PO", lot?.poId || "-"], ["Beef Lot", entry.lotId], ["จำนวนคิดค่าบริการ", `${fmt(n(entry.values, "serviceQuantity"))} กก.`], ["ยอดก่อน VAT", `฿${fmt(n(entry.values, "amountBeforeVat"))}`], ["VAT", `฿${fmt(n(entry.values, "vat"))}`], ["หัก ณ ที่จ่าย", `฿${fmt(n(entry.values, "withholdingTax"))}`], ["ยอดสุทธิ", `฿${fmt(n(entry.values, "netPayable"))}`], ["ไฟล์แนบ", entry.values.attachment]]} />{status === "รอตรวจยอด" && <button className="table-action" onClick={() => open("invoiceReview", entry.lotId)}>ตรวจยอด</button>}{status === "รอชำระ" && <button className="table-action" onClick={() => open("invoicePayment", entry.lotId)}>ชำระเงิน</button>}</div>]; }),
    ]} />
    <DataTable title="PO รมควัน และผลผลิต" columns={["Smoke Order", "Lot", "น้ำหนักดิบ", "Chef_house รับ PO", "วันที่ขอรม", "Smoke Batch", "น้ำหนักหลังรม", "Loss", "Yield", "เอกสาร"]} rows={entries(db, "smokeOrder").map((order) => {
      const smokeEntries = entries(db, "smoke", order.lotId);
      const accepted = entries(db, "smokeOrderAccept", order.lotId).at(-1);
      const input = smokeEntries.reduce((sum, entry) => sum + n(entry.values, "inputKg"), 0);
      const output = smokeEntries.reduce((sum, entry) => sum + n(entry.values, "outputKg"), 0);
      return [order.values.orderNumber, order.lotId, `${fmt(n(order.values, "rawKg"))} กก.`, accepted ? `${accepted.values.acceptedBy} · รับแล้ว` : "รอยืนยันรับ", order.values.requestedSmokeDate, smokeEntries.map((entry) => entry.values.subLot).filter(Boolean).join(", ") || "รอผล", `${fmt(output)} กก.`, `${fmt(Math.max(0, input - output))} กก.`, input ? `${fmt(output / input * 100)}%` : "—", <DocumentPrintButton key={order.id} title="Smoke Service Order" number={order.values.orderNumber} rows={[["วันที่สั่งงาน", order.date], ["โรงรม", order.values.smoker], ["Beef Lot", order.lotId], ["น้ำหนักเนื้อดิบ", `${fmt(n(order.values, "rawKg"))} กก.`], ["Chef_house รับ PO", accepted?.values.acceptedBy || "รอยืนยันรับ"], ["วันที่ขอรม", order.values.requestedSmokeDate], ["อัตราค่ารม", `฿${fmt(n(order.values, "serviceRate"))} / กก.`], ["ค่าบริการประมาณการ", `฿${fmt(n(order.values, "estimatedCost"))}`], ["คำสั่งพิเศษ", order.values.instruction || "—"], ["คาดว่าเสร็จ", order.values.expectedFinishedDate]]} />];
    })} />
    <p className="footnote">ข้อมูลบันทึกด้วยบทบาทและเวลาอัตโนมัติใน Log ของระบบ เอกสารที่ยืนยันแล้วใช้การยกเลิก/ปรับปรุงแทนการลบ เพื่อให้ย้อนรอยได้</p>
  </div>;
}

// Kept temporarily so older document-control markup can be reused without affecting the read-only view.
void DocumentModuleView;
