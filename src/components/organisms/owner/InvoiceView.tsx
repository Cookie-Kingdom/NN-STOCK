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
import {
  useTableSort,
  type SortOption,
} from "@/components/organisms/shared/useTableSort";
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
  // Both invoice tables sort the same way; `invoiceNo`/`invoiceNumber` differ per kind.
  const invoiceSort = (invoiceNumber: (entry: Entry) => string) =>
    [
      {
        label: "วันที่ Invoice (ล่าสุดก่อน)",
        by: (entry) => entry.values.invoiceDate || entry.date,
        desc: true,
      },
      {
        label: "วันที่ Invoice (เก่าสุดก่อน)",
        by: (entry) => entry.values.invoiceDate || entry.date,
      },
      {
        label: "วันที่ออก PO (ล่าสุดก่อน)",
        by: (entry) => {
          const lot = lotOf(entry);
          return lot ? lotIssueDate(db, lot) : "";
        },
        desc: true,
      },
      { label: "เลข Invoice", by: invoiceNumber },
      { label: "เลข PO", by: (entry) => lotOf(entry)?.poId || "" },
      { label: "Lot", by: (entry) => entry.lotId || "" },
    ] satisfies SortOption<Entry>[];
  const [foodivaInvoices, foodivaSort] = useTableSort(
    entries(db, "foodivaConfirm").filter((entry) => matches(lotOf(entry))),
    invoiceSort((entry) => entry.values.invoiceNo || ""),
  );
  const [smokingInvoices, smokingSort] = useTableSort(
    entries(db, "smokingInvoice").filter((entry) => matches(lotOf(entry))),
    invoiceSort((entry) => entry.values.invoiceNumber || ""),
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
        action={foodivaSort}
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
            <InvoiceDownloadButton
              key={entry.id}
              name={entry.values.attachment}
              data={entry.values.attachmentData}
              storageKey={entry.values.attachmentStorageKey}
            />,
          ];
        })}
      />
      <DataTable
        title="Invoice Chef_house"
        action={smokingSort}
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
              data={entry.values.attachmentData}
              storageKey={entry.values.attachmentStorageKey}
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
