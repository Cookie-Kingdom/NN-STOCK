"use client";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Stat } from "@/components/atoms/Stat";
import { Caption } from "@/components/atoms/Text";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { Notice } from "@/components/molecules/Notice";
import { PanelHeading } from "@/components/molecules/PanelHeading";
import { PoLotCell } from "@/components/molecules/PoLotCell";
import {
  packingListSummary,
  smokeOrderPrintRows,
} from "@/components/organisms/owner/documentRows";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import { lotIssueDate } from "@/components/organisms/shared/documentRows";
import {
  entries,
  n,
  poRemainingKg,
  shipments,
  shipmentShares,
  smokingInvoiceStatus,
  type Database,
} from "@/lib/store";
import { fmt } from "@/lib/format";
import type { ModalKind } from "@/lib/nav";

const columns = [
  "เลขที่การส่ง",
  "วันที่ Request",
  "PO ซื้อที่ใช้",
  "Packing List",
  "น้ำหนักสั่งรม",
  "อัตราค่ารม",
  "Chef House รับ PO",
  "ใบวางบิล",
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
      <PanelHeading
        overline="CHEF_HOUSE SERVICE PO"
        title="ใบสั่ง PO โรงรมควัน"
        description="1 การส่ง = 1 PO รมควัน · ยอดสั่งรมมาจาก Packing List ของ Foodiva จึงออก PO ได้เมื่อ Packing List มาถึงแล้ว จากนั้น Chef House กดยืนยันรับ PO"
        aside={
          <Stat
            label="PO รอยืนยันจาก Chef House"
            value={`${waitingForChefHouse} ใบ`}
          />
        }
      />
      <DataTable
        title="รายการ PO โรงรมควัน"
        defaultSort={{ column: "วันที่ Request", desc: true }}
        columns={columns}
        rowKeys={runs.map((lot) => lot.id)}
        rows={runs.map((lot) => {
          const boxes = packingListSummary(db, lot.id);
          const order = entries(db, "smokeOrder", lot.id).at(-1);
          const accepted = entries(db, "smokeOrderAccept", lot.id).at(-1);
          const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
          const invoiceStatus = invoice
            ? smokingInvoiceStatus(db, invoice)
            : "รอ Chef House Submit";
          return [
            <PoLotCell key="lot" poId={lot.poId} lotId={lot.id} />,
            lotIssueDate(db, lot),
            <span key="po" className="grid gap-1">
              {shipmentShares(db, lot).map((share) => (
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
              <Badge tone="warning" key="packing">
                รอ Packing List
              </Badge>
            ),
            order ? `${fmt(n(order.values, "rawKg"))} กก.` : "ยังไม่ออก PO",
            order ? `฿${fmt(n(order.values, "serviceRate"))} / กก.` : "—",
            accepted ? (
              `${accepted.values.acceptedBy} · รับแล้ว`
            ) : order ? (
              <Badge tone="danger" key="accept">
                รอยืนยัน
              </Badge>
            ) : (
              "—"
            ),
            invoice
              ? `${invoice.values.invoiceNumber} · ${invoiceStatus}`
              : "รอ Chef House",
            <ButtonRow key="actions">
              {order ? (
                <DocumentPrintButton
                  title="Smoke Service Purchase Order"
                  number={order.values.orderNumber}
                  rows={smokeOrderPrintRows(db, lot, order)}
                />
              ) : (
                <span className="grid justify-items-start gap-1">
                  <Button
                    variant="table"
                    disabled={!boxes}
                    onClick={() => open("smokeOrder", lot.id)}
                  >
                    ออก PO รมควันเนื้อ
                  </Button>
                  {!boxes && <Caption>รอ Foodiva ทำ Packing List</Caption>}
                </span>
              )}
            </ButtonRow>,
          ];
        })}
      />
      {!runs.length && (
        <Notice>ยังไม่มีการส่งเนื้อไป Chef House · สร้าง Request ก่อน</Notice>
      )}
    </div>
  );
}
