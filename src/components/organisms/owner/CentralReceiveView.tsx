"use client";

import { Button } from "@/components/atoms/Button";
import { Notice } from "@/components/molecules/Notice";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { LotProgressChips } from "@/components/molecules/LotProgressChips";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  entries,
  n,
  producedBags,
  shipments,
  type Database,
  type EntryKind,
} from "@/lib/store";
import { fmt } from "@/lib/format";

const columns = [
  "Lot",
  "Foodiva รับจริง",
  "จำนวนกล่องรมควัน",
  "ใบขนส่งกลับ",
  "ขั้นที่ยังขาด",
  "การทำงาน",
];

export function CentralReceiveView({
  db,
  open,
}: {
  db: Database;
  open: (kind: EntryKind, lotId?: string) => void;
}) {
  // RET-06: every batch not yet in central stock; no truck home or Foodiva receipt needed.
  const readyToReceive = shipments(db).filter(
    (lot) => !entries(db, "central", lot.id).length,
  );
  return (
    <>
      <SectionHeading
        title="Owner รับของจาก Foodiva เข้าสต๊อกกลาง"
        description="ทุกชุดที่ยังไม่เข้าสต๊อกกลาง · รับเข้าได้ทุกเมื่อ ถ้า Foodiva ยืนยันรับเข้าตู้แล้วระบบจะเทียบน้ำหนักให้"
      />
      <DataTable
        title="ชุดที่ยังไม่เข้าสต๊อกกลาง"
        columns={columns}
        rowKeys={readyToReceive.map((lot) => lot.id)}
        rows={readyToReceive.map((lot) => {
          const back = entries(db, "return", lot.id).at(-1);
          const received = entries(db, "foodivaReturnReceive", lot.id).at(-1);
          return [
            lot.id,
            received
              ? `${fmt(n(received.values, "receivedKg"))} กก.`
              : "ยังไม่ยืนยันรับ",
            `${received?.values.receivedBags || producedBags(db, lot.id)} กล่องรมควัน`,
            back
              ? `${back.values.returnDate || "ยังไม่ระบุวัน"} · ${back.values.plate || "ยังไม่ระบุรถ"}`
              : "ยังไม่มีใบขนส่งขากลับ",
            <LotProgressChips
              key="progress"
              db={db}
              lotId={lot.id}
              steps={["smoke", "return", "foodivaReturnReceive"]}
            />,
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
        <Notice tone="success">ทุกชุดรับเข้าสต๊อกกลางแล้ว</Notice>
      )}
    </>
  );
}
