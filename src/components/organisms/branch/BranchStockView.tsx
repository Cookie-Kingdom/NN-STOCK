"use client";

import { useState } from "react";
import { Select } from "@/components/atoms/Select";
import { FilterBar } from "@/components/molecules/FilterBar";
import { TableFilter } from "@/components/molecules/TableFilter";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  balance,
  branchMaterialStock,
  chiliAllocated,
  chiliSold,
  chiliStock,
  cookedRiceStock,
  issuedRawRiceStock,
  materialPar,
  materialUnitPrice,
  materials,
  pendingReceiveKg,
  rawRiceStock,
  cooksRice,
  type Database,
  type Lot,
} from "@/lib/store";
import { fmt } from "@/lib/format";

/** The branch screen only ever lists what is physically at this one branch, so there is
 *  no สถานที่ filter and none of the Owner's rows (Foodiva, คลังกลาง, คลัง Owner,
 *  บัญชี Owner, waste, ประวัติการซื้อ) can appear here. */
export const branchGenreOptions = [
  "ทั้งหมด",
  "เนื้อ",
  "วัตถุดิบ",
  "วัสดุบรรจุภัณฑ์",
];

const inventoryColumns = ["กลุ่ม", "รายการ", "คงเหลือ", "หน่วย", "รายละเอียด"];

export type BranchStockRow = {
  genre: string;
  item: string;
  quantity: string;
  unit: string;
  detail: string;
};

/** Every stock line of one branch, in table order: เนื้อ per Lot, then วัตถุดิบ, then the
 *  7 วัสดุบรรจุภัณฑ์. A meat Lot only earns a row while it still holds something or has
 *  meat waiting to be received. Pure: the filters read it, and so does the unit test. */
export function branchStockRows(
  db: Database,
  branch: string,
  lots: Lot[],
): BranchStockRow[] {
  return [
    ...lots.flatMap((lot) => {
      const stock = balance(db, lot.id, branch);
      const pending = pendingReceiveKg(db, lot.id, branch);
      const held = stock.frozen + stock.ready;
      if (held <= 0.001 && pending <= 0.001) return [];
      return [
        {
          genre: "เนื้อ",
          item: `${lot.id} · เนื้อรมควัน`,
          quantity: fmt(held),
          unit: "กก.",
          detail:
            `แช่แข็ง ${fmt(stock.frozen)} · ชิล/ละลายแล้ว ${fmt(stock.ready)}` +
            (pending > 0.001 ? ` · รอรับเข้าสาขา ${fmt(pending)} กก.` : ""),
        },
      ];
    }),
    ...(cooksRice(branch)
      ? [
          {
            genre: "วัตถุดิบ",
            item: "ข้าวเหนียวดิบ (ข้าวสาร)",
            quantity: fmt(rawRiceStock(db, branch)),
            unit: "กก.",
            detail: `เบิกแล้ว ${fmt(issuedRawRiceStock(db, branch))} กก.`,
          },
        ]
      : []),
    {
      genre: "วัตถุดิบ",
      item: "ข้าวเหนียวสุก",
      quantity: fmt(cookedRiceStock(db, branch)),
      unit: "กก.",
      detail: "ข้าวสุกคงเหลือ ยกไปวันถัดไปได้",
    },
    {
      genre: "วัตถุดิบ",
      item: "น้ำพริกหลอด",
      quantity: fmt(chiliStock(db, branch)),
      unit: "หลอด",
      detail: `Owner จัดสรร ${fmt(chiliAllocated(db, branch))} หลอด · ตัดสต๊อกแล้ว ${fmt(chiliSold(db, branch))} หลอด`,
    },
    ...materials.map((material, index) => ({
      genre: "วัสดุบรรจุภัณฑ์",
      item: material,
      quantity: fmt(branchMaterialStock(db, branch, index)),
      unit: "ชิ้น",
      detail: `ฐาน ${fmt(materialPar(db, branch, index))} · ฿${fmt(materialUnitPrice(db, branch, index))} / ชิ้น`,
    })),
  ];
}

/** One inventory table for a branch, filtered by กลุ่มสต๊อก and รายการ — the Owner's
 *  "สต๊อกของทั้งหมด" idiom, cut down to the one branch that is signed in. */
export function BranchStockView({
  db,
  branch,
  lots,
}: {
  db: Database;
  branch: string;
  lots: Lot[];
}) {
  const [genre, setGenre] = useState("ทั้งหมด");
  const [itemFilter, setItemFilter] = useState("ทั้งหมด");
  const rows = branchStockRows(db, branch, lots);
  const visibleRows = rows.filter(
    (row) =>
      (genre === "ทั้งหมด" || row.genre === genre) &&
      (itemFilter === "ทั้งหมด" || row.item === itemFilter),
  );
  const itemOptions = Array.from(
    new Set(
      rows
        .filter((row) => genre === "ทั้งหมด" || row.genre === genre)
        .map((row) => row.item),
    ),
  );
  return (
    <DataTable
      title={`ตารางสต๊อกทั้งหมด · ${branch}`}
      action={
        <FilterBar>
          <TableFilter label="กลุ่มสต๊อก">
            <Select
              variant="filter"
              value={genre}
              onChange={(event) => {
                setGenre(event.target.value);
                setItemFilter("ทั้งหมด");
              }}
            >
              {branchGenreOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </TableFilter>
          <TableFilter label="รายการ">
            <Select
              variant="filter"
              value={itemFilter}
              onChange={(event) => setItemFilter(event.target.value)}
            >
              <option>ทั้งหมด</option>
              {itemOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </TableFilter>
        </FilterBar>
      }
      columns={inventoryColumns}
      rows={visibleRows.map((row) => [
        row.genre,
        row.item,
        row.quantity,
        row.unit,
        row.detail,
      ])}
    />
  );
}
