"use client";

import { fmt } from "@/lib/format";
import type { Tab } from "@/lib/nav";
import {
  centralStock,
  type Database,
  entries,
  materialPar,
  materialUnitPrice,
  materials,
  produced,
  producedBags,
  readyForChefHouse,
  smokingInvoiceStatus,
} from "@/lib/store";

export type OwnerNotification = { title: string; detail: string; tab: Tab };

/** Every "someone is waiting on the owner" signal, derived from lot state. */
export function useOwnerAlerts(db: Database) {
  const missingMaterialSettings = materials.filter(
    (_, index) =>
      materialPar(db, "ศาลาแดง", index) <= 0 ||
      materialUnitPrice(db, "ศาลาแดง", index) <= 0,
  ).length;

  const transportCount = db.lots.filter(
    (lot) => lot.stage === 1 || lot.stage === 6,
  ).length;
  const returnReady = db.lots.filter(
    (lot) => lot.stage === 6 && !entries(db, "return", lot.id).length,
  );
  const centralReceiveCount = db.lots.filter(
    (lot) =>
      lot.stage === 7 && entries(db, "foodivaReturnReceive", lot.id).length,
  ).length;
  const allocationCount = db.lots.filter(
    (lot) => lot.stage >= 8 && centralStock(db, lot.id) > 0.001,
  ).length;
  const billingCount = entries(db, "smokingInvoice").filter(
    (invoice) => smokingInvoiceStatus(db, invoice) === "รอตรวจยอด",
  ).length;
  const foodivaInvoiceCount = db.lots.filter(
    (lot) =>
      entries(db, "foodivaConfirm", lot.id).length > 0 &&
      !entries(db, "smokeOrder", lot.id).length,
  ).length;

  const notifications: OwnerNotification[] = [
    ...db.lots.flatMap((item): OwnerNotification[] => {
      const foodInvoice = entries(db, "foodivaConfirm", item.id).at(-1);
      const smokeOrder = entries(db, "smokeOrder", item.id).at(-1);
      const accepted = entries(db, "smokeOrderAccept", item.id).at(-1);
      const smokeInvoice = entries(db, "smokingInvoice", item.id).at(-1);
      if (!foodInvoice)
        return [
          {
            title: `รอ Foodiva ออก Invoice · ${item.id}`,
            detail: "ติดตาม Foodiva ให้ยืนยันน้ำหนักและแนบ Invoice เนื้อ",
            tab: "po",
          },
        ];
      if (!smokeOrder)
        return [
          {
            title: `Foodiva ออก Invoice แล้ว · ${item.id}`,
            detail: `Owner ต้องออก PO โรงรมควันต่อ · พร้อมส่งเชียงใหม่ ${fmt(readyForChefHouse(db, item.id))} กก.`,
            tab: "smoke-po",
          },
        ];
      if (!accepted)
        return [
          {
            title: `รอ Chef_house ยืนยัน PO โรงรมควัน · ${item.id}`,
            detail: "Chef_house ต้องกดยืนยันรับ PO ก่อน Owner เรียกรถส่งเนื้อ",
            tab: "smoke-po",
          },
        ];
      if (!smokeInvoice)
        return [
          {
            title: `รอ Chef_house Submit Invoice ค่ารมควัน · ${item.id}`,
            detail: "รอเลข Invoice และไฟล์แนบเพื่อให้ Owner ตรวจยอด",
            tab: "invoices",
          },
        ];
      const invoiceStatus = smokingInvoiceStatus(db, smokeInvoice);
      if (invoiceStatus === "รอตรวจยอด")
        return [
          {
            title: `รอตรวจ Invoice ค่ารมควัน · ${smokeInvoice.values.invoiceNumber}`,
            detail: `ตรวจยอด Lot ${item.id} ก่อนชำระและเรียกรถ`,
            tab: "invoices",
          },
        ];
      if (invoiceStatus === "รอชำระ")
        return [
          {
            title: `รอชำระ Invoice ค่ารมควัน · ${smokeInvoice.values.invoiceNumber}`,
            detail: `ชำระเงิน Lot ${item.id} ก่อนทำใบขนส่งขาไป`,
            tab: "invoices",
          },
        ];
      if (invoiceStatus === "ส่งกลับแก้ไข")
        return [
          {
            title: `รอ Chef_house แก้ Invoice · ${smokeInvoice.values.invoiceNumber}`,
            detail: "Owner ส่งกลับแก้ไขแล้ว รอ Chef_house Submit ใหม่",
            tab: "invoices",
          },
        ];
      if (item.stage === 1)
        return [
          {
            title: `พร้อมทำใบขนส่งไป Chef_house · ${item.id}`,
            detail: `เรียกรถรับเนื้อพร้อมส่ง ${fmt(readyForChefHouse(db, item.id))} กก.`,
            tab: "transport",
          },
        ];
      if (
        item.stage === 7 &&
        !entries(db, "foodivaReturnReceive", item.id).length
      )
        return [
          {
            title: `รอ Foodiva รับเนื้อรมควัน · ${item.id}`,
            detail: "ติดตาม Foodiva ให้ชั่งรับเนื้อจาก Chef_house เข้าตู้",
            tab: "transport",
          },
        ];
      return [];
    }),
    ...returnReady.map((item): OwnerNotification => ({
      title: `Chef_house ปิด Lot แล้ว · ${item.id}`,
      detail: `เรียกรถขากลับ ${fmt(produced(db, item.id))} กก. · ${producedBags(db, item.id)} ถุง`,
      tab: "transport",
    })),
    ...(centralReceiveCount
      ? [
          {
            title: `Foodiva รับเนื้อรมควันแล้ว ${centralReceiveCount} Lot`,
            detail: "รับเนื้อเข้าสต๊อกกลางก่อนจัดสรรไปสาขา",
            tab: "central-receive" as Tab,
          },
        ]
      : []),
    ...(allocationCount
      ? [
          {
            title: `มีเนื้อพร้อมจัดสรร ${allocationCount} Lot`,
            detail: "เลือกสาขาและจัดสรรเนื้อจากคลังกลาง",
            tab: "branch-status" as Tab,
          },
        ]
      : []),
    ...(missingMaterialSettings
      ? [
          {
            title: `ตั้งค่าวัสดุยังไม่ครบ ${missingMaterialSettings} รายการ`,
            detail: "กำหนดจำนวนฐานและราคาต่อหน่วยก่อนใช้งานจริง",
            tab: "config" as Tab,
          },
        ]
      : []),
  ];

  return {
    notifications,
    missingMaterialSettings,
    returnReady,
    badges: {
      transport: transportCount,
      invoices: billingCount,
      "smoke-po": foodivaInvoiceCount,
      "central-receive": centralReceiveCount,
      "branch-status": allocationCount,
      config: missingMaterialSettings,
    } satisfies Partial<Record<Tab, number>>,
  };
}
