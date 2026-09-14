"use client";

import { useState } from "react";
import { DataTable } from "@/components/shared/DataTable";
import { balance, branches, centralBagStock, centralStock, entries, n, ownerWasteOutstanding, ownerWasteReceived, produced, producedBags, rawAtFoodDiva, rawAtSmoker, type Database, type Entry } from "@/lib/store";
import { fmt } from "@/lib/format";

export function MeatMovementLogView({ db }: { db: Database }) {
  const [lotFilter, setLotFilter] = useState("ทั้งหมด");
  const lots = db.lots.filter((lot) => lotFilter === "ทั้งหมด" || lot.id === lotFilter);
  const locationRows = lots.flatMap((lot) => {
    const returnReceived = n(
      entries(db, "foodDivaReturnReceive", lot.id).at(-1)?.values || {},
      "receivedKg",
    );
    const foodDivaSmoked = Math.max(0, returnReceived - n(lot.values, "centralKg"));
    const chefSmoked = lot.stage === 6 && !entries(db, "return", lot.id).length
      ? produced(db, lot.id)
      : 0;
    return [
      [lot.poId, lot.id, "Food Diva · เนื้อดิบ", `${fmt(rawAtFoodDiva(db, lot))} กก.`, "คงเหลือจาก PO ก่อนส่ง Chef_house"],
      [lot.poId, lot.id, "Food Diva · เนื้อส่วนที่เหลือรอ Owner รับ (Waste)", `${fmt(ownerWasteOutstanding(db, lot.id))} กก.`, `Owner รับแล้ว ${fmt(ownerWasteReceived(db, lot.id))} กก.`],
      [lot.poId, lot.id, "Owner · เนื้อส่วนที่รับแล้ว (Waste)", `${fmt(ownerWasteReceived(db, lot.id))} กก.`, "รับจาก Food Diva สำหรับใช้งาน Owner"],
      [lot.poId, lot.id, "Chef_house · รอเข้ารอบสโมค", `${fmt(rawAtSmoker(db, lot))} กก.`, "น้ำหนักรับจริง หักรอบที่สโมคแล้ว"],
      [lot.poId, lot.id, "Chef_house · เนื้อรมพร้อมเรียกรถ", `${fmt(chefSmoked)} กก.`, chefSmoked > 0 ? `${producedBags(db, lot.id)} ถุง · ปิด Lot แล้ว` : "—"],
      [lot.poId, lot.id, "Food Diva · เนื้อรมควัน", `${fmt(foodDivaSmoked)} กก.`, foodDivaSmoked > 0 ? "รับจาก Chef_house แล้ว รอ Owner รับเข้าคลังกลาง" : "—"],
      [lot.poId, lot.id, "คลังกลาง Owner", `${fmt(centralStock(db, lot.id))} กก.`, `${centralBagStock(db, lot.id)} ถุง พร้อมจัดสรร`],
      ...branches.map((branchName) => {
        const stock = balance(db, lot.id, branchName);
        return [
          lot.poId,
          lot.id,
          branchName,
          `${fmt(stock.frozen + stock.ready)} กก.`,
          `แช่แข็ง ${fmt(stock.frozen)} · พร้อมขาย ${fmt(stock.ready)}`,
        ];
      }),
    ];
  });
  const descriptions: Record<string, (entry: Entry) => [string, string, string]> = {
    foodDivaConfirm: (entry) => ["Food Diva", "ยืนยัน Invoice และแบ่งเนื้อ", `Invoice ${fmt(n(entry.values, "confirmedKg"))} · ส่งเชียงใหม่ ${fmt(n(entry.values, "readyForChiangMaiKg"))} · รอ Owner รับ (Waste) ${fmt(n(entry.values, "reservedForOwnerKg"))} กก.`],
    ownerWasteReceive: (entry) => ["Owner", "รับเนื้อส่วนที่เหลือจาก Food Diva", `${fmt(n(entry.values, "receivedKg"))} กก. · ${entry.values.receiver}`],
    dispatch: (entry) => ["Food Diva → Chef_house", "ส่งเนื้อดิบ", `${fmt(n(entry.values, "dispatchKg"))} กก.`],
    cmReceive: (entry) => ["Chef_house", "ชั่งรับเนื้อจริง", `${fmt(n(entry.values, "receivedKg"))} กก.`],
    smoke: (entry) => ["Chef_house", `สโมครอบ ${entry.values.subLot || "—"}`, `เข้าเตา ${fmt(n(entry.values, "inputKg"))} · หลังรม ${fmt(n(entry.values, "outputKg"))} · Waste ${fmt(n(entry.values, "wasteKg"))} กก.`],
    return: (entry) => ["Chef_house → Food Diva", "เรียกรถขากลับ", `${fmt(n(entry.values, "returnKg"))} กก.`],
    foodDivaReturnReceive: (entry) => ["Food Diva", "รับเนื้อรมควันเข้าตู้", `${fmt(n(entry.values, "receivedKg"))} กก.`],
    central: (entry) => ["คลังกลาง Owner", "รับเข้าสต๊อกกลาง", `${fmt(n(entry.values, "centralKg"))} กก.`],
    allocate: (entry) => ["Owner → สาขา", `จัดสรรไป ${entry.values.branch}`, `${fmt(n(entry.values, "kg"))} กก.`],
    receive: (entry) => [entry.branch || "สาขา", "รับเนื้อเข้าสาขา", `${fmt(n(entry.values, "kg"))} กก.`],
    thaw: (entry) => [entry.branch || "สาขา", "แบ่งละลาย", `${fmt(n(entry.values, "kg"))} กก.`],
    sale: (entry) => [entry.branch || "สาขา", "ตัดสต๊อกจากยอดขาย", `ขาย ${fmt(n(entry.values, "soldKg"))} · Waste ${fmt(n(entry.values, "wasteKg"))} กก.`],
  };
  const movementRows = db.entries
    .filter((entry) => descriptions[entry.kind] && (lotFilter === "ทั้งหมด" || entry.lotId === lotFilter))
    .sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at))
    .map((entry) => {
      const [location, action, amount] = descriptions[entry.kind](entry);
      return [entry.date, entry.at.slice(11, 16), entry.lotId, location, action, amount];
    });
  return (
    <div className="settings-stack">
      <section className="panel config-heading">
        <div>
          <span className="overline">OWNER · BEEF TRACE</span>
          <h2>Log เนื้อคงเหลือ</h2>
          <p className="muted">ดูเนื้อคงเหลือราย Lot ในทุกจุด และลำดับการเคลื่อนไหวตั้งแต่ Food Diva ถึงสาขา</p>
        </div>
      </section>
      <DataTable
        title="เนื้อคงเหลือแยกตามจุด"
        action={<label className="table-filter">Lot<select value={lotFilter} onChange={(event) => setLotFilter(event.target.value)}><option>ทั้งหมด</option>{db.lots.map((lot) => <option key={lot.id}>{lot.id}</option>)}</select></label>}
        columns={["PO", "Lot", "จุดเก็บ", "คงเหลือ", "รายละเอียด"]}
        rows={locationRows}
      />
      <DataTable
        title="ประวัติการเคลื่อนไหวเนื้อ"
        columns={["วันที่", "เวลา", "Lot", "จุดดำเนินการ", "รายการ", "น้ำหนัก / รายละเอียด"]}
        rows={movementRows}
      />
    </div>
  );
}
