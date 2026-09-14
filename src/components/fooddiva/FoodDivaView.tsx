"use client";

import { DataTable } from "@/components/shared/DataTable";
import { DocumentPrintButton } from "@/components/shared/DocumentPrintButton";
import { purchaseOrderRows } from "@/components/shared/documents";
import { Stat } from "@/components/shared/primitives";
import { entries, n, produced, rawAtFoodDiva, readyForChefHouse, reservedForOwnerContent, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

export function FoodDivaView({ db, open }: { db: Database; open: (kind: string, lotId?: string) => void }) {
  const holding = db.lots.reduce((sum, lot) => sum + rawAtFoodDiva(db, lot), 0);
  const reservedForContent = db.lots.reduce((sum, lot) => sum + reservedForOwnerContent(db, lot.id), 0);
  const returnWaiting = db.lots.filter((lot) => lot.stage === 7 && !entries(db, "foodDivaReturnReceive", lot.id).length);
  return <div className="settings-stack">
    <section className="panel config-heading"><div><h2>งาน Food Diva</h2><p className="muted">รับ PO ออก Invoice แล้วระบุน้ำหนักพร้อมส่งเชียงใหม่ และเนื้อส่วนที่เหลือรอ Owner รับ (Waste)</p></div><div className="button-row"><Stat label="เนื้อดิบคงเหลือ Food Diva" value={`${fmt(holding)} กก.`} /><Stat label="เนื้อส่วนที่เหลือรอ Owner รับ (Waste)" value={`${fmt(reservedForContent)} กก.`} /></div></section>
    <DataTable
      title="PO เนื้อที่ต้องออก Invoice"
      columns={["เลข PO", "Lot", "ยอดสั่ง", "Invoice เนื้อ", "พร้อมส่งเชียงใหม่", "รอ Owner รับ (Waste)", "คงเหลือ Food Diva", "สถานะ", "การทำงาน"]}
      rows={db.lots.map((lot) => {
        const confirm = entries(db, "foodDivaConfirm", lot.id).at(-1);
        return [
          <strong key={lot.poId}>{lot.poId}</strong>, lot.id, `${fmt(n(lot.values, "orderedKg"))} กก.`,
          confirm ? `${confirm.values.invoiceNo} · ${fmt(n(confirm.values, "confirmedKg"))} กก.` : <span className="badge danger" key="pending">รอออก Invoice</span>,
          confirm ? `${fmt(readyForChefHouse(db, lot.id))} กก.` : "—",
          confirm ? `${fmt(reservedForOwnerContent(db, lot.id))} กก.` : "—",
          `${fmt(rawAtFoodDiva(db, lot))} กก.`,
          !confirm ? "ต้องออก Invoice" : lot.stage === 1 ? "รอ Owner เรียกรถ" : lot.stage < 7 ? "ส่งให้ Chef_house แล้ว" : "รอรับเนื้อรมควัน",
          !confirm ? (
            <div className="button-row" key="confirm-actions">
              <DocumentPrintButton title="Purchase Order" number={lot.poId} rows={purchaseOrderRows(lot, db)} label="ดู PO / PDF" preview />
              <button className="table-action" onClick={() => open("foodDivaConfirm", lot.id)}>ออกและอัปโหลด Invoice</button>
            </div>
          ) : (
            <div className="button-row" key="confirmed-actions">
              <DocumentPrintButton title="Purchase Order" number={lot.poId} rows={purchaseOrderRows(lot, db)} label="ดู PO / PDF" preview />
              <span className="badge success">แนบ Invoice แล้ว</span>
              <button className="table-action" onClick={() => open("foodDivaConfirm", lot.id)}>
                แก้ไข / อัปโหลดใหม่
              </button>
            </div>
          ),
        ];
      })}
    />
    <DataTable title="เนื้อรมควันรอ Food Diva รับเข้าตู้" columns={["PO / Lot", "ใบขนส่ง", "น้ำหนักหลังรม", "รับจริง", "สถานะ", "การทำงาน"]} rows={returnWaiting.map((lot) => {
      const trip = entries(db, "return", lot.id).at(-1);
      return [`${lot.poId} / ${lot.id}`, `${trip?.values.returnDate || "-"} · ${trip?.values.plate || "-"}`, `${fmt(produced(db, lot.id))} กก.`, "รอชั่งรับ", <span className="badge danger" key="status">ต้องรับเข้า</span>, <button key="receive" className="table-action" onClick={() => open("foodDivaReturnReceive", lot.id)}>ยืนยันรับเข้าตู้</button>];
    })} />
  </div>;
}
