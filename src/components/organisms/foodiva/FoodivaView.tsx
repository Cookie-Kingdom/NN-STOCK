"use client";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Stat } from "@/components/atoms/Stat";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { PanelHeading } from "@/components/molecules/PanelHeading";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import {
  lotIssueDate,
  purchaseOrderRows,
} from "@/components/organisms/shared/documents";
import {
  entries,
  n,
  poRemainingKg,
  produced,
  purchaseLots,
  rawAtFoodiva,
  readyForChefHouse,
  latestPackingList,
  ownerWasteOutstanding,
  shipmentLines,
  shipments,
  type Database,
} from "@/lib/store";
import { fmt } from "@/lib/format";

export function FoodivaView({
  db,
  open,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
}) {
  const pos = purchaseLots(db);
  // Stage 1 waits for the transport document; after it, the Packing List stays
  // editable here until the Owner issues the smoke PO from it.
  const requests = shipments(db).filter(
    (lot) =>
      lot.stage === 1 ||
      (latestPackingList(db, lot.id) &&
        !entries(db, "smokeOrder", lot.id).length),
  );
  const holding = db.lots.reduce((sum, lot) => sum + rawAtFoodiva(db, lot), 0);
  const reservedForContent = db.lots.reduce(
    (sum, lot) => sum + ownerWasteOutstanding(db, lot.id),
    0,
  );
  const returnWaiting = db.lots.filter(
    (lot) =>
      lot.stage === 7 && !entries(db, "foodivaReturnReceive", lot.id).length,
  );
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
            {shipmentLines(lot).map((line) => (
              <span key={line.lotId} className="block">
                {`${db.lots.find((po) => po.id === line.lotId)?.poId || line.lotId} × ${fmt(line.kg)} กก.`}
              </span>
            ))}
          </span>,
          `${fmt(n(lot.values, "requestedKg"))} กก.`,
          lot.stage === 1 ? (
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
          "รอ Owner รับ (Waste)",
          "คงเหลือ Foodiva",
          "คงเหลือส่ง Chef House",
          "การทำงาน",
        ]}
        rowKeys={pos.map((lot) => lot.id)}
        rows={pos.map((lot) => {
          const confirm = entries(db, "foodivaConfirm", lot.id).at(-1);
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
        title="เนื้อรมควันรอ Foodiva รับเข้าตู้"
        columns={[
          "PO / Lot",
          "ใบขนส่ง",
          "น้ำหนักหลังรม",
          "รับจริง",
          "สถานะ",
          "การทำงาน",
        ]}
        rowKeys={returnWaiting.map((lot) => lot.id)}
        rows={returnWaiting.map((lot) => {
          const trip = entries(db, "return", lot.id).at(-1);
          return [
            `${lot.poId} / ${lot.id}`,
            `${trip?.values.returnDate || "-"} · ${trip?.values.plate || "-"}`,
            `${fmt(produced(db, lot.id))} กก.`,
            "รอชั่งรับ",
            <Badge tone="danger" key="status">
              ต้องรับเข้า
            </Badge>,
            <Button
              key="receive"
              variant="table"
              onClick={() => open("foodivaReturnReceive", lot.id)}
            >
              ยืนยันรับเข้าตู้
            </Button>,
          ];
        })}
      />
    </div>
  );
}
