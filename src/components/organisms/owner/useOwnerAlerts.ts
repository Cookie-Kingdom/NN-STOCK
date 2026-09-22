"use client";

import { editRequestAlerts } from "@/components/organisms/workspace/editRequestAlerts";
import { fmt } from "@/lib/format";
import type { Tab } from "@/lib/nav";
import {
  centralStock,
  type Database,
  entries,
  latestPackingList,
  materialPar,
  materialUnitPrice,
  materials,
  produced,
  n,
  ownerPendingInvoices,
  producedBags,
  purchaseLots,
  shipments,
  smokingInvoiceStatus,
} from "@/lib/store";

export type OwnerNotification = { title: string; detail: string; tab: Tab };

/** What the owner is shown before the first payload lands. Until then the UI is
 * still on the seed, and a signal read off it is an alarm nobody can act on. */
export const noOwnerAlerts = {
  notifications: [] as OwnerNotification[],
  missingMaterialSettings: 0,
  returnReady: [] as Database["lots"],
  badges: {} as Partial<Record<Tab, number>>,
};

/** Every "someone is waiting on the owner" signal, derived from lot state. */
export function useOwnerAlerts(db: Database) {
  const missingMaterialSettings = materials.filter(
    (_, index) =>
      materialPar(db, "ศาลาแดง", index) <= 0 ||
      materialUnitPrice(db, "ศาลาแดง", index) <= 0,
  ).length;

  const shipmentLots = shipments(db);
  const transportCount = shipmentLots.filter(
    (lot) => lot.stage === 1 || lot.stage === 6,
  ).length;
  const returnReady = shipmentLots.filter(
    (lot) => lot.stage === 6 && !entries(db, "return", lot.id).length,
  );
  const centralReceiveCount = shipmentLots.filter(
    (lot) =>
      lot.stage === 7 && entries(db, "foodivaReturnReceive", lot.id).length,
  ).length;
  const allocationCount = shipmentLots.filter(
    (lot) => lot.stage >= 8 && centralStock(db, lot.id) > 0.001,
  ).length;
  // Invoices the owner has to act on, the same ones the bell lists: a Foodiva meat invoice
  // still unpaid, a Chef House smoking invoice to review or to pay.
  const pendingInvoices = ownerPendingInvoices(db);
  const { unpaidMeatLots } = pendingInvoices;
  const billingCount = pendingInvoices.total;
  const packedCount = shipmentLots.filter(
    (lot) =>
      latestPackingList(db, lot.id) &&
      !entries(db, "smokeOrder", lot.id).length,
  ).length;

  const editAlerts = editRequestAlerts(db, "owner", "");
  const notifications: OwnerNotification[] = [
    ...editAlerts,
    ...purchaseLots(db).flatMap((item): OwnerNotification[] =>
      entries(db, "foodivaConfirm", item.id).length
        ? []
        : [
            {
              title: `รอ Foodiva ออก Invoice · ${item.id}`,
              detail: "ติดตาม Foodiva ให้ยืนยันน้ำหนักและแนบ Invoice เนื้อ",
              tab: "po",
            },
          ],
    ),
    ...shipmentLots.flatMap((item): OwnerNotification[] => {
      const packingList = latestPackingList(db, item.id);
      const smokeOrder = entries(db, "smokeOrder", item.id).at(-1);
      const accepted = entries(db, "smokeOrderAccept", item.id).at(-1);
      const smokeInvoice = entries(db, "smokingInvoice", item.id).at(-1);
      if (item.stage === 1)
        return [
          {
            title: `รอ Foodiva ทำใบขนส่ง · ${item.poId}`,
            detail: `Request ส่งเนื้อ ${fmt(n(item.values, "requestedKg"))} กก. ไป Chef House`,
            tab: "transport",
          },
        ];
      if (!packingList)
        return [
          {
            title: `รอ Foodiva ทำ Packing List · ${item.poId}`,
            detail: "ต้องมี Packing List ก่อน Owner ออก PO รมควัน",
            tab: "smoke-po",
          },
        ];
      if (!smokeOrder)
        return [
          {
            title: `Packing List พร้อมแล้ว · ${item.poId}`,
            detail: `ออก PO รมควัน · ${packingList.values.boxCount} กล่องรับเข้า · ${fmt(n(packingList.values, "slicedNetKg"))} กก.`,
            tab: "smoke-po",
          },
        ];
      if (!accepted)
        return [
          {
            title: `รอ Chef House ยืนยัน PO โรงรมควัน · ${item.poId}`,
            detail: "Chef House ต้องกดยืนยันรับ PO ก่อนรับเนื้อเข้า",
            tab: "smoke-po",
          },
        ];
      // Stages 2–5: Chef House is working; the smoking invoice only comes once the run is closed.
      if (item.stage < 6) return [];
      if (!smokeInvoice)
        return [
          {
            title: `รอ Chef House Submit Invoice ค่ารมควัน · ${item.poId}`,
            detail: "รอเลข Invoice และไฟล์แนบเพื่อให้ Owner ตรวจยอด",
            tab: "invoices",
          },
        ];
      const invoiceStatus = smokingInvoiceStatus(db, smokeInvoice);
      if (invoiceStatus === "รอตรวจยอด")
        return [
          {
            title: `รอตรวจ Invoice ค่ารมควัน · ${smokeInvoice.values.invoiceNumber}`,
            detail: `ตรวจยอดการส่ง ${item.poId} ก่อนชำระ`,
            tab: "invoices",
          },
        ];
      if (invoiceStatus === "รอชำระ")
        return [
          {
            title: `รอชำระ Invoice ค่ารมควัน · ${smokeInvoice.values.invoiceNumber}`,
            detail: `ชำระเงินค่ารมควันการส่ง ${item.poId}`,
            tab: "invoices",
          },
        ];
      if (invoiceStatus === "ส่งกลับแก้ไข")
        return [
          {
            title: `รอ Chef House แก้ Invoice · ${smokeInvoice.values.invoiceNumber}`,
            detail: "Owner ส่งกลับแก้ไขแล้ว รอ Chef House Submit ใหม่",
            tab: "invoices",
          },
        ];
      if (
        item.stage === 7 &&
        !entries(db, "foodivaReturnReceive", item.id).length
      )
        return [
          {
            title: `รอ Foodiva รับเนื้อรมควัน · ${item.poId}`,
            detail: "ติดตาม Foodiva ให้ชั่งรับเนื้อจาก Chef House เข้าตู้",
            tab: "transport",
          },
        ];
      return [];
    }),
    ...unpaidMeatLots.map((item): OwnerNotification => ({
      title: `รอชำระ Invoice เนื้อ · ${item.poId}`,
      detail: `ชำระ Invoice ${entries(db, "foodivaConfirm", item.id).at(-1)?.values.invoiceNo || ""} ของ Foodiva และแนบสลิป`,
      tab: "invoices",
    })),
    ...returnReady.map((item): OwnerNotification => ({
      title: `Chef House ปิด Lot แล้ว · ${item.poId}`,
      detail: `เรียกรถขากลับ ${fmt(produced(db, item.id))} กก. · ${producedBags(db, item.id)} กล่องรมควัน`,
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
      "smoke-po": packedCount,
      "central-receive": centralReceiveCount,
      "branch-status": allocationCount,
      config: missingMaterialSettings,
      history: editAlerts.length,
    } satisfies Partial<Record<Tab, number>>,
  };
}
