"use client";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Stat } from "@/components/atoms/Stat";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { PanelHeading } from "@/components/molecules/PanelHeading";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import { purchaseOrderRows } from "@/components/organisms/shared/documents";
import {
  entries,
  n,
  produced,
  rawAtFoodiva,
  readyForChefHouse,
  reservedForOwnerContent,
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
  const holding = db.lots.reduce((sum, lot) => sum + rawAtFoodiva(db, lot), 0);
  const reservedForContent = db.lots.reduce(
    (sum, lot) => sum + reservedForOwnerContent(db, lot.id),
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
        title="PO เนื้อที่ต้องออก Invoice"
        columns={[
          "เลข PO",
          "Lot",
          "ยอดสั่ง",
          "Invoice เนื้อ",
          "พร้อมส่งเชียงใหม่",
          "รอ Owner รับ (Waste)",
          "คงเหลือ Foodiva",
          "สถานะ",
          "การทำงาน",
        ]}
        rowKeys={db.lots.map((lot) => lot.id)}
        rows={db.lots.map((lot) => {
          const confirm = entries(db, "foodivaConfirm", lot.id).at(-1);
          return [
            <strong key={lot.poId}>{lot.poId}</strong>,
            lot.id,
            `${fmt(n(lot.values, "orderedKg"))} กก.`,
            confirm ? (
              `${confirm.values.invoiceNo} · ${fmt(n(confirm.values, "confirmedKg"))} กก.`
            ) : (
              <Badge tone="danger" key="pending">
                รอออก Invoice
              </Badge>
            ),
            confirm ? `${fmt(readyForChefHouse(db, lot.id))} กก.` : "—",
            confirm ? `${fmt(reservedForOwnerContent(db, lot.id))} กก.` : "—",
            `${fmt(rawAtFoodiva(db, lot))} กก.`,
            !confirm
              ? "ต้องออก Invoice"
              : lot.stage === 1
                ? "รอ Owner เรียกรถ"
                : lot.stage < 7
                  ? "ส่งให้ Chef_house แล้ว"
                  : "รอรับเนื้อรมควัน",
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
