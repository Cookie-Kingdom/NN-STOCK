"use client";

import { useState } from "react";
import { BranchSelectFilter } from "@/components/molecules/BranchSelectFilter";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { branchMaterialStock, branches, entries, materialPar, materialUnitPrice, materials, n, ownerMaterialStock, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

const ALL = "ทั้งหมด";
const OWNER_STORE = "คลัง Owner";
/** Option order matches the old hard-coded list: ทั้งหมด, คลัง Owner, ศาลาแดง, มีนบุรี. */
const stockLocations = [OWNER_STORE, ...branches];

export function MaterialStockTable({
  db,
  stockBranches,
  ownerView,
}: {
  db: Database;
  stockBranches: string[];
  ownerView: boolean;
}) {
  const [branchFilter, setBranchFilter] = useState(ALL);
  if (ownerView) {
    const purchases = [...entries(db, "materialReceive")]
      .sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
    return (
      <div className="grid gap-6">
        <DataTable
          title="ตารางสต๊อกวัสดุ (Material inventory)"
          action={
            <BranchSelectFilter
              label="ดูสต๊อก"
              value={branchFilter}
              onChange={setBranchFilter}
              branches={stockLocations}
            />
          }
          columns={branchFilter === ALL ? ["วัสดุ", "รวมทุกจุด", OWNER_STORE, ...branches, "จำนวนฐานรวม", "สถานะ"] : ["วัสดุ", "จุดจัดเก็บ", "คงเหลือ", "จำนวนฐาน", "ราคาต่อหน่วย", "มูลค่าคงเหลือ", "สถานะ"]}
          rowKeys={materials}
          rows={materials.map((item, index) => {
            const owner = ownerMaterialStock(db, item);
            if (branchFilter === ALL) {
              const branchStock = branches.map((name) => branchMaterialStock(db, name, index));
              const total = owner + branchStock.reduce((sum, quantity) => sum + quantity, 0);
              const parTotal = branches.reduce((sum, name) => sum + materialPar(db, name, index), 0);
              return [
                item,
                `${total} ชิ้น`,
                `${owner} ชิ้น`,
                ...branchStock.map((quantity) => `${quantity} ชิ้น`),
                `${parTotal} ชิ้น`,
                total > 0 ? "มีข้อมูล" : "ยังไม่มีสต๊อก",
              ];
            }
            const isOwner = branchFilter === OWNER_STORE;
            const quantity = isOwner ? owner : branchMaterialStock(db, branchFilter, index);
            const par = isOwner ? 0 : materialPar(db, branchFilter, index);
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
          rowKeys={purchases.map((entry) => entry.id)}
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
