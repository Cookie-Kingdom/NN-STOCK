"use client";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Stat } from "@/components/atoms/Stat";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { PanelHeading } from "@/components/molecules/PanelHeading";
import { shipmentPoLabels } from "@/components/organisms/owner/documentRows";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import { SlipList } from "@/components/organisms/shared/InvoiceDownloadButton";
import {
  lotIssueDate,
  purchaseOrderRows,
} from "@/components/organisms/shared/documents";
import {
  entries,
  n,
  poRemainingKg,
  producedBags,
  purchaseLots,
  rawAtFoodiva,
  readyForChefHouse,
  latestPackingList,
  ownerWasteOutstanding,
  shipments,
  type Database,
  type EntryKind,
  STAGE,
} from "@/lib/store";
import { fmt } from "@/lib/format";

export function FoodivaView({
  db,
  open,
}: {
  db: Database;
  open: (kind: EntryKind, lotId?: string) => void;
}) {
  const pos = purchaseLots(db);
  // Stage 1 waits for the transport document; after it, the Packing List stays
  // editable here until the Owner issues the smoke PO from it.
  const requests = shipments(db).filter(
    (lot) =>
      lot.stage === STAGE.dispatch ||
      (latestPackingList(db, lot.id) &&
        !entries(db, "smokeOrder", lot.id).length),
  );
  const holding = db.lots.reduce((sum, lot) => sum + rawAtFoodiva(db, lot), 0);
  const reservedForContent = db.lots.reduce(
    (sum, lot) => sum + ownerWasteOutstanding(db, lot.id),
    0,
  );
  // Stage 7 = on the return truck until the Owner counts it into central stock; a received
  // row stays so Foodiva sees its weigh-in against what Chef House sent.
  const returnLeg = shipments(db).filter((lot) => lot.stage === STAGE.central);
  return (
    <div className="grid gap-6">
      <PanelHeading
        title="งาน Foodiva"
        description="รับ PO ออก Invoice แล้วระบุน้ำหนักพร้อมส่งเชียงใหม่ และเนื้อส่วนที่เหลือรอ Owner รับ (Waste)"
        aside={
          <>
            <Stat
              label="เนื้อดิบคงเหลือ Foodiva"
              value={`${fmt(holding)} กก.`}
            />
            <Stat
              label="เนื้อส่วนที่เหลือรอ Owner รับ (Waste)"
              value={`${fmt(reservedForContent)} กก.`}
            />
          </>
        }
      />
      <DataTable
        title="Request เข้า"
        columns={[
          "เลขที่การส่ง",
          "วันที่ Request",
          "PO ซื้อ (กก.)",
          "รวม",
          "การทำงาน",
        ]}
        emptyText="ไม่มี Request ที่รอทำใบขนส่ง"
        rowKeys={requests.map((lot) => lot.id)}
        rows={requests.map((lot) => [
          <strong key="shipment">{lot.poId}</strong>,
          entries(db, "shipmentRequest", lot.id).at(-1)?.date || "—",
          <span key="lines">
            {shipmentPoLabels(db, lot).map((label) => (
              <span key={label} className="block">
                {label}
              </span>
            ))}
          </span>,
          `${fmt(n(lot.values, "requestedKg"))} กก.`,
          lot.stage === STAGE.dispatch ? (
            <Button
              key="dispatch"
              variant="table"
              onClick={() => open("dispatch", lot.id)}
            >
              ทำใบขนส่ง
            </Button>
          ) : (
            <ButtonRow key="packing">
              <Badge tone="success">ทำใบขนส่งแล้ว · รอ PO รมควัน</Badge>
              <Button
                variant="table"
                onClick={() => open("packingList", lot.id)}
              >
                แก้ไข Packing List
              </Button>
            </ButtonRow>
          ),
        ])}
      />
      <DataTable
        title="PO เนื้อที่ต้องออก Invoice"
        defaultSort={{ column: "วันที่ออก PO", desc: true }}
        columns={[
          "เลข PO",
          "Lot",
          "วันที่ออก PO",
          "ยอดสั่ง",
          "Invoice เนื้อ",
          "พร้อมส่งเชียงใหม่",
          "เก็บไว้ให้ Owner คงเหลือ",
          "คงเหลือ Foodiva",
          "คงเหลือส่ง Chef House",
          "การชำระเงิน",
          "การทำงาน",
        ]}
        rowKeys={pos.map((lot) => lot.id)}
        rows={pos.map((lot) => {
          const confirm = entries(db, "foodivaConfirm", lot.id).at(-1);
          // The Owner's payment of this invoice, with its slip as evidence for both sides.
          const payment = entries(db, "meatPayment", lot.id).at(-1);
          return [
            <strong key={lot.poId}>{lot.poId}</strong>,
            lot.id,
            lotIssueDate(db, lot),
            `${fmt(n(lot.values, "orderedKg"))} กก.`,
            confirm ? (
              `${confirm.values.invoiceNo} · ${fmt(n(confirm.values, "confirmedKg"))} กก.`
            ) : (
              <Badge tone="danger" key="pending">
                รอออก Invoice
              </Badge>
            ),
            confirm ? `${fmt(readyForChefHouse(db, lot.id))} กก.` : "—",
            confirm ? `${fmt(ownerWasteOutstanding(db, lot.id))} กก.` : "—",
            `${fmt(rawAtFoodiva(db, lot))} กก.`,
            confirm
              ? `${fmt(poRemainingKg(db, lot.id))} กก.`
              : "ต้องออก Invoice",
            payment ? (
              <span key="payment" className="grid justify-items-end gap-1.5">
                <Badge tone="success">
                  {`จ่ายแล้ว · ${payment.values.paymentDate || payment.date} · ฿${fmt(n(payment.values, "paidAmount"))}`}
                </Badge>
                <SlipList value={payment.values.slips} />
              </span>
            ) : confirm ? (
              <Badge key="payment" tone="warning">
                รอ Owner ชำระ
              </Badge>
            ) : (
              "—"
            ),
            !confirm ? (
              <ButtonRow key="confirm-actions">
                <DocumentPrintButton
                  title="Purchase Order"
                  number={lot.poId}
                  rows={purchaseOrderRows(lot, db)}
                  label="ดู PO / PDF"
                  preview
                />
                <Button
                  variant="table"
                  onClick={() => open("foodivaConfirm", lot.id)}
                >
                  ออกและอัปโหลด Invoice
                </Button>
              </ButtonRow>
            ) : (
              <ButtonRow key="confirmed-actions">
                <DocumentPrintButton
                  title="Purchase Order"
                  number={lot.poId}
                  rows={purchaseOrderRows(lot, db)}
                  label="ดู PO / PDF"
                  preview
                />
                <Badge tone="success">แนบ Invoice แล้ว</Badge>
                <Button
                  variant="table"
                  onClick={() => open("foodivaConfirm", lot.id)}
                >
                  แก้ไข / อัปโหลดใหม่
                </Button>
              </ButtonRow>
            ),
          ];
        })}
      />
      <DataTable
        title="เนื้อรมควันขากลับ · รับเข้าตู้ Foodiva"
        columns={[
          "เลขที่การส่ง",
          "ใบขนส่งขากลับ",
          "Chef House ส่ง",
          "Foodiva รับจริง",
          "สถานะ",
          "การทำงาน",
        ]}
        emptyText="ไม่มีเนื้อรมควันบนรถขากลับ"
        rowKeys={returnLeg.map((lot) => lot.id)}
        rows={returnLeg.map((lot) => {
          const trip = entries(db, "return", lot.id).at(-1);
          const got = entries(db, "foodivaReturnReceive", lot.id).at(-1);
          const sentKg = n(trip?.values || {}, "returnKg");
          const gap = got ? n(got.values, "receivedKg") - sentKg : 0;
          return [
            <strong key="shipment">{lot.poId}</strong>,
            `${trip?.values.transferNumber || "-"} · ${trip?.values.returnDate || "-"} · ${trip?.values.plate || "-"}`,
            `${producedBags(db, lot.id)} กล่องรมควัน · ${fmt(sentKg)} กก.`,
            got
              ? `${got.values.receivedBags} กล่องรมควัน · ${fmt(n(got.values, "receivedKg"))} กก.`
              : "รอชั่งรับ",
            got ? (
              <Badge
                key="status"
                tone={Math.abs(gap) > 0.001 ? "danger" : "success"}
              >
                {`รับแล้ว · ส่วนต่าง ${fmt(Math.abs(gap))} กก.`}
              </Badge>
            ) : (
              <Badge tone="danger" key="status">
                ต้องรับเข้า
              </Badge>
            ),
            got ? (
              "รอ Owner รับเข้าสต๊อกกลาง"
            ) : (
              <Button
                key="receive"
                variant="table"
                onClick={() => open("foodivaReturnReceive", lot.id)}
              >
                ยืนยันรับเข้าตู้
              </Button>
            ),
          ];
        })}
      />
    </div>
  );
}
