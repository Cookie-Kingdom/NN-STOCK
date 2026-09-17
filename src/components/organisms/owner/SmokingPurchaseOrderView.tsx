"use client";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Stat } from "@/components/atoms/Stat";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { Notice } from "@/components/molecules/Notice";
import { PanelHeading } from "@/components/molecules/PanelHeading";
import { PoLotCell } from "@/components/molecules/PoLotCell";
import { smokeOrderPrintRows } from "@/components/organisms/owner/documentRows";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import {
  entries,
  n,
  readyForChefHouse,
  smokingInvoiceStatus,
  type Database,
} from "@/lib/store";
import { fmt } from "@/lib/format";

const columns = [
  "PO เนื้อ / Lot",
  "Invoice Foodiva",
  "น้ำหนักสั่งรม",
  "อัตราค่ารม",
  "Chef_house รับ PO",
  "ใบวางบิล",
  "การทำงาน",
];

export function SmokingPurchaseOrderView({
  db,
  open,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
}) {
  const eligibleLots = db.lots.filter(
    (lot) => entries(db, "foodivaConfirm", lot.id).length > 0,
  );
  const waitingForChefHouse = eligibleLots.filter(
    (lot) =>
      entries(db, "smokeOrder", lot.id).length &&
      !entries(db, "smokeOrderAccept", lot.id).length,
  ).length;
  return (
    <div className="grid gap-6">
      <PanelHeading
        overline="CHEF_HOUSE SERVICE PO"
        title="ใบสั่ง PO โรงรมควัน"
        description="Owner ออก PO รมควันหลัง Foodiva ออก Invoice แล้ว Chef_house ต้องกดยืนยันรับ PO และ Submit ใบวางบิลก่อน Owner เรียกรถไปรับเนื้อ"
        aside={
          <Stat
            label="PO รอยืนยันจาก Chef_house"
            value={`${waitingForChefHouse} ใบ`}
          />
        }
      />
      <DataTable
        title="รายการ PO โรงรมควัน"
        columns={columns}
        rowKeys={eligibleLots.map((lot) => lot.id)}
        rows={eligibleLots.map((lot) => {
          const foodivaInvoice = entries(db, "foodivaConfirm", lot.id).at(-1);
          const order = entries(db, "smokeOrder", lot.id).at(-1);
          const accepted = entries(db, "smokeOrderAccept", lot.id).at(-1);
          const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
          const invoiceStatus = invoice
            ? smokingInvoiceStatus(db, invoice)
            : "รอ Chef_house Submit";
          return [
            <PoLotCell key="lot" poId={lot.poId} lotId={lot.id} />,
            `${foodivaInvoice?.values.invoiceNo || "-"} · พร้อมส่งเชียงใหม่ ${fmt(readyForChefHouse(db, lot.id))} กก.`,
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
              : "รอ Chef_house",
            <ButtonRow key="actions">
              {!order ? (
                <Button
                  variant="table"
                  onClick={() => open("smokeOrder", lot.id)}
                >
                  ออก PO รมควันเนื้อ
                </Button>
              ) : (
                <DocumentPrintButton
                  title="Smoke Service Purchase Order"
                  number={order.values.orderNumber}
                  rows={smokeOrderPrintRows(db, lot, order, foodivaInvoice)}
                />
              )}
            </ButtonRow>,
          ];
        })}
      />
      {!eligibleLots.length && (
        <Notice>ยังไม่มี PO เนื้อที่ Foodiva ออก Invoice แล้ว</Notice>
      )}
    </div>
  );
}
