"use client";

import { Button } from "@/components/atoms/Button";
import { Notice } from "@/components/molecules/Notice";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  entries,
  n,
  producedBags,
  type Database,
  type EntryKind,
  STAGE,
} from "@/lib/store";
import { fmt } from "@/lib/format";

const columns = [
  "Lot",
  "Foodiva รับจริง",
  "จำนวนกล่องรมควัน",
  "ใบขนส่งกลับ",
  "สถานะ",
  "การทำงาน",
];

export function CentralReceiveView({
  db,
  open,
}: {
  db: Database;
  open: (kind: EntryKind, lotId?: string) => void;
}) {
  const readyToReceive = db.lots.filter(
    (lot) =>
      lot.stage === STAGE.central &&
      entries(db, "foodivaReturnReceive", lot.id).length,
  );
  return (
    <>
      <SectionHeading
        title="Owner รับของจาก Foodiva เข้าสต๊อกกลาง"
        description="Foodiva ต้องยืนยันรับเนื้อรมควันเข้าตู้ก่อน Owner จึงรับเข้าสต๊อกกลางและจัดสรรสาขาได้"
      />
      <DataTable
        title="Lot ที่รอรับเข้าสต๊อกกลาง"
        columns={columns}
        rowKeys={readyToReceive.map((lot) => lot.id)}
        rows={readyToReceive.map((lot) => {
          const back = entries(db, "return", lot.id).at(-1);
          const received = entries(db, "foodivaReturnReceive", lot.id).at(-1);
          return [
            lot.id,
            `${fmt(n(received?.values || {}, "receivedKg"))} กก.`,
            `${received?.values.receivedBags || producedBags(db, lot.id)} กล่องรมควัน`,
            back
              ? `${back.values.returnDate || "ยังไม่ระบุวัน"} · ${back.values.plate || "ยังไม่ระบุรถ"}`
              : "ยังไม่มีใบขนส่งขากลับ",
            "รอรับเข้าสต๊อกกลาง",
            <Button
              variant="table"
              key={lot.id}
              onClick={() => open("central", lot.id)}
            >
              รับเข้าสต๊อกกลาง
            </Button>,
          ];
        })}
      />
      {!readyToReceive.length && (
        <Notice tone="success">ไม่มี Lot รอรับเข้าสต๊อกกลางในขณะนี้</Notice>
      )}
    </>
  );
}
