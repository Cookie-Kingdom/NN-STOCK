"use client";

import { useState } from "react";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentFilterBar, lotIssueDate, matchesDocumentFilter, type DocumentReferenceType } from "@/components/organisms/shared/documents";
import { InvoiceDownloadButton } from "@/components/organisms/shared/InvoiceDownloadButton";
import { Stat } from "@/components/shared/primitives";
import { entries, n, smokingInvoiceStatus, type Database, type Lot } from "@/lib/store";
import { fmt } from "@/lib/format";

export function InvoiceView({ db, open }: { db: Database; open: (kind: string, lotId?: string) => void }) {
  const [referenceType, setReferenceType] = useState<DocumentReferenceType>("po");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const matches = (lot: Lot | undefined) => matchesDocumentFilter(db, lot, referenceType, query, fromDate, toDate);
  const foodivaInvoices = entries(db, "foodDivaConfirm").filter((entry) => matches(db.lots.find((lot) => lot.id === entry.lotId)));
  const smokingInvoices = entries(db, "smokingInvoice").filter((entry) => matches(db.lots.find((lot) => lot.id === entry.lotId)));
  return (
    <div className="settings-stack">
      <section className="panel config-heading">
        <div>
          <span className="overline">INVOICE CENTER</span>
          <h2>ใบ Invoice</h2>
          <p className="muted">Owner เปิดและดาวน์โหลดไฟล์ Invoice ที่ Foodiva และ Chef_house แนบไว้ได้จากหน้านี้ โดยแยกจากเมนู PO</p>
        </div>
        <Stat label="Invoice รอตรวจยอด" value={`${smokingInvoices.filter((entry) => smokingInvoiceStatus(db, entry) === "รอตรวจยอด").length} ใบ`} />
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
      <DataTable
        title="Invoice Foodiva"
        columns={["เลข Invoice", "วันที่ Invoice", "PO / Lot", "วันที่ PO / Lot", "น้ำหนัก", "ยอดรวม", "ผู้ยืนยัน", "ไฟล์"]}
        rows={foodivaInvoices.map((entry) => {
          const lot = db.lots.find((item) => item.id === entry.lotId);
          return [
            entry.values.invoiceNo,
            entry.values.invoiceDate,
            `${lot?.poId || "-"} / ${entry.lotId}`,
            lot ? lotIssueDate(db, lot) : "—",
            `${fmt(n(entry.values, "confirmedKg"))} กก.`,
            `฿${fmt(n(entry.values, "invoiceAmount"))}`,
            entry.values.confirmedBy || "—",
            <InvoiceDownloadButton key={entry.id} name={entry.values.attachment} data={entry.values.attachmentData} storageKey={entry.values.attachmentStorageKey} />,
          ];
        })}
      />
      <DataTable
        title="Invoice Chef_house"
        columns={["เลข Invoice", "วันที่ Invoice", "PO / Lot", "วันที่ PO / Lot", "ยอดตาม PO", "รายละเอียด", "สถานะ", "ไฟล์", "การทำงาน"]}
        rows={smokingInvoices.map((entry) => {
          const lot = db.lots.find((item) => item.id === entry.lotId);
          const status = smokingInvoiceStatus(db, entry);
          return [
            entry.values.invoiceNumber,
            entry.values.invoiceDate,
            `${lot?.poId || "-"} / ${entry.lotId}`,
            lot ? lotIssueDate(db, lot) : "—",
            `฿${fmt(n(entry.values, "netPayable"))}`,
            entry.values.invoiceDetail || "—",
            status,
            <InvoiceDownloadButton key={`file-${entry.id}`} name={entry.values.attachment} data={entry.values.attachmentData} storageKey={entry.values.attachmentStorageKey} />,
            <div className="button-row" key={`action-${entry.id}`}>
              {status === "รอตรวจยอด" && <button className="table-action" onClick={() => open("invoiceReview", entry.lotId)}>ตรวจยอด</button>}
              {status === "รอชำระ" && <button className="table-action" onClick={() => open("invoicePayment", entry.lotId)}>ชำระเงิน</button>}
            </div>,
          ];
        })}
      />
    </div>
  );
}
