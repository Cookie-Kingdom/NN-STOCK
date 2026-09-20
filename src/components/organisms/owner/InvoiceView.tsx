"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Stat } from "@/components/atoms/Stat";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { PanelHeading } from "@/components/molecules/PanelHeading";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  DocumentFilterBar,
  lotIssueDate,
  matchesDocumentFilter,
  type DocumentReferenceType,
} from "@/components/organisms/shared/documents";
import { InvoiceDownloadButton } from "@/components/organisms/shared/InvoiceDownloadButton";
import { uploadedAttachment } from "@/components/organisms/shared/referenceDocument";
import {
  entries,
  n,
  type Entry,
  smokingInvoiceReview,
  smokingInvoiceStatus,
  type Database,
  type Lot,
} from "@/lib/store";
import { fmt } from "@/lib/format";

const foodivaColumns = [
  "เลข Invoice",
  "วันที่ Invoice",
  "PO / Lot",
  "วันที่ PO / Lot",
  "น้ำหนัก",
  "ยอดรวม",
  "ผู้ยืนยัน",
  "ไฟล์",
];

const chefHouseColumns = [
  "เลข Invoice",
  "วันที่ Invoice",
  "PO / Lot",
  "วันที่ PO / Lot",
  "ยอดตาม PO",
  "รายละเอียด",
  "สถานะ",
  "ไฟล์",
  "การทำงาน",
];

export function InvoiceView({
  db,
  open,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
}) {
  const [referenceType, setReferenceType] =
    useState<DocumentReferenceType>("po");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const matches = (lot: Lot | undefined) =>
    matchesDocumentFilter(db, lot, referenceType, query, fromDate, toDate);
  const lotOf = (entry: Entry) => db.lots.find((lot) => lot.id === entry.lotId);
  const foodivaInvoices = entries(db, "foodivaConfirm").filter((entry) =>
    matches(lotOf(entry)),
  );
  const smokingInvoices = entries(db, "smokingInvoice").filter((entry) =>
    matches(lotOf(entry)),
  );
  const waitingForReview = smokingInvoices.filter(
    (entry) => smokingInvoiceStatus(db, entry) === "รอตรวจยอด",
  ).length;
  return (
    <div className="grid gap-6">
      <PanelHeading
        overline="INVOICE CENTER"
        title="ใบ Invoice"
        description="Owner เปิดและดาวน์โหลดไฟล์ Invoice ที่ Foodiva และ Chef_house แนบไว้ได้จากหน้านี้ โดยแยกจากเมนู PO"
        aside={
          <Stat label="Invoice รอตรวจยอด" value={`${waitingForReview} ใบ`} />
        }
      />
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
        defaultSort={{ column: "วันที่ Invoice", desc: true }}
        columns={foodivaColumns}
        rowKeys={foodivaInvoices.map((entry) => entry.id)}
        rows={foodivaInvoices.map((entry) => {
          const lot = lotOf(entry);
          return [
            entry.values.invoiceNo,
            entry.values.invoiceDate,
            `${lot?.poId || "-"} / ${entry.lotId}`,
            lot ? lotIssueDate(db, lot) : "—",
            `${fmt(n(entry.values, "confirmedKg"))} กก.`,
            `฿${fmt(n(entry.values, "invoiceAmount"))}`,
            entry.values.confirmedBy || "—",
            /* The file, not the row: re-saving an invoice writes a new entry that
               keeps the file name but not the bytes, so the download falls back to
               the newest version of this document that still carries the upload. */
            <InvoiceDownloadButton
              key={entry.id}
              name={entry.values.attachment}
              {...uploadedAttachment(db, "foodivaConfirm", entry.lotId)}
            />,
          ];
        })}
      />
      <DataTable
        title="Invoice Chef_house"
        defaultSort={{ column: "วันที่ Invoice", desc: true }}
        columns={chefHouseColumns}
        rowKeys={smokingInvoices.map((entry) => entry.id)}
        rows={smokingInvoices.map((entry) => {
          const lot = lotOf(entry);
          const status = smokingInvoiceStatus(db, entry);
          const reviewNote = smokingInvoiceReview(
            db,
            entry,
          )?.values.comment?.trim();
          return [
            entry.values.invoiceNumber,
            entry.values.invoiceDate,
            `${lot?.poId || "-"} / ${entry.lotId}`,
            lot ? lotIssueDate(db, lot) : "—",
            `฿${fmt(n(entry.values, "netPayable"))}`,
            entry.values.invoiceDetail || "—",
            reviewNote ? `${status} · หมายเหตุ: ${reviewNote}` : status,
            <InvoiceDownloadButton
              key={`file-${entry.id}`}
              name={entry.values.attachment}
              {...uploadedAttachment(db, "smokingInvoice", entry.lotId)}
            />,
            <ButtonRow key={`action-${entry.id}`}>
              {status === "รอตรวจยอด" && (
                <Button
                  variant="table"
                  onClick={() => open("invoiceReview", entry.lotId)}
                >
                  ตรวจยอด
                </Button>
              )}
              {status === "รอชำระ" && (
                <Button
                  variant="table"
                  onClick={() => open("invoicePayment", entry.lotId)}
                >
                  ชำระเงิน
                </Button>
              )}
            </ButtonRow>,
          ];
        })}
      />
    </div>
  );
}
