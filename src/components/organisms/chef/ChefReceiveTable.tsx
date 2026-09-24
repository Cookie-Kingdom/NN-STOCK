"use client";

import { Button } from "@/components/atoms/Button";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  latestPackingList,
  n,
  packingListBoxes,
  type Database,
  type EntryKind,
  STAGE,
} from "@/lib/store";
import { fmt } from "@/lib/format";

export function ChefReceiveTable({
  db,
  open,
}: {
  db: Database;
  open: (kind: EntryKind, lotId?: string) => void;
}) {
  const waiting = db.lots.filter((lot) => lot.stage === STAGE.cmReceive);
  return (
    <>
      <SectionHeading
        title="ยืนยันรับเนื้อที่ Chef House"
        description="เลือกการส่งที่รถมาถึง แล้วกรอกน้ำหนักจริงรายกล่องรับเข้าในช่องสีเหลือง"
      />
      <DataTable
        title="การส่งที่รอยืนยันรับ"
        defaultSort={{ column: "วันที่รถรับ", desc: true }}
        columns={[
          "เลขที่การส่ง",
          "วันที่รถรับ",
          "Packing List",
          "รถ / ผู้ขนส่ง",
          "การทำงาน",
        ]}
        emptyText="ไม่มีการส่งรอยืนยันรับในขณะนี้"
        rowKeys={waiting.map((lot) => lot.id)}
        rows={waiting.map((lot) => {
          const list = latestPackingList(db, lot.id);
          const boxes = packingListBoxes(list?.values.boxes);
          return [
            lot.poId,
            lot.values.pickupDate || "-",
            list
              ? `${boxes.length} กล่องรับเข้า · ${fmt(n(list.values, "slicedNetKg"))} กก.`
              : "-",
            [lot.values.vehicleType, lot.values.plate]
              .filter(Boolean)
              .join(" · ") || "-",
            <Button
              variant="table"
              key={lot.id}
              onClick={() => open("cmReceive", lot.id)}
            >
              ยืนยันรับเนื้อ
            </Button>,
          ];
        })}
      />
    </>
  );
}
