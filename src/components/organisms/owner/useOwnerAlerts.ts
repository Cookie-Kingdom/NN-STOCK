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
  awaitingReturn,
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

type OwnerNotification = { title: string; detail: string; tab: Tab };

/** What the owner is shown before the first payload lands. Until then the UI is
 * still on the seed, and a signal read off it is an alarm nobody can act on. */
export const noOwnerAlerts = {
  notifications: [] as OwnerNotification[],
  missingMaterialSettings: 0,
  returnReady: [] as Database["lots"],
  badges: {} as Partial<Record<Tab, number>>,
};

/** Shipments Chef House has closed that still need the Owner to book the truck home: the
 *  closed subset of the return screen's rows (`awaitingReturn`, RET-06). */
function returnReadyLots(db: Database) {
  return awaitingReturn(db).filter((lot) =>
    lotProgress(db, lot.id).has("closeLot"),
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
  const returnReady = returnReadyLots(db);
  // Foodiva has the smoked beef in its freezer; the Owner has not counted it into central.
  const centralReceiveCount = shipmentLots.filter((lot) => {
    const p = lotProgress(db, lot.id);
    return p.has("foodivaReturnReceive") && !p.has("central");
  }).length;
  // RET-07: batches whose smoke PO names no purchase PO yet; matched on the same tab.
  const unmatchedCount = shipmentLots.filter((lot) => {
    const p = lotProgress(db, lot.id);
    return (
      !(p.has("foodivaReturnReceive") && !p.has("central")) &&
      missingSteps(db, lot.id, ["matchPo"]).length > 0
    );
  }).length;
  // Invoices the owner has to act on, the same ones the bell lists: a Foodiva meat invoice
  // still unpaid, a Chef House smoking invoice to review or to pay.
  const pendingInvoices = ownerPendingInvoices(db);
  const { unpaidMeatLots } = pendingInvoices;
  const billingCount = pendingInvoices.total;
  // Batches Foodiva or Chef House opened that still have no smoke PO.
  const unlinked = unlinkedSummary(db);
  const smokePoCount = unlinked.batchesWithoutSmokeOrder.length;
  // Branch meat received into "ไม่ระบุ Lot", waiting to be linked to a batch: the same kg
  // the dashboard's "ยังไม่ผูก" tile shows (DASH-01).
  const unlinkedCount = unlinked.meatReceives;
  const unlinkedKg = Object.values(unlinked.meatKg).reduce(
    (total, kg) => total + kg,
    0,
  );
  // The partners' steps the Owner types for them, on batches that moved in the last 30
  // days (DASH-02). Hints, never gates; same counts the old Foodiva / Chef House badges had.
  const active = activeBatches(db).map((lot) => ({
    lot,
    p: lotProgress(db, lot.id),
  }));
  // The outbound transport doc is made on the foodiva tab, so a batch waiting on it counts
  // there too; the `transport` badge repeats it for every batch with work but no ใบขนส่ง,
  // with a smoke PO or opened some other way (Chef House weighed in first, etc.).
  const transportLots = active.filter(
    ({ p }) => p.size > 0 && !p.has("dispatch"),
  );
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
    ...transportLots.map(({ lot }): OwnerNotification => ({
      title: `ต้องทำใบขนส่ง · ${lot.poId}`,
      detail: "ออกใบขนส่งขาไปของ Foodiva",
      tab: "foodiva",
    })),
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
            title: `เนื้อสาขายังไม่ผูก Lot: ${fmt(unlinkedKg)} กก.`,
            detail: `คงเหลือในถังไม่ระบุ Lot · รอผูก ${unlinkedCount} รายการรับ · ผูกกับชุดรมควันภายหลังได้`,
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
      "return-shipment": returnReady.length,
      invoices: billingCount,
      "smoke-po": smokePoCount,
      foodiva: foodivaCount,
      transport: transportLots.length,
      "cm-receive": cmReceiveCount,
      work: workCount,
      "central-receive": centralReceiveCount + unmatchedCount,
      config: missingMaterialSettings,
      // The bell sends both edit requests and unlinked branch meat to history.
      history: editAlerts.length + unlinkedCount,
    } satisfies Partial<Record<Tab, number>>,
  };
}
