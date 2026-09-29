"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  entries,
  latestPackingList,
  lotProgress,
  n,
  packingListBoxes,
  shipments,
  type Database,
  type EntryKind,
} from "@/lib/store";
import { fmt } from "@/lib/format";

/** CHF-07: every batch Chef House can see that is not weighed in yet, whether or not
 *  Foodiva's Packing List or the Owner's smoke PO is in. Meat that arrives with no batch
 *  at all opens a new one ("เปิดชุดใหม่", `lotId === ""`). */
export function ChefReceiveTable({
  db,
  open,
}: {
  db: Database;
  open: (kind: EntryKind, lotId?: string) => void;
}) {
  // Shipment batches only: the Owner's database also holds the purchase POs.
  const waiting = shipments(db).filter(
    (lot) => !lotProgress(db, lot.id).has("cmReceive"),
  );
  return (
    <>
      <SectionHeading
        title="ยืนยันรับเนื้อที่ Chef House"
        description="เลือกการส่งที่รถมาถึง แล้วกรอกน้ำหนักจริงรายกล่องรับเข้าในช่องสีเหลือง · เนื้อมาถึงแต่ไม่มีในรายการ กดเปิดชุดใหม่"
        actions={
          <Button
            icon={<Plus className="size-4" />}
            onClick={() => open("cmReceive", "")}
          >
            เปิดชุดใหม่
          </Button>
        }
      />
      <DataTable
        title="การส่งที่รอยืนยันรับ"
        defaultSort={{ column: "วันที่รถรับ", desc: true }}
        columns={[
          "เลขที่การส่ง",
          "วันที่รถรับ",
          "Packing List",
          "PO รมควัน",
          "รถ / ผู้ขนส่ง",
          "การทำงาน",
        ]}
        emptyText="ไม่มีการส่งรอยืนยันรับในขณะนี้ · เนื้อมาถึงแล้วกดเปิดชุดใหม่"
        rowKeys={waiting.map((lot) => lot.id)}
        rows={waiting.map((lot) => {
          const list = latestPackingList(db, lot.id);
          const boxes = packingListBoxes(list?.values.boxes);
          const order = entries(db, "smokeOrder", lot.id).at(-1);
          return [
            lot.poId,
            lot.values.pickupDate || "-",
            list ? (
              `${boxes.length} กล่องรับเข้า · ${fmt(n(list.values, "slicedNetKg"))} กก.`
            ) : (
              <Badge key={`${lot.id}-list`} tone="neutral">
                ยังไม่มี Packing List
              </Badge>
            ),
            order ? (
              order.values.orderNumber || "มี PO แล้ว"
            ) : (
              <Badge key={`${lot.id}-po`} tone="warning">
                ยังไม่มี PO รมควัน
              </Badge>
            ),
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
