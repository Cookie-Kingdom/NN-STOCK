"use client";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Stat } from "@/components/atoms/Stat";
import { Caption } from "@/components/atoms/Text";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { Notice } from "@/components/molecules/Notice";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { PoLotCell } from "@/components/molecules/PoLotCell";
import { LotProgressChips } from "@/components/molecules/LotProgressChips";
import {
  packingListSummary,
  smokeOrderPrintRows,
} from "@/components/organisms/owner/documentRows";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentPrintButton } from "@/components/molecules/DocumentPrintButton";
import { lotIssueDate } from "@/components/organisms/shared/documentRows";
import {
  entries,
  n,
  poRemainingKg,
  shipments,
  shipmentShares,
  smokingInvoiceStatus,
  titles,
  type Database,
} from "@/lib/store";
import { fmt } from "@/lib/format";
import type { ModalKind } from "@/lib/nav";

const columns = [
  "เลขที่การส่ง",
  "วันที่เปิดชุด",
  "PO ซื้อที่ใช้",
  "Packing List",
  "น้ำหนักสั่งรม",
  "อัตราค่ารม",
  "Chef House รับ PO",
  "ใบวางบิล",
  "ความคืบหน้า",
  "การทำงาน",
];

export function SmokingPurchaseOrderView({
  db,
  open,
}: {
  db: Database;
  open: (kind: ModalKind, lotId?: string) => void;
}) {
  const runs = shipments(db);
  const waitingForChefHouse = runs.filter(
    (lot) =>
      entries(db, "smokeOrder", lot.id).length &&
      !entries(db, "smokeOrderAccept", lot.id).length,
  ).length;
  return (
    <div className="grid gap-6">
      <SectionHeading
        framed
        overline="CHEF_HOUSE SERVICE PO"
        title="ใบสั่ง PO โรงรมควัน"
        description="1 ชุดรมควัน = 1 PO รมควัน · ออก PO ได้ทุกเมื่อ ไม่ต้องรอ Packing List · เลือกชุดใหม่หรือชุดที่ Foodiva / Chef House เปิดไว้แล้ว แล้วระบุ PO ซื้อและน้ำหนักที่ใช้"
        actions={
          <Stat
            label="PO รอยืนยันจาก Chef House"
            value={`${waitingForChefHouse} ใบ`}
          />
        }
      />
      <ButtonRow>
        <Button variant="primary" onClick={() => open("smokeOrder", "")}>
          + {titles.smokeOrder}
        </Button>
      </ButtonRow>
      <DataTable
        title="รายการ PO โรงรมควัน"
        defaultSort={{ column: "วันที่เปิดชุด", desc: true }}
        columns={columns}
        rowKeys={runs.map((lot) => lot.id)}
        rows={runs.map((lot) => {
          const boxes = packingListSummary(db, lot.id);
          const order = entries(db, "smokeOrder", lot.id).at(-1);
          const accepted = entries(db, "smokeOrderAccept", lot.id).at(-1);
          const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
          const invoiceStatus = invoice
            ? smokingInvoiceStatus(db, invoice)
            : "";
          const shares = shipmentShares(db, lot);
          return [
            <PoLotCell key="lot" poId={lot.poId} lotId={lot.id} />,
            lotIssueDate(db, lot),
            <span key="po" className="grid gap-1">
              {!shares.length && "—"}
              {shares.map((share) => (
                <span key={share.lotId}>
                  <strong>{share.poId}</strong> × {fmt(share.requestedKg)} กก.
                  <Caption className="block">
                    คงเหลือ {fmt(poRemainingKg(db, share.lotId))} กก.
                  </Caption>
                </span>
              ))}
            </span>,
            boxes ? (
              <span key="packing" className="grid justify-items-start gap-1">
                {boxes}
                <Button
                  variant="table"
                  onClick={() => open("packingListView", lot.id)}
                >
                  ดู Packing List
                </Button>
              </span>
            ) : (
              <Badge tone="neutral" key="packing">
                ยังไม่มี Packing List
              </Badge>
            ),
            order ? `${fmt(n(order.values, "rawKg"))} กก.` : "ยังไม่ออก PO",
            order ? `฿${fmt(n(order.values, "serviceRate"))} / กก.` : "—",
            accepted ? (
              `${accepted.values.acceptedBy} · รับแล้ว`
            ) : order ? (
              <Badge tone="warning" key="accept">
                รอยืนยัน
              </Badge>
            ) : (
              "—"
            ),
            invoice
              ? `${invoice.values.invoiceNumber} · ${invoiceStatus}`
              : "ยังไม่มี",
            <LotProgressChips key="progress" db={db} lotId={lot.id} />,
            <ButtonRow key="actions">
              {order ? (
                <DocumentPrintButton
                  title="Smoke Service Purchase Order"
                  number={order.values.orderNumber}
                  rows={smokeOrderPrintRows(db, lot, order)}
                />
              ) : (
                <Button
                  variant="table"
                  onClick={() => open("smokeOrder", lot.id)}
                >
                  {titles.smokeOrder}
                </Button>
              )}
            </ButtonRow>,
          ];
        })}
      />
      {!runs.length && (
        <Notice>
          ยังไม่มีชุดรมควัน · กด “{titles.smokeOrder}” เพื่อเปิดชุดใหม่
        </Notice>
      )}
    </div>
  );
}
