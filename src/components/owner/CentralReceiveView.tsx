"use client";

import { DataTable } from "@/components/shared/DataTable";
import { entries, n, producedBags, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

export function CentralReceiveView({
  db,
  open,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
}) {
  const readyToReceive = db.lots.filter((lot) => lot.stage === 7 && entries(db, "foodDivaReturnReceive", lot.id).length);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Owner รับของจาก Food Diva เข้าสต๊อกกลาง</h2>
          <p className="muted">Food Diva ต้องยืนยันรับเนื้อรมควันเข้าตู้ก่อน Owner จึงรับเข้าสต๊อกกลางและจัดสรรสาขาได้</p>
        </div>
      </div>
      <DataTable
        title="Lot ที่รอรับเข้าคลังกลาง"
        columns={["Lot", "Food Diva รับจริง", "จำนวนถุง", "ใบขนส่งกลับ", "สถานะ", "การทำงาน"]}
        rows={readyToReceive.map((lot) => {
          const back = entries(db, "return", lot.id).at(-1);
          return [
            lot.id,
            `${fmt(n(entries(db, "foodDivaReturnReceive", lot.id).at(-1)?.values || {}, "receivedKg"))} กก.`,
            `${entries(db, "foodDivaReturnReceive", lot.id).at(-1)?.values.receivedBags || producedBags(db, lot.id)} ถุง`,
            back
              ? `${back.values.returnDate || "ยังไม่ระบุวัน"} · ${back.values.plate || "ยังไม่ระบุรถ"}`
              : "ยังไม่มีใบขนส่งขากลับ",
            "รอรับเข้าสต๊อกกลาง",
            <button className="table-action" key={lot.id} onClick={() => open("central", lot.id)}>
              รับเข้าคลังกลาง
            </button>,
          ];
        })}
      />
      {!readyToReceive.length && (
        <div className="notice success">ไม่มี Lot รอรับเข้าสต๊อกกลางในขณะนี้</div>
      )}
    </>
  );
}
