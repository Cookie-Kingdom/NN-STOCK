"use client";

import { useState } from "react";
import { Select } from "@/components/atoms/Select";
import { PanelHeading } from "@/components/molecules/PanelHeading";
import { TableFilter } from "@/components/molecules/TableFilter";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  balance,
  branches,
  centralStock,
  entries,
  n,
  ownerWasteOutstanding,
  ownerWasteReceived,
  packingListKg,
  produced,
  producedBags,
  purchaseLots,
  rawAtFoodiva,
  preSmokeTrimKg,
  rawAtSmoker,
  shipments,
  type Database,
  type Entry,
  type EntryKind,
  STAGE,
} from "@/lib/store";
import { fmt } from "@/lib/format";

const locationColumns = ["PO", "Lot", "จุดเก็บ", "คงเหลือ", "รายละเอียด"];
const movementColumns = [
  "วันที่",
  "เวลา",
  "Lot",
  "จุดดำเนินการ",
  "รายการ",
  "น้ำหนัก / รายละเอียด",
];

/** entry kind → [location, action, amount] */
const descriptions: Record<
  string,
  (entry: Entry, db: Database) => [string, string, string]
> = {
  foodivaConfirm: (entry) => [
    "Foodiva",
    "ยืนยัน Invoice และแบ่งเนื้อ",
    `Invoice ${fmt(n(entry.values, "confirmedKg"))} · ส่งเชียงใหม่ ${fmt(n(entry.values, "readyForChiangMaiKg"))} · รอ Owner รับ (Waste) ${fmt(n(entry.values, "reservedForOwnerKg"))} กก.`,
  ],
  ownerWasteReceive: (entry) => [
    "Owner",
    "รับเนื้อส่วนที่เหลือจาก Foodiva",
    `${fmt(n(entry.values, "receivedKg"))} กก. · ${entry.values.receiver}`,
  ],
  // What went is the Packing List box total; the Request kg until Foodiva makes one.
  dispatch: (entry, db) => {
    const sent = packingListKg(db, entry.lotId);
    return [
      "Foodiva → Chef House",
      "ส่งเนื้อดิบ",
      sent === undefined
        ? `ขอใน Request ${fmt(n(entry.values, "dispatchKg"))} กก.`
        : `${fmt(sent)} กก. (Packing List)`,
    ];
  },
  cmReceive: (entry) => [
    "Chef House",
    "ชั่งรับเนื้อจริง",
    `${fmt(n(entry.values, "receivedKg"))} กก.`,
  ],
  smoke: (entry) => [
    "Chef House",
    `สโมครอบ ${entry.values.subLot || "—"}`,
    `เข้าเตา ${fmt(n(entry.values, "inputKg"))} · หลังรม ${fmt(n(entry.values, "postSmokeKg"))} · Waste ${fmt(n(entry.values, "wasteKg"))} กก.`,
  ],
  return: (entry) => [
    "Chef House → Foodiva",
    "เรียกรถขากลับ",
    `${fmt(n(entry.values, "returnKg"))} กก.`,
  ],
  foodivaReturnReceive: (entry) => [
    "Foodiva",
    "รับเนื้อรมควันเข้าตู้",
    `${fmt(n(entry.values, "receivedKg"))} กก.`,
  ],
  central: (entry) => [
    "คลังกลาง Owner",
    "รับเข้าสต๊อกกลาง",
    `${fmt(n(entry.values, "centralKg"))} กก.`,
  ],
  allocate: (entry) => [
    "Owner → สาขา",
    `จัดสรรไป ${entry.values.branch}`,
    `${fmt(n(entry.values, "kg"))} กก.`,
  ],
  receive: (entry) => [
    entry.branch || "สาขา",
    "รับเนื้อเข้าสาขา",
    `${fmt(n(entry.values, "kg"))} กก.`,
  ],
  thaw: (entry) => [
    entry.branch || "สาขา",
    "แบ่งละลาย",
    `${fmt(n(entry.values, "kg"))} กก.`,
  ],
  sale: (entry) => [
    entry.branch || "สาขา",
    "ตัดสต๊อกจากยอดขาย",
    `ขาย ${fmt(n(entry.values, "soldKg"))} · Waste ${fmt(n(entry.values, "wasteKg"))} กก.`,
  ],
};

export function MeatMovementLogView({ db }: { db: Database }) {
  const [lotFilter, setLotFilter] = useState("ทั้งหมด");
  // Raw beef is tracked on purchase POs, everything from the truck on on shipments.
  const allLots = [...purchaseLots(db), ...shipments(db)];
  const lots = allLots.filter(
    (lot) => lotFilter === "ทั้งหมด" || lot.id === lotFilter,
  );
  const locationRows = lots.flatMap((lot) => {
    const returnReceived = n(
      entries(db, "foodivaReturnReceive", lot.id).at(-1)?.values || {},
      "receivedKg",
    );
    const foodivaSmoked = Math.max(
      0,
      returnReceived - n(lot.values, "centralKg"),
    );
    const chefSmoked =
      lot.stage === STAGE.return && !entries(db, "return", lot.id).length
        ? produced(db, lot.id)
        : 0;
    if (!lot.kind)
      return [
        [
          lot.poId,
          lot.id,
          "Foodiva · เนื้อดิบ",
          `${fmt(rawAtFoodiva(db, lot))} กก.`,
          "คงเหลือจาก PO ก่อนส่ง Chef House",
        ],
        [
          lot.poId,
          lot.id,
          "Foodiva · เนื้อส่วนที่เหลือรอ Owner รับ (Waste)",
          `${fmt(ownerWasteOutstanding(db, lot.id))} กก.`,
          `Owner รับแล้ว ${fmt(ownerWasteReceived(db, lot.id))} กก.`,
        ],
        [
          lot.poId,
          lot.id,
          "Owner · เนื้อส่วนที่รับแล้ว (Waste)",
          `${fmt(ownerWasteReceived(db, lot.id))} กก.`,
          "รับจาก Foodiva สำหรับใช้งาน Owner",
        ],
      ];
    return [
      [
        lot.poId,
        lot.id,
        "Chef House · รอเข้ารอบสโมค",
        `${fmt(rawAtSmoker(db, lot))} กก.`,
        "น้ำหนักรับจริง หัก Waste ก่อนสโมค และรอบที่สโมคแล้ว",
      ],
      [
        lot.poId,
        lot.id,
        "Chef House · Waste ก่อนสโมค",
        `${fmt(preSmokeTrimKg(db, lot))} กก.`,
        "น้ำหนักรับจริง หักน้ำหนักก่อนสโมค (ตัดแต่ง)",
      ],
      [
        lot.poId,
        lot.id,
        "Chef House · เนื้อรมพร้อมเรียกรถ",
        `${fmt(chefSmoked)} กก.`,
        chefSmoked > 0
          ? `${producedBags(db, lot.id)} กล่องรมควัน · ปิด Lot แล้ว`
          : "—",
      ],
      [
        lot.poId,
        lot.id,
        "Foodiva · เนื้อรมควัน",
        `${fmt(foodivaSmoked)} กก.`,
        foodivaSmoked > 0
          ? "รับจาก Chef House แล้ว รอ Owner รับเข้าสต๊อกกลาง"
          : "—",
      ],
      [
        lot.poId,
        lot.id,
        "คลังกลาง Owner",
        `${fmt(centralStock(db, lot.id))} กก.`,
        `${fmt(centralStock(db, lot.id))} กก. พร้อมจัดสรร`,
      ],
      ...branches.map((branchName) => {
        const stock = balance(db, lot.id, branchName);
        return [
          lot.poId,
          lot.id,
          branchName,
          `${fmt(stock.frozen + stock.ready)} กก.`,
          `แช่แข็ง ${fmt(stock.frozen)} · ชิล/ละลายแล้ว ${fmt(stock.ready)}`,
        ];
      }),
    ];
  });
  const movementRows = Object.keys(descriptions)
    .flatMap((kind) => entries(db, kind as EntryKind))
    .filter((entry) => lotFilter === "ทั้งหมด" || entry.lotId === lotFilter)
    // Oldest first, the order DataTable's sort expects; the table flips it.
    .sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))
    .map((entry) => {
      const [location, action, amount] = descriptions[entry.kind](entry, db);
      return [
        entry.date,
        entry.at.slice(11, 16),
        entry.lotId,
        location,
        action,
        amount,
      ];
    });
  return (
    <div className="grid gap-6">
      <PanelHeading
        overline="OWNER · BEEF TRACE"
        title="Log เนื้อคงเหลือ"
        description="ดูเนื้อคงเหลือราย Lot ในทุกจุด และลำดับการเคลื่อนไหวตั้งแต่ Foodiva ถึงสาขา"
      />
      <DataTable
        title="เนื้อคงเหลือแยกตามจุด"
        action={
          <TableFilter label="Lot">
            <Select
              variant="filter"
              value={lotFilter}
              onChange={(event) => setLotFilter(event.target.value)}
            >
              <option>ทั้งหมด</option>
              {allLots.map((lot) => (
                <option key={lot.id}>{lot.id}</option>
              ))}
            </Select>
          </TableFilter>
        }
        columns={locationColumns}
        rows={locationRows}
      />
      <DataTable
        title="ประวัติการเคลื่อนไหวเนื้อ"
        defaultSort={{ column: "วันที่", desc: true }}
        columns={movementColumns}
        rows={movementRows}
      />
    </div>
  );
}
