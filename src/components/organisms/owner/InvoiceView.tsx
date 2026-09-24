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
import {
  InvoiceDownloadButton,
  SlipList,
} from "@/components/organisms/shared/InvoiceDownloadButton";
import { uploadedAttachment } from "@/components/organisms/shared/referenceDocument";
import {
  entries,
  n,
  ownerPendingInvoices,
  type Entry,
  smokingInvoiceReview,
  smokingInvoiceStatus,
  type Database,
  type Lot,
  type EntryKind,
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
  "สถานะ",
  "ไฟล์",
  "สลิป",
  "การทำงาน",
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
  "สลิป",
  "การทำงาน",
];

export function InvoiceView({
  db,
  open,
}: {
  db: Database;
  open: (kind: EntryKind, lotId?: string) => void;
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
  // Same set as the sidebar Invoice badge, over every invoice (not just the filtered rows).
  const pending = ownerPendingInvoices(db);
  const toPay = pending.unpaidMeatLots.length + pending.toPay.length;
  return (
    <div className="grid gap-6">
      <PanelHeading
        overline="INVOICE CENTER"
        title="ใบ Invoice"
        description="Owner เปิดและดาวน์โหลดไฟล์ Invoice ที่ Foodiva และ Chef House แนบไว้ได้จากหน้านี้ โดยแยกจากเมนู PO"
        aside={
          <Stat
            label="Invoice รอดำเนินการ"
            value={`${pending.total} ใบ`}
            title={`รอตรวจ ${pending.toReview.length} · รอชำระ ${toPay}`}
          />
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
          const payment = entries(db, "meatPayment", entry.lotId).at(-1);
          // Re-saved invoices leave older rows behind: only the newest one is payable.
          const latest =
            entries(db, "foodivaConfirm", entry.lotId).at(-1)?.id === entry.id;
          return [
            entry.values.invoiceNo,
            entry.values.invoiceDate,
            `${lot?.poId || "-"} / ${entry.lotId}`,
            lot ? lotIssueDate(db, lot) : "—",
            `${fmt(n(entry.values, "confirmedKg"))} กก.`,
            `฿${fmt(n(entry.values, "invoiceAmount"))}`,
            entry.values.confirmedBy || "—",
            payment ? "ชำระแล้ว" : "รอชำระ",
            /* The file, not the row: re-saving an invoice writes a new entry that
               keeps the file name but not the bytes, so the download falls back to
               the newest version of this document that still carries the upload. */
            <InvoiceDownloadButton
              key={entry.id}
              name={entry.values.attachment}
              {...uploadedAttachment(db, "foodivaConfirm", entry.lotId)}
            />,
            payment ? (
              <SlipList
                key={`slips-${entry.id}`}
                value={payment.values.slips}
              />
            ) : (
              "—"
            ),
            <ButtonRow key={`action-${entry.id}`}>
              {!payment && latest && (
                <Button
                  variant="table"
                  onClick={() => open("meatPayment", entry.lotId)}
                >
                  ชำระเงิน
                </Button>
              )}
            </ButtonRow>,
          ];
        })}
      />
      <DataTable
        title="Invoice Chef House"
        defaultSort={{ column: "วันที่ Invoice", desc: true }}
        columns={chefHouseColumns}
        rowKeys={smokingInvoices.map((entry) => entry.id)}
        rows={smokingInvoices.map((entry) => {
          const lot = lotOf(entry);
          const status = smokingInvoiceStatus(db, entry);
          const payment = entries(db, "invoicePayment", entry.lotId).find(
            (item) => item.values.invoiceId === entry.id,
          );
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
            payment ? (
              <SlipList
                key={`slips-${entry.id}`}
                value={payment.values.slips}
              />
            ) : (
              "—"
            ),
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
