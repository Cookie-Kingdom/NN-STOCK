"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Stat } from "@/components/atoms/Stat";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentFilterBar } from "@/components/organisms/shared/DocumentFilterBar";
import {
  lotIssueDate,
  matchesDocumentFilter,
  type DocumentReferenceType,
} from "@/components/organisms/shared/documentRows";
import {
  AttachmentButton,
  SlipList,
} from "@/components/molecules/AttachmentButton";
import { uploadedAttachment } from "@/components/organisms/shared/referenceDocument";
import {
  entries,
  n,
  ownerPendingInvoices,
  purchaseLots,
  shipments,
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
  // PO-07 / SVC-05: paying never waits for the invoice. A purchase PO with no Foodiva
  // invoice and a batch with no smoking invoice still get a row and a pay button.
  const posWithoutInvoice = purchaseLots(db).filter(
    (lot) => !entries(db, "foodivaConfirm", lot.id).length && matches(lot),
  );
  const batchesWithoutInvoice = shipments(db).filter(
    (lot) => !entries(db, "smokingInvoice", lot.id).length && matches(lot),
  );
  const noInvoice = (key: string) => (
    <Badge key={key} tone="warning">
      ยังไม่มี Invoice
    </Badge>
  );
  const slips = (key: string, payment: Entry | undefined) =>
    payment ? <SlipList key={key} value={payment.values.slips} /> : "—";
  // Same set as the sidebar Invoice badge, over every invoice (not just the filtered rows).
  const pending = ownerPendingInvoices(db);
  const toPay = pending.unpaidMeatLots.length + pending.toPay.length;
  return (
    <div className="grid gap-6">
      <SectionHeading
        framed
        overline="INVOICE CENTER"
        title="ใบ Invoice"
        description="Owner เปิดและดาวน์โหลดไฟล์ Invoice ที่ Foodiva และ Chef House แนบไว้ได้จากหน้านี้ โดยแยกจากเมนู PO"
        actions={
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
        rowKeys={[
          ...foodivaInvoices.map((entry) => entry.id),
          ...posWithoutInvoice.map((lot) => lot.id),
        ]}
        rows={[
          ...foodivaInvoices.map((entry) => {
            const lot = lotOf(entry);
            const payment = entries(db, "meatPayment", entry.lotId).at(-1);
            // Re-saved invoices leave older rows behind: only the newest one is payable.
            const latest =
              entries(db, "foodivaConfirm", entry.lotId).at(-1)?.id ===
              entry.id;
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
              <AttachmentButton
                action="download"
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
          }),
          ...posWithoutInvoice.map((lot) => {
            const payment = entries(db, "meatPayment", lot.id).at(-1);
            return [
              noInvoice(`invoice-${lot.id}`),
              "—",
              `${lot.poId} / ${lot.id}`,
              lotIssueDate(db, lot),
              `สั่ง ${fmt(n(lot.values, "orderedKg"))} กก.`,
              "—",
              "—",
              payment ? "ชำระแล้ว" : "รอชำระ",
              "—",
              slips(`slips-${lot.id}`, payment),
              <ButtonRow key={`action-${lot.id}`}>
                {!payment && (
                  <Button
                    variant="table"
                    onClick={() => open("meatPayment", lot.id)}
                  >
                    ชำระเงิน
                  </Button>
                )}
              </ButtonRow>,
            ];
          }),
        ]}
      />
      <DataTable
        title="Invoice Chef House"
        defaultSort={{ column: "วันที่ Invoice", desc: true }}
        columns={chefHouseColumns}
        rowKeys={[
          ...smokingInvoices.map((entry) => entry.id),
          ...batchesWithoutInvoice.map((lot) => lot.id),
        ]}
        rows={[
          ...smokingInvoices.map((entry) => {
            const lot = lotOf(entry);
            const status = smokingInvoiceStatus(db, entry);
            const payment = entries(db, "invoicePayment", entry.lotId).find(
              (item) => item.values.invoiceId === entry.id,
            );
            // Re-submitted invoices leave older rows behind: only the newest one is payable.
            // A payment made before any invoice came already settles the batch.
            const latest =
              entries(db, "smokingInvoice", entry.lotId).at(-1)?.id ===
                entry.id &&
              !entries(db, "invoicePayment", entry.lotId).some(
                (item) => !item.values.invoiceId,
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
              <AttachmentButton
                action="download"
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
                {latest && status !== "ชำระแล้ว" && (
                  <Button
                    variant="table"
                    onClick={() => open("invoicePayment", entry.lotId)}
                  >
                    ชำระเงิน
                  </Button>
                )}
              </ButtonRow>,
            ];
          }),
          ...batchesWithoutInvoice.map((lot) => {
            const payment = entries(db, "invoicePayment", lot.id).at(-1);
            return [
              noInvoice(`invoice-${lot.id}`),
              "—",
              `${lot.poId} / ${lot.id}`,
              lotIssueDate(db, lot),
              "—",
              "—",
              payment ? "ชำระแล้ว" : "รอชำระ",
              "—",
              slips(`slips-${lot.id}`, payment),
              <ButtonRow key={`action-${lot.id}`}>
                {!payment && (
                  <Button
                    variant="table"
                    onClick={() => open("invoicePayment", lot.id)}
                  >
                    ชำระเงิน
                  </Button>
                )}
              </ButtonRow>,
            ];
          }),
        ]}
      />
    </div>
  );
}
