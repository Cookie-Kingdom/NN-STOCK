"use client";

import { DataTable } from "@/components/organisms/shared/DataTable";
import { n, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

export function ChefReceiveTable({ db, open }: { db: Database; open: (kind: string, lotId?: string) => void }) {
  const waiting = db.lots.filter((lot) => lot.stage === 2);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>ยืนยันรับเนื้อที่ Chef_house</h2>
          <p className="muted">เลือกรายการที่รถมาถึง แล้วบันทึกเวลาและน้ำหนักรับจริง</p>
        </div>
      </div>
      <DataTable
        title="Lot ที่รอยืนยันรับ"
        columns={["Lot", "วันที่รถรับ", "น้ำหนักที่ส่ง", "รถ / ผู้ขนส่ง", "การทำงาน"]}
        rows={waiting.map((lot) => [
          lot.id,
          lot.values.pickupDate || "-",
          `${fmt(n(lot.values, "dispatchKg"))} กก.`,
          lot.values.vehicle || "-",
          <button className="table-action" key={lot.id} onClick={() => open("cmReceive", lot.id)}>
            ยืนยันรับเนื้อ
          </button>,
        ])}
      />
      {!waiting.length && <div className="notice success">ไม่มี Lot รอยืนยันรับในขณะนี้</div>}
    </>
  );
}
