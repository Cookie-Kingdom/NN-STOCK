"use client";

import { Button } from "@/components/atoms/Button";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { n, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

export function ChefReceiveTable({
  db,
  open,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
}) {
  const waiting = db.lots.filter((lot) => lot.stage === 2);
  return (
    <>
      <SectionHeading
        title="ยืนยันรับเนื้อที่ Chef_house"
        description="เลือกรายการที่รถมาถึง แล้วบันทึกเวลาและน้ำหนักรับจริง"
      />
      <DataTable
        title="Lot ที่รอยืนยันรับ"
        columns={[
          "Lot",
          "วันที่รถรับ",
          "น้ำหนักที่ส่ง",
          "รถ / ผู้ขนส่ง",
          "การทำงาน",
        ]}
        emptyText="ไม่มี Lot รอยืนยันรับในขณะนี้"
        rowKeys={waiting.map((lot) => lot.id)}
        rows={waiting.map((lot) => [
          lot.id,
          lot.values.pickupDate || "-",
          `${fmt(n(lot.values, "dispatchKg"))} กก.`,
          lot.values.vehicle || "-",
          <Button
            variant="table"
            key={lot.id}
            onClick={() => open("cmReceive", lot.id)}
          >
            ยืนยันรับเนื้อ
          </Button>,
        ])}
      />
    </>
  );
}
