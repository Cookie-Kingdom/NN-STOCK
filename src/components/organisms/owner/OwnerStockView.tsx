"use client";

import { type ReactNode, useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Select } from "@/components/atoms/Select";
import { FilterBar } from "@/components/molecules/FilterBar";
import { TableFilter } from "@/components/molecules/TableFilter";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  balance,
  branchMaterialStock,
  branches,
  centralBagStock,
  centralStock,
  chiliAllocated,
  chiliSold,
  chiliStock,
  cookedRiceStock,
  entries,
  issuedRawRiceStock,
  materialPar,
  materialUnitPrice,
  materials,
  n,
  ownerChiliStock,
  ownerMaterialStock,
  ownerWasteOutstanding,
  ownerWasteReceived,
  rawRiceStock,
  readyForChefHouse,
  reservedForOwnerContent,
  type Database,
  type Lot,
} from "@/lib/store";
import { fmt } from "@/lib/format";

const genreOptions = [
  "ทั้งหมด",
  "เนื้อ",
  "วัตถุดิบ",
  "วัสดุบรรจุภัณฑ์",
  "สินทรัพย์",
  "ค่าใช้จ่ายอื่น",
];
const locationOptions = [
  "ทั้งหมด",
  "Foodiva",
  "Owner",
  "คลังกลาง",
  "คลัง Owner",
  "บัญชี Owner",
  ...branches,
];
const meatTypeOptions = [
  "เนื้อดิบพร้อมส่ง Chef House",
  "เนื้อรมควัน",
  "เนื้อส่วนที่เหลือรอ Owner รับ (Waste)",
];
const inventoryColumns = [
  "กลุ่ม",
  "รายการ / Lot",
  "สถานที่",
  "คงเหลือ",
  "หน่วย",
  "รายละเอียด",
  "การทำงาน",
];
const purchaseColumns = [
  "วันที่ซื้อ",
  "หมวดบัญชี",
  "รายการ",
  "จำนวน",
  "ราคาซื้อ / หน่วย",
  "ยอดรวม",
  "ผู้จำหน่าย",
  "เลขอ้างอิง / ใบเสร็จ",
];

function purchaseGroup(value?: string) {
  return value === "วัตถุดิบ / สินค้า"
    ? "วัตถุดิบ"
    : value === "ETC / สินทรัพย์"
      ? "สินทรัพย์"
      : value || "วัตถุดิบ";
}

export function OwnerStockView({
  db,
  lots,
  open,
}: {
  db: Database;
  lots: Lot[];
  open: (kind: string, lotId?: string) => void;
}) {
  const [genre, setGenre] = useState("ทั้งหมด");
  const [location, setLocation] = useState("ทั้งหมด");
  const [itemFilter, setItemFilter] = useState("ทั้งหมด");
  const generalPurchases = entries(db, "generalPurchase");
  const accountingItems = Array.from(
    new Set([
      "น้ำพริกหลอด",
      "น้ำดอง",
      ...generalPurchases.map((entry) => entry.values.item).filter(Boolean),
    ]),
  );
  const rows: {
    genre: string;
    item: string;
    location: string;
    quantity: string;
    unit: string;
    detail: string;
    meatType?: string;
    action?: ReactNode;
  }[] = [
    ...lots.flatMap((lot) => {
      const invoiceConfirmed = entries(db, "foodivaConfirm", lot.id).length > 0;
      const central = Math.max(0, centralStock(db, lot.id));
      const dispatched = n(
        entries(db, "dispatch", lot.id).at(-1)?.values || {},
        "dispatchKg",
      );
      const readyAtFoodiva = Math.max(
        0,
        readyForChefHouse(db, lot.id) - dispatched,
      );
      const ownerReserved = reservedForOwnerContent(db, lot.id);
      const ownerWaiting = ownerWasteOutstanding(db, lot.id);
      const ownerReceived = ownerWasteReceived(db, lot.id);
      return [
        {
          genre: "เนื้อ",
          item: `${lot.id} · เนื้อดิบพร้อมส่ง Chef House`,
          location: "Foodiva",
          quantity: fmt(invoiceConfirmed ? readyAtFoodiva : 0),
          unit: "กก.",
          detail: invoiceConfirmed
            ? "จาก Invoice Foodiva · รอ Owner เรียกรถไปเชียงใหม่"
            : "รอ Foodiva ยืนยัน Invoice",
          meatType: "เนื้อดิบพร้อมส่ง Chef House",
        },
        ...(invoiceConfirmed
          ? [
              {
                genre: "เนื้อ",
                item: `${lot.id} · เนื้อส่วนที่เหลือรอ Owner รับ (Waste)`,
                location: "Foodiva",
                quantity: fmt(ownerWaiting),
                unit: "กก.",
                detail: `จาก Invoice ${fmt(ownerReserved)} กก. · Owner รับแล้ว ${fmt(ownerReceived)} กก.`,
                meatType: "เนื้อส่วนที่เหลือรอ Owner รับ (Waste)",
                action:
                  ownerWaiting > 0.001 ? (
                    <Button
                      variant="table"
                      onClick={() => open("ownerWasteReceive", lot.id)}
                    >
                      บันทึกรับเนื้อ
                    </Button>
                  ) : (
                    <Badge tone="success">Owner รับครบแล้ว</Badge>
                  ),
              },
              ...(ownerReceived > 0.001
                ? [
                    {
                      genre: "เนื้อ",
                      item: `${lot.id} · เนื้อส่วนที่ Owner รับแล้ว (Waste)`,
                      location: "Owner",
                      quantity: fmt(ownerReceived),
                      unit: "กก.",
                      detail: "รับจาก Foodiva แล้ว · สำหรับใช้งาน Owner",
                      meatType: "เนื้อส่วนที่เหลือรอ Owner รับ (Waste)",
                    },
                  ]
                : []),
            ]
          : []),
        {
          genre: "เนื้อ",
          item: `${lot.id} · เนื้อรมควัน`,
          location: "คลังกลาง",
          quantity: fmt(central),
          unit: "กก.",
          detail: `จากรับเข้าสต๊อกกลาง · ${centralBagStock(db, lot.id)} ถุง พร้อมจัดสรร`,
          meatType: "เนื้อรมควัน",
        },
        ...branches.map((branchName) => {
          const stock = balance(db, lot.id, branchName);
          return {
            genre: "เนื้อ",
            item: `${lot.id} · เนื้อรมควัน`,
            location: branchName,
            quantity: fmt(stock.frozen + stock.ready),
            unit: "กก.",
            detail: `จากจัดสรร Owner · แช่แข็ง ${fmt(stock.frozen)} · พร้อมขาย ${fmt(stock.ready)}`,
            meatType: "เนื้อรมควัน",
          };
        }),
      ];
    }),
    ...branches.flatMap((branchName) => [
      {
        genre: "วัตถุดิบ",
        item: "ข้าวเหนียวดิบ (ข้าวสาร)",
        location: branchName,
        quantity: fmt(rawRiceStock(db, branchName)),
        unit: "กก.",
        detail: `เบิกแล้ว ${fmt(issuedRawRiceStock(db, branchName))} กก.`,
      },
      {
        genre: "วัตถุดิบ",
        item: "ข้าวเหนียวสุก",
        location: branchName,
        quantity: fmt(cookedRiceStock(db, branchName)),
        unit: "กก.",
        detail:
          branchName === "มีนบุรี"
            ? "เหลือสำหรับอุ่นขายวันถัดไป"
            : "ข้าวสุกคงเหลือ",
      },
      {
        genre: "วัตถุดิบ",
        item: "น้ำพริกหลอด",
        location: branchName,
        quantity: fmt(chiliStock(db, branchName)),
        unit: "หลอด",
        detail: `Owner จัดสรร ${fmt(chiliAllocated(db, branchName))} หลอด · ตัดสต๊อกแล้ว ${fmt(chiliSold(db, branchName))} หลอด`,
      },
    ]),
    ...accountingItems.map((item) => {
      const history = generalPurchases.filter(
        (entry) => entry.values.item === item,
      );
      const latest = history.at(-1);
      const category = purchaseGroup(latest?.values.purchaseCategory);
      const defaultUnit =
        item === "น้ำดอง" ? "มล." : item === "น้ำพริกหลอด" ? "หลอด" : "รายการ";
      const isChili = item === "น้ำพริกหลอด";
      return {
        genre:
          category === "สินทรัพย์"
            ? "สินทรัพย์"
            : category === "ค่าใช้จ่ายอื่น"
              ? "ค่าใช้จ่ายอื่น"
              : "วัตถุดิบ",
        item,
        location: isChili ? "คลัง Owner" : "บัญชี Owner",
        quantity: fmt(
          isChili
            ? ownerChiliStock(db)
            : history.reduce(
                (sum, entry) => sum + n(entry.values, "quantity"),
                0,
              ),
        ),
        unit: latest?.values.unit || defaultUnit,
        detail: latest
          ? isChili
            ? `ซื้อเข้า ${fmt(history.reduce((sum, entry) => sum + n(entry.values, "quantity"), 0))} หลอด · จัดสรรไปสาขา ${fmt(entries(db, "chiliAllocate").reduce((sum, entry) => sum + n(entry.values, "chiliTubes"), 0))} หลอด`
            : `ซื้อสะสม ${history.length} รายการ · ล่าสุด ${latest.values.purchaseDate || latest.date}`
          : isChili && ownerChiliStock(db) > 0
            ? "ยอดคงเหลือเดิมจากข้อมูลทดลอง · การซื้อครั้งถัดไปให้บันทึกผ่านการซื้ออื่น ๆ"
            : "ยังไม่มีประวัติการซื้อ",
      };
    }),
    ...materials.flatMap((material, index) => {
      const lastPurchase = entries(db, "materialReceive")
        .filter((entry) => entry.values.material === material)
        .at(-1);
      return [
        {
          genre: "วัสดุบรรจุภัณฑ์",
          item: material,
          location: "คลัง Owner",
          quantity: fmt(ownerMaterialStock(db, material)),
          unit: "ชิ้น",
          detail: lastPurchase
            ? `ซื้อล่าสุด ${lastPurchase.values.purchaseDate || lastPurchase.date} · ฿${fmt(n(lastPurchase.values, "unitPrice"))} / ชิ้น`
            : "ยังไม่มีประวัติการซื้อ",
        },
        ...branches.map((branchName) => ({
          genre: "วัสดุบรรจุภัณฑ์",
          item: material,
          location: branchName,
          quantity: fmt(branchMaterialStock(db, branchName, index)),
          unit: "ชิ้น",
          detail: `ฐาน ${fmt(materialPar(db, branchName, index))} · ฿${fmt(materialUnitPrice(db, branchName, index))} / ชิ้น`,
        })),
      ];
    }),
  ];
  const visibleRows = rows.filter(
    (row) =>
      (genre === "ทั้งหมด" || row.genre === genre) &&
      (location === "ทั้งหมด" || row.location === location) &&
      (itemFilter === "ทั้งหมด" ||
        row.meatType === itemFilter ||
        row.item === itemFilter),
  );
  // Oldest first, the order DataTable's sort expects; the table flips it.
  const purchases = [
    ...entries(db, "materialReceive").map((entry) => ({
      date: entry.values.purchaseDate || entry.date,
      at: entry.at,
      category: "วัสดุบรรจุภัณฑ์",
      item: entry.values.material,
      quantity: n(entry.values, "quantity"),
      unit: "ชิ้น",
      unitPrice: n(entry.values, "unitPrice"),
      totalCost: n(entry.values, "totalCost"),
      supplier: entry.values.supplier,
      reference: entry.values.reference || "—",
    })),
    ...entries(db, "generalPurchase").map((entry) => ({
      date: entry.values.purchaseDate || entry.date,
      at: entry.at,
      category: purchaseGroup(entry.values.purchaseCategory),
      item: entry.values.item,
      quantity: n(entry.values, "quantity"),
      unit: entry.values.unit || "—",
      unitPrice: n(entry.values, "unitPrice"),
      totalCost: n(entry.values, "totalCost"),
      supplier: entry.values.supplier,
      reference: entry.values.reference || "—",
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));
  const visiblePurchases = purchases.filter(
    (purchase) =>
      (genre === "ทั้งหมด" ||
        (genre === "วัสดุบรรจุภัณฑ์" &&
          purchase.category === "วัสดุบรรจุภัณฑ์") ||
        (genre === "วัตถุดิบ" && purchase.category === "วัตถุดิบ") ||
        (genre === "สินทรัพย์" && purchase.category === "สินทรัพย์") ||
        (genre === "ค่าใช้จ่ายอื่น" &&
          purchase.category === "ค่าใช้จ่ายอื่น")) &&
      (itemFilter === "ทั้งหมด" || purchase.item === itemFilter),
  );
  const itemOptions =
    genre === "เนื้อ"
      ? meatTypeOptions
      : Array.from(
          new Set([
            ...(genre === "ทั้งหมด" ? meatTypeOptions : []),
            ...rows
              .filter(
                (row) =>
                  row.genre !== "เนื้อ" &&
                  (genre === "ทั้งหมด" || row.genre === genre),
              )
              .map((row) => row.item),
          ]),
        ).sort((a, b) => a.localeCompare(b, "th"));
  return (
    <div className="grid gap-6">
      <DataTable
        title="ตารางสต๊อกทั้งหมด (All inventory)"
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
                {genreOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </TableFilter>
            <TableFilter
              label={
                genre === "เนื้อ"
                  ? "ประเภทเนื้อ"
                  : genre === "ทั้งหมด"
                    ? "รายการ / ประเภทเนื้อ"
                    : "รายการ"
              }
            >
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
            <TableFilter label="สถานที่">
              <Select
                variant="filter"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              >
                {locationOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </TableFilter>
          </FilterBar>
        }
        columns={inventoryColumns}
        rows={visibleRows.map((row) => [
          row.genre,
          row.item,
          row.location,
          row.quantity,
          row.unit,
          row.detail,
          row.action || "—",
        ])}
      />
      {visiblePurchases.length > 0 && (
        <DataTable
          title={`ประวัติการซื้อและบัญชี · ต้นทุนซื้อเข้าที่แสดง ฿${fmt(visiblePurchases.reduce((total, purchase) => total + purchase.totalCost, 0))}`}
          columns={purchaseColumns}
          rows={visiblePurchases.map((purchase) => [
            purchase.date,
            purchase.category,
            purchase.item,
            `${fmt(purchase.quantity)} ${purchase.unit}`,
            `฿${fmt(purchase.unitPrice)}`,
            `฿${fmt(purchase.totalCost)}`,
            purchase.supplier,
            purchase.reference,
          ])}
        />
      )}
    </div>
  );
}
