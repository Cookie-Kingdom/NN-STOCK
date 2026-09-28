"use client";

import { Button } from "@/components/atoms/Button";
import { Notice } from "@/components/molecules/Notice";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { shipmentPoLabels } from "@/components/organisms/owner/documentRows";
import { LotProgressChips } from "@/components/organisms/owner/LotProgressChips";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  entries,
  produced,
  producedBags,
  shipments,
  type Database,
  type EntryKind,
} from "@/lib/store";
import { fmt } from "@/lib/format";

const columns = [
  "เลขที่การส่ง",
  "PO ซื้อ (กก.)",
  "ผลผลิตพร้อมส่งกลับ",
  "รถเที่ยวขาไป",
  "ขั้นที่ยังขาด",
  "การทำงาน",
];

/** Every batch with no truck home yet (RET-06). The Owner can book it whenever the truck
 *  is arranged, closed lot or not; the chips say what the batch still lacks. The dialog
 *  behind the button is the same `return` form the manifest opens. */
export function ReturnShipmentView({
  db,
  open,
}: {
  db: Database;
  open: (kind: EntryKind, lotId?: string) => void;
}) {
  const readyToReturn = shipments(db).filter(
    (lot) => !entries(db, "return", lot.id).length,
  );
  return (
    <>
      <SectionHeading
        title="สร้างใบขนส่งขากลับ"
        description="ทุกชุดที่ยังไม่มีใบขนส่งขากลับ · Owner เรียกรถขากลับ Chef House → Foodiva ได้ทุกเมื่อ ไม่ต้องรอปิด Lot"
      />
      <DataTable
        title="ชุดที่ยังไม่มีใบขนส่งขากลับ"
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
            <LotProgressChips
              key="progress"
              db={db}
              lotId={lot.id}
              steps={["smoke", "closeLot"]}
            />,
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
        <Notice tone="success">ทุกชุดมีใบขนส่งขากลับแล้ว</Notice>
      )}
    </>
  );
}
