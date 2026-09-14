"use client";

import { useState } from "react";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { branchMaterialStock, entries, materialPar, materialUnitPrice, materials, n, ownerMaterialStock, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

export function MaterialStockTable({
  db,
  stockBranches,
  ownerView,
}: {
  db: Database;
  stockBranches: string[];
  ownerView: boolean;
}) {
  const [branchFilter, setBranchFilter] = useState("ทั้งหมด");
  if (ownerView) {
    const purchases = [...entries(db, "materialReceive")]
      .sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
    return (
      <div className="settings-stack">
        <DataTable
          title="ตารางสต๊อกวัสดุ (Material inventory)"
          action={<label className="table-filter">ดูสต๊อก<select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}><option>ทั้งหมด</option><option>คลัง Owner</option><option>ศาลาแดง</option><option>มีนบุรี</option></select></label>}
          columns={branchFilter === "ทั้งหมด" ? ["วัสดุ", "รวมทุกจุด", "คลัง Owner", "ศาลาแดง", "มีนบุรี", "จำนวนฐานรวม", "สถานะ"] : ["วัสดุ", "จุดจัดเก็บ", "คงเหลือ", "จำนวนฐาน", "ราคาต่อหน่วย", "มูลค่าคงเหลือ", "สถานะ"]}
          rows={materials.map((item, index) => {
            const owner = ownerMaterialStock(db, item);
            const sala = branchMaterialStock(db, "ศาลาแดง", index);
            const minburi = branchMaterialStock(db, "มีนบุรี", index);
            const salaPar = materialPar(db, "ศาลาแดง", index);
            const minburiPar = materialPar(db, "มีนบุรี", index);
            if (branchFilter === "ทั้งหมด")
              return [
                item,
                `${owner + sala + minburi} ชิ้น`,
                `${owner} ชิ้น`,
                `${sala} ชิ้น`,
                `${minburi} ชิ้น`,
                `${salaPar + minburiPar} ชิ้น`,
                owner + sala + minburi > 0 ? "มีข้อมูล" : "ยังไม่มีสต๊อก",
              ];
            const isOwner = branchFilter === "คลัง Owner";
            const quantity = isOwner ? owner : branchFilter === "ศาลาแดง" ? sala : minburi;
            const par = isOwner ? 0 : branchFilter === "ศาลาแดง" ? salaPar : minburiPar;
            const price = isOwner ? 0 : materialUnitPrice(db, branchFilter, index);
            return [
              item,
              branchFilter,
              `${quantity} ชิ้น`,
              isOwner ? "—" : `${par} ชิ้น`,
              isOwner ? "—" : `฿${fmt(price)} / ชิ้น`,
              isOwner ? "—" : `฿${fmt(quantity * price)}`,
              isOwner ? (quantity > 0 ? "มีข้อมูล" : "ยังไม่มีสต๊อก") : par > 0 && quantity < par * 0.2 ? "ใกล้หมด" : "ปกติ",
            ];
          })}
        />
        <DataTable
          title="ประวัติการซื้อวัสดุ (Material purchase history)"
          columns={["วันที่ซื้อ", "วัสดุ", "จำนวน", "ราคาซื้อ / หน่วย", "ยอดรวม", "ผู้จำหน่าย", "เลขอ้างอิง"]}
          rows={purchases.map((entry) => [
            entry.values.purchaseDate || entry.date,
            entry.values.material,
            `${fmt(n(entry.values, "quantity"))} ชิ้น`,
            `฿${fmt(n(entry.values, "unitPrice"))}`,
            `฿${fmt(n(entry.values, "totalCost"))}`,
            entry.values.supplier,
            entry.values.reference || "—",
          ])}
        />
      </div>
    );
  }
  return (
    <DataTable
      title="สต๊อกวัสดุ 7 รายการ (Material inventory)"
      columns={["สาขา", "วัสดุ", "คงเหลือ", "จำนวนฐาน", "นับล่าสุด", "สถานะ"]}
      rows={stockBranches.flatMap((name) => {
        const latest = entries(db, "materials", undefined, name).at(-1);
        return materials.map((item, index) => {
          const par = materialPar(db, name, index);
          const quantity = branchMaterialStock(db, name, index);
          return [
            name,
            item,
            `${quantity} ชิ้น`,
            `${par} ชิ้น`,
            latest?.date || "ยังไม่เคยนับ",
            !latest
              ? "รอตรวจนับ"
              : par > 0 && quantity < par * 0.2
                ? "ใกล้หมด"
                : "ปกติ",
          ];
        });
      })}
    />
  );
}
