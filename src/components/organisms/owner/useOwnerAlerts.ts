"use client";

import { editRequestAlerts } from "@/components/organisms/workspace/editRequestAlerts";
import { fmt } from "@/lib/format";
import type { Tab } from "@/lib/nav";
import {
  activeBatches,
  missingStepTab,
  missingSteps,
  missingText,
} from "@/components/organisms/owner/lotSteps";
import {
  centralStock,
  currentSmokingInvoices,
  type Database,
  entries,
  materialPar,
  materialUnitPrice,
  materials,
  produced,
  ownerPendingInvoices,
  producedBags,
  purchaseLots,
  shipments,
  smokingInvoiceStatus,
  lotProgress,
  unlinkedSummary,
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

/** Shipments Chef House has closed that still need the Owner to book the truck home.
 *  The return-trip screen and the alerts read the same list, so a lot can never be
 *  ready in one place and missing in the other. */
export function returnReadyLots(db: Database) {
  return shipments(db).filter(
    (lot) =>
      lotProgress(db, lot.id).has("closeLot") &&
      !entries(db, "return", lot.id).length,
  );
}

/** Every "someone is waiting on the owner" signal, derived from lot state. */
export function useOwnerAlerts(db: Database) {
  const missingMaterialSettings = materials.filter(
    (_, index) =>
      materialPar(db, "ศาลาแดง", index) <= 0 ||
      materialUnitPrice(db, "ศาลาแดง", index) <= 0,
  ).length;

  const shipmentLots = shipments(db);
  // Outbound only: the return trip has its own tab and counts on its own badge.
  const transportCount = shipmentLots.filter(
    (lot) => !lotProgress(db, lot.id).has("dispatch"),
  ).length;
  const returnReady = returnReadyLots(db);
  // Foodiva has the smoked beef in its freezer; the Owner has not counted it into central.
  const centralReceiveCount = shipmentLots.filter((lot) => {
    const p = lotProgress(db, lot.id);
    return p.has("foodivaReturnReceive") && !p.has("central");
  }).length;
  const allocationCount = shipmentLots.filter(
    (lot) =>
      lotProgress(db, lot.id).has("central") &&
      centralStock(db, lot.id) > 0.001,
  ).length;
  // Invoices the owner has to act on, the same ones the bell lists: a Foodiva meat invoice
  // still unpaid, a Chef House smoking invoice to review or to pay.
  const pendingInvoices = ownerPendingInvoices(db);
  const { unpaidMeatLots } = pendingInvoices;
  const billingCount = pendingInvoices.total;
  // Batches Foodiva or Chef House opened that still have no smoke PO.
  const smokePoCount = unlinkedSummary(db).batchesWithoutSmokeOrder.length;
  // Branch meat received into "ไม่ระบุ Lot", waiting to be linked to a batch.
  const unlinkedCount = entries(db, "receive", "").length;
  // The partners' steps the Owner types for them, on batches that moved in the last 30
  // days (DASH-02). Hints, never gates; same counts the old Foodiva / Chef House badges had.
  const active = activeBatches(db).map((lot) => ({
    lot,
    p: lotProgress(db, lot.id),
  }));
  const foodivaCount =
    purchaseLots(db).filter(
      (lot) => !lotProgress(db, lot.id).has("foodivaConfirm"),
    ).length +
    active.filter(
      ({ p }) =>
        (p.has("smokeOrder") && !p.has("dispatch")) ||
        (p.has("dispatch") && !p.has("packingList")) ||
        (p.has("return") &&
          !p.has("central") &&
          !p.has("foodivaReturnReceive")),
    ).length;
  const cmReceiveCount = active.filter(
    ({ p }) =>
      (p.has("dispatch") || p.has("packingList")) && !p.has("cmReceive"),
  ).length;
  const workCount = active.filter(({ lot, p }) => {
    const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
    return (
      (p.has("cmReceive") && !p.has("closeLot")) ||
      // The smoking invoice is usually billed once the run is closed.
      (p.has("closeLot") &&
        (!invoice || smokingInvoiceStatus(db, invoice) === "ส่งกลับแก้ไข"))
    );
  }).length;

  const editAlerts = editRequestAlerts(db, "owner", "");
  const notifications: OwnerNotification[] = [
    ...editAlerts,
    ...purchaseLots(db).flatMap((item): OwnerNotification[] =>
      entries(db, "foodivaConfirm", item.id).length
        ? []
        : [
            {
              title: `ออก Invoice เนื้อ · ${item.id}`,
              detail: "ยืนยันน้ำหนักและแนบ Invoice เนื้อของ Foodiva",
              tab: "foodiva",
            },
          ],
    ),
    // DASH-02: per batch active in the last 30 days, the steps it has no entry for. Advice
    // only; the smoking invoice's own review state is said on its own below.
    ...activeBatches(db).flatMap((item): OwnerNotification[] => {
      const missing = missingSteps(db, item.id);
      return missing.length
        ? [
            {
              title: `ชุด ${item.poId} ยังขาด ${missing.length} ขั้น`,
              detail: missingText(missing),
              tab: missingStepTab(missing),
            },
          ]
        : [];
    }),
    ...currentSmokingInvoices(db).flatMap((invoice): OwnerNotification[] => {
      const poId =
        shipmentLots.find((lot) => lot.id === invoice.lotId)?.poId ||
        invoice.lotId;
      const number = invoice.values.invoiceNumber;
      const status = smokingInvoiceStatus(db, invoice);
      if (status === "รอตรวจยอด")
        return [
          {
            title: `รอตรวจ Invoice ค่ารมควัน · ${number}`,
            detail: `ตรวจยอดการส่ง ${poId} ก่อนชำระ`,
            tab: "invoices",
          },
        ];
      if (status === "รอชำระ")
        return [
          {
            title: `รอชำระ Invoice ค่ารมควัน · ${number}`,
            detail: `ชำระเงินค่ารมควันการส่ง ${poId}`,
            tab: "invoices",
          },
        ];
      if (status === "ส่งกลับแก้ไข")
        return [
          {
            title: `แก้ Invoice ค่ารมควัน · ${number}`,
            detail:
              "ส่งกลับแก้ไขแล้ว · แก้ใบวางบิลของ Chef House แล้ว Submit ใหม่",
            tab: "work",
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
      tab: "return-shipment",
    })),
    ...(unlinkedCount
      ? [
          {
            title: `รายการที่ยังไม่ผูก Lot: ${unlinkedCount}`,
            detail: "สาขารับเนื้อโดยไม่ระบุ Lot · ผูกกับชุดรมควันภายหลังได้",
            tab: "history" as Tab,
          },
        ]
      : []),
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
            detail: "เลือกสาขาและจัดสรรเนื้อที่รออยู่ที่ Foodiva",
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
      "return-shipment": returnReady.length,
      invoices: billingCount,
      "smoke-po": smokePoCount,
      foodiva: foodivaCount,
      "cm-receive": cmReceiveCount,
      work: workCount,
      "central-receive": centralReceiveCount,
      "branch-status": allocationCount,
      config: missingMaterialSettings,
      history: editAlerts.length,
    } satisfies Partial<Record<Tab, number>>,
  };
}
