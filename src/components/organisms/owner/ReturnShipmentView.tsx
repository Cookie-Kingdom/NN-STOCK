"use client";

import { Button } from "@/components/atoms/Button";
import { Notice } from "@/components/molecules/Notice";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { shipmentPoLabels } from "@/components/organisms/owner/documentRows";
import { returnReadyLots } from "@/components/organisms/owner/useOwnerAlerts";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { entries, produced, producedBags, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

const columns = [
  "เลขที่การส่ง",
  "PO ซื้อ (กก.)",
  "ผลผลิตพร้อมส่งกลับ",
  "รถเที่ยวขาไป",
  "การทำงาน",
];

/** The Owner books the truck home once Chef House closes the lot. The dialog behind the
 *  button is the same `return` form the shipment manifest opens, so the entry is still
 *  written one way only. */
export function ReturnShipmentView({
  db,
  open,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
}) {
  const readyToReturn = returnReadyLots(db);
  return (
    <>
      <SectionHeading
        title="สร้างใบขนส่งขากลับ"
        description="Chef House ปิด Lot แล้ว · Owner เรียกรถขากลับ Chef House → Foodiva แล้วรอ Foodiva รับเข้าตู้"
      />
      <DataTable
        title="Lot ที่รอเรียกรถขากลับ"
        columns={columns}
        rowKeys={readyToReturn.map((lot) => lot.id)}
        rows={readyToReturn.map((lot) => {
          const outbound = entries(db, "dispatch", lot.id).at(-1);
          return [
            <strong key="shipment">{lot.poId}</strong>,
            <span key="lines">
              {shipmentPoLabels(db, lot).map((label) => (
                <span key={label} className="block">
                  {label}
                </span>
              ))}
            </span>,
            `${fmt(produced(db, lot.id))} กก. · ${producedBags(db, lot.id)} กล่องรมควัน`,
            outbound
              ? `${outbound.values.plate || "ยังไม่ระบุรถ"} · ${lot.values.trip === "ไปกลับ" ? "ไปกลับ (ข้อมูลรถเติมให้)" : "เที่ยวเดียว"}`
              : "ไม่มีข้อมูลรถขาไป",
            <Button
              variant="table"
              key={lot.id}
              onClick={() => open("return", lot.id)}
            >
              สร้างใบขนส่งขากลับ · {fmt(produced(db, lot.id))} กก.
            </Button>,
          ];
        })}
      />
      {!readyToReturn.length && (
        <Notice tone="success">ไม่มี Lot รอเรียกรถขากลับในขณะนี้</Notice>
      )}
    </>
  );
}
