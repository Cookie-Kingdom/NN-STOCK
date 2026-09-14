"use client";

import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import { entries, n, produced, readyForChefHouse, smokingInvoiceStatus, type Database, type Lot } from "@/lib/store";
import { fmt } from "@/lib/format";

export function TransportManifestView({
  db,
  open,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
}) {
  const returnEntry = (lotId: string) => entries(db, "return", lotId).at(-1);
  const tripStatus = (lot: Lot) => {
    const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
    const invoiceStatus = invoice ? smokingInvoiceStatus(db, invoice) : "";
    if (lot.stage === 1 && !entries(db, "foodDivaConfirm", lot.id).length)
      return <span className="badge danger">รอ Foodiva ออก Invoice</span>;
    if (lot.stage === 1 && !entries(db, "smokeOrder", lot.id).length)
      return <span className="badge danger">รอ Owner ออก PO รมควัน</span>;
    if (lot.stage === 1 && !entries(db, "smokeOrderAccept", lot.id).length)
      return <span className="badge danger">รอ Chef_house รับ PO</span>;
    if (lot.stage === 1 && !entries(db, "smokingInvoice", lot.id).length)
      return <span className="badge danger">รอ Chef_house Submit Invoice</span>;
    if (lot.stage === 1 && invoiceStatus === "รอตรวจยอด")
      return <button className="table-action" onClick={() => open("invoiceReview", lot.id)}>ตรวจ Invoice เพื่อเรียกรถ</button>;
    if (lot.stage === 1 && invoiceStatus === "รอชำระ")
      return <button className="table-action" onClick={() => open("invoicePayment", lot.id)}>ชำระ Invoice เพื่อเรียกรถ</button>;
    if (lot.stage === 1 && invoiceStatus !== "ชำระแล้ว")
      return <span className="badge danger">รอ Chef_house แก้ Invoice</span>;
    if (lot.stage === 1)
      return <button className="table-action" onClick={() => open("dispatch", lot.id)}>ทำใบขนส่งขาไป</button>;
    if (lot.stage === 6)
      return <button className="table-action" onClick={() => open("return", lot.id)}>เรียกรถขากลับ · {fmt(produced(db, lot.id))} กก.</button>;
    if (lot.stage < 6) return "กำลังดำเนินงานที่ Chef_house";
    if (lot.stage === 7 && !entries(db, "foodDivaReturnReceive", lot.id).length) return "รอ Foodiva รับเข้าตู้";
    return "Foodiva รับเข้าตู้แล้ว";
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>ใบขนส่งเนื้อ</h2>
          <p className="muted">Owner เรียกรถและบันทึกใบขนส่งทั้ง Foodiva → Chef_house และ Chef_house → Foodiva</p>
        </div>
      </div>
      <DataTable
        title="รายการขนส่งตาม Lot"
        columns={["เลข PO", "Lot", "ขาไป · Foodiva → Chef_house", "เทียบน้ำหนัก Owner", "ขากลับ · Chef_house → Foodiva", "การทำงาน"]}
        rows={db.lots.map((lot) => {
          const back = returnEntry(lot.id);
          const outbound = entries(db, "dispatch", lot.id).at(-1);
          const chefReceive = entries(db, "cmReceive", lot.id).at(-1);
          const foodInvoice = entries(db, "foodDivaConfirm", lot.id).at(-1);
          const foodivaKg = n(foodInvoice?.values || {}, "confirmedKg");
          const chefKg = n(chefReceive?.values || {}, "receivedKg");
          const difference = chefKg - foodivaKg;
          return [
            lot.poId,
            lot.id,
            outbound
              ? <div className="button-row" key={`${lot.id}-outbound`}><span>{`${fmt(n(outbound.values, "dispatchKg"))} กก. · ${outbound.values.plate || "ยังไม่ระบุรถ"}`}</span><DocumentPrintButton title="ใบขนส่งเนื้อขาไป" number={outbound.values.transferNumber || outbound.id.slice(0, 8)} label="พรีวิว / PDF" preview rows={[["วันที่รถรับ", outbound.values.pickupDate || outbound.date], ["PO", lot.poId], ["Lot เนื้อ", lot.id], ["ต้นทาง", outbound.values.origin], ["ปลายทาง", outbound.values.destination], ["น้ำหนักส่ง", `${fmt(n(outbound.values, "dispatchKg"))} กก.`], ["ประเภทรถ", outbound.values.vehicleType || "—"], ["ทะเบียนรถ", outbound.values.plate || "—"], ["คนขับ", outbound.values.driverName || "—"], ["เบอร์ติดต่อ", outbound.values.driverPhone || "—"]]} /></div>
              : `พร้อมส่งเชียงใหม่ ${fmt(readyForChefHouse(db, lot.id))} กก. · รอทำใบขนส่ง`,
            chefReceive
              ? <span key={`${lot.id}-owner-check`}><strong>Foodiva:</strong> {fmt(foodivaKg)} กก.<br /><strong>Chef_house:</strong> {fmt(chefKg)} กก.<br /><span className={Math.abs(difference) > 0.001 ? "badge danger" : "badge success"}>ส่วนต่าง {fmt(difference)} กก.</span></span>
              : "รอ Chef_house ชั่งรับ",
            back
              ? <div className="button-row" key={`${lot.id}-return`}><span>{`${back.values.returnDate || "ยังไม่ระบุวัน"} · ${back.values.plate || "ยังไม่ระบุรถ"}`}</span><DocumentPrintButton title="ใบขนส่งเนื้อขากลับ" number={back.values.transferNumber || back.id.slice(0, 8)} label="พรีวิว / PDF" preview rows={[["วันที่รถรับ", back.values.returnDate || back.date], ["PO", lot.poId], ["Lot เนื้อ", lot.id], ["ต้นทาง", back.values.origin], ["ปลายทาง", back.values.destination], ["น้ำหนักส่ง", `${fmt(n(back.values, "returnKg"))} กก.`], ["ประเภทรถ", back.values.vehicleType || "—"], ["ทะเบียนรถ", back.values.plate || "—"], ["คนขับ", back.values.driverName || "—"], ["เบอร์ติดต่อ", back.values.driverPhone || "—"]]} /></div>
              : lot.stage < 6
                ? "รอ Chef_house ปิด Lot"
                : `รอเรียกรถกลับ ${fmt(produced(db, lot.id))} กก.`,
            tripStatus(lot),
          ];
        })}
      />
    </>
  );
}
