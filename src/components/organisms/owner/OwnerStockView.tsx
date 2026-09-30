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
  rawAtFoodiva,
  rawRiceStock,
  reservedForOwnerContent,
  type Database,
  type Lot,
  type EntryKind,
} from "@/lib/store";
import { fmt } from "@/lib/format";
import { byDateAt } from "@/lib/store/derived";

// Assets and other expenses are not stock: they live in the purchase history below.
const genreOptions = ["ทั้งหมด", "เนื้อ", "วัตถุดิบ", "วัสดุบรรจุภัณฑ์"];
// One column per place stock sits. Smoked beef waiting for allocation is kept at
// Foodiva; everything the Owner holds (materials, chili tubes, received waste) is one
// place, "คลัง Owner".
const stockLocations = ["Foodiva", "คลัง Owner", ...branches];
const meatTypeOptions = [
  "เนื้อดิบพร้อมส่ง Chef House",
  "เนื้อรมควัน",
  "เนื้อส่วนที่เหลือ (Waste)",
];
// Fixed widths: filtering must not make the columns jump around.
const leadColumns = [
  ["กลุ่ม", "9.5rem"],
  ["รายการ / Lot", "16rem"],
  ["หน่วย", "5rem"],
];
const locationWidth = "7rem";
const tailColumns = [
  ["รายละเอียด", "18rem"],
  ["การทำงาน", "10rem"],
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

/** One row per item; `at` holds its quantity per location, and a location with no key
 *  has no stock of this kind at all ("—"). `tips` is the cell's tooltip. */
type StockRow = {
  genre: string;
  item: string;
  unit: string;
  at: Partial<Record<string, number>>;
  tips?: Partial<Record<string, string>>;
  detail: string;
  meatType?: string;
  action?: ReactNode;
};

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
  open: (kind: EntryKind, lotId?: string) => void;
}) {
  const [genre, setGenre] = useState("ทั้งหมด");
  const [location, setLocation] = useState("ทั้งหมด");
  const [itemFilter, setItemFilter] = useState("ทั้งหมด");
  const chiliPurchases = entries(db, "generalPurchase").filter(
    (entry) => entry.values.item === "น้ำพริกหลอด",
  );
  const lastChiliPurchase = chiliPurchases.at(-1);
  const rows: StockRow[] = [
    ...lots.flatMap((lot): StockRow[] => {
      const invoiceConfirmed = entries(db, "foodivaConfirm", lot.id).length > 0;
      const central = Math.max(0, centralStock(db, lot.id));
      // Raw beef sits on the purchase PO until a shipment trucks it; smoked beef on the shipment.
      const readyAtFoodiva = rawAtFoodiva(db, lot);
      const ownerReserved = reservedForOwnerContent(db, lot.id);
      const ownerWaiting = ownerWasteOutstanding(db, lot.id);
      const ownerReceived = ownerWasteReceived(db, lot.id);
      if (!lot.kind)
        return [
          {
            genre: "เนื้อ",
            item: `${lot.id} · เนื้อดิบพร้อมส่ง Chef House`,
            unit: "กก.",
            at: { Foodiva: readyAtFoodiva },
            detail: invoiceConfirmed
              ? "จาก Invoice Foodiva · รอส่งไป Chef House"
              : "ตามยอดสั่ง · รอ Foodiva ยืนยัน Invoice",
            meatType: "เนื้อดิบพร้อมส่ง Chef House",
          },
          ...(invoiceConfirmed
            ? [
                {
                  genre: "เนื้อ",
                  item: `${lot.id} · เนื้อส่วนที่เหลือ (Waste)`,
                  unit: "กก.",
                  at: { Foodiva: ownerWaiting, "คลัง Owner": ownerReceived },
                  tips: {
                    Foodiva: "รอ Owner รับ",
                    "คลัง Owner": "Owner รับแล้ว สำหรับใช้งาน Owner",
                  },
                  detail: `จาก Invoice ${fmt(ownerReserved)} กก. · Owner รับแล้ว ${fmt(ownerReceived)} กก.`,
                  meatType: "เนื้อส่วนที่เหลือ (Waste)",
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
              ]
            : []),
        ];
      const branchStock = branches.map((branchName) => ({
        branchName,
        stock: balance(db, lot.id, branchName),
      }));
      return [
        {
          genre: "เนื้อ",
          item: `${lot.id} · เนื้อรมควัน`,
          unit: "กก.",
          at: {
            Foodiva: central,
            ...Object.fromEntries(
              branchStock.map(({ branchName, stock }) => [
                branchName,
                stock.frozen + stock.ready,
              ]),
            ),
          },
          tips: {
            Foodiva: "รับเข้าสต๊อกกลางแล้ว รอสาขารับ",
            ...Object.fromEntries(
              branchStock.map(({ branchName, stock }) => [
                branchName,
                `แช่แข็ง ${fmt(stock.frozen)} · ชิล/ละลายแล้ว ${fmt(stock.ready)}`,
              ]),
            ),
          },
          detail: `${fmt(central)} กก. พร้อมให้สาขารับ · สาขา = แช่แข็ง + ชิล/ละลายแล้ว`,
          meatType: "เนื้อรมควัน",
        },
      ];
    }),
    // DASH-06: branch meat recorded with no lot is stock too, until a `link` moves it.
    ...(branches.some((branchName) => balance(db, "", branchName).received)
      ? [
          {
            genre: "เนื้อ",
            item: "ไม่ระบุ Lot · เนื้อรมควัน",
            unit: "กก.",
            at: Object.fromEntries(
              branches.map((branchName) => {
                const stock = balance(db, "", branchName);
                return [branchName, stock.frozen + stock.ready];
              }),
            ),
            tips: Object.fromEntries(
              branches.map((branchName) => {
                const stock = balance(db, "", branchName);
                return [
                  branchName,
                  `แช่แข็ง ${fmt(stock.frozen)} · ชิล/ละลายแล้ว ${fmt(stock.ready)}`,
                ];
              }),
            ),
            detail: "สาขารับเนื้อโดยยังไม่ผูก Lot · ผูกได้จากประวัติรายการ",
            meatType: "เนื้อรมควัน",
          } satisfies StockRow,
        ]
      : []),
    {
      genre: "วัตถุดิบ",
      item: "ข้าวเหนียวดิบ (ข้าวสาร)",
      unit: "กก.",
      at: Object.fromEntries(
        branches.map((branchName) => [
          branchName,
          rawRiceStock(db, branchName),
        ]),
      ),
      tips: Object.fromEntries(
        branches.map((branchName) => [
          branchName,
          `เบิกแล้ว ${fmt(issuedRawRiceStock(db, branchName))} กก.`,
        ]),
      ),
      detail: "ข้าวสารคงเหลือที่สาขา",
    },
    {
      genre: "วัตถุดิบ",
      item: "ข้าวเหนียวสุก",
      unit: "กก.",
      at: Object.fromEntries(
        branches.map((branchName) => [
          branchName,
          cookedRiceStock(db, branchName),
        ]),
      ),
      detail: "ข้าวสุกของวันนี้ · ไม่ยกไปวันถัดไป เหลือปลายวันเป็นของเสีย",
    },
    {
      genre: "วัตถุดิบ",
      item: "น้ำพริกหลอด",
      unit: lastChiliPurchase?.values.unit || "หลอด",
      at: {
        "คลัง Owner": ownerChiliStock(db),
        ...Object.fromEntries(
          branches.map((branchName) => [
            branchName,
            chiliStock(db, branchName),
          ]),
        ),
      },
      tips: Object.fromEntries(
        branches.map((branchName) => [
          branchName,
          `Owner จัดสรร ${fmt(chiliAllocated(db, branchName))} หลอด · ตัดสต๊อกแล้ว ${fmt(chiliSold(db, branchName))} หลอด`,
        ]),
      ),
      detail: lastChiliPurchase
        ? `ซื้อเข้า ${fmt(chiliPurchases.reduce((sum, entry) => sum + n(entry.values, "quantity"), 0))} หลอด · จัดสรรไปสาขา ${fmt(entries(db, "chiliAllocate").reduce((sum, entry) => sum + n(entry.values, "chiliTubes"), 0))} หลอด`
        : ownerChiliStock(db) > 0
          ? "ยอดคงเหลือเดิมจากข้อมูลทดลอง · การซื้อครั้งถัดไปให้บันทึกผ่านการซื้ออื่น ๆ"
          : "ยังไม่มีประวัติการซื้อ",
    },
    ...materials.map((material, index) => {
      const lastPurchase = entries(db, "materialReceive")
        .filter((entry) => entry.values.material === material)
        .at(-1);
      return {
        genre: "วัสดุบรรจุภัณฑ์",
        item: material,
        unit: "ชิ้น",
        at: {
          "คลัง Owner": ownerMaterialStock(db, material),
          ...Object.fromEntries(
            branches.map((branchName) => [
              branchName,
              branchMaterialStock(db, branchName, index),
            ]),
          ),
        },
        tips: Object.fromEntries(
          branches.map((branchName) => [
            branchName,
            `ฐาน ${fmt(materialPar(db, branchName, index))} · ฿${fmt(materialUnitPrice(db, branchName, index))} / ชิ้น`,
          ]),
        ),
        detail: lastPurchase
          ? `ซื้อล่าสุด ${lastPurchase.values.purchaseDate || lastPurchase.date} · ฿${fmt(n(lastPurchase.values, "unitPrice"))} / ชิ้น`
          : "ยังไม่มีประวัติการซื้อ",
      };
    }),
  ];
  const filteredRows = rows.filter(
    (row) =>
      (genre === "ทั้งหมด" || row.genre === genre) &&
      (itemFilter === "ทั้งหมด" ||
        row.meatType === itemFilter ||
        row.item === itemFilter),
  );
  // Only places that hold something the other filters kept; a place that drops out
  // of the list sends the filter back to ทั้งหมด.
  const locationOptions = [
    "ทั้งหมด",
    ...stockLocations.filter((place) =>
      filteredRows.some((row) => row.at[place] !== undefined),
    ),
  ];
  const activeLocation = locationOptions.includes(location)
    ? location
    : "ทั้งหมด";
  if (activeLocation !== location) setLocation(activeLocation);
  const shownLocations =
    activeLocation === "ทั้งหมด" ? stockLocations : [activeLocation];
  const visibleRows = filteredRows.filter((row) =>
    shownLocations.some((place) => row.at[place] !== undefined),
  );
  const inventoryColumns = [
    ...leadColumns,
    ...shownLocations.map((place) => [place, locationWidth]),
    ...tailColumns,
  ];
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
  ].sort(byDateAt);
  const visiblePurchases = purchases.filter(
    (purchase) =>
      (genre === "ทั้งหมด" ||
        (genre === "วัสดุบรรจุภัณฑ์" &&
          purchase.category === "วัสดุบรรจุภัณฑ์") ||
        (genre === "วัตถุดิบ" && purchase.category === "วัตถุดิบ")) &&
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
                value={activeLocation}
                onChange={(event) => setLocation(event.target.value)}
              >
                {locationOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </TableFilter>
          </FilterBar>
        }
        columns={inventoryColumns.map(([column]) => column)}
        columnWidths={inventoryColumns.map(([, width]) => width)}
        defaultSort={{ column: "กลุ่ม" }}
        rows={visibleRows.map((row) => [
          row.genre,
          row.item,
          row.unit,
          ...shownLocations.map((place) => {
            const quantity = row.at[place];
            if (quantity === undefined) return "—";
            const tip = row.tips?.[place];
            return tip ? (
              <span title={tip}>{fmt(quantity)}</span>
            ) : (
              fmt(quantity)
            );
          }),
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
