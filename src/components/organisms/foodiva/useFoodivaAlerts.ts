"use client";

import type { Notification } from "@/components/organisms/workspace/NotificationPopover";
import { editRequestAlerts } from "@/components/organisms/workspace/editRequestAlerts";
import { fmt } from "@/lib/format";
import type { Tab } from "@/lib/nav";
import {
  type Database,
  entries,
  latestPackingList,
  n,
  producedBags,
  purchaseLots,
  shipments,
  STAGE,
} from "@/lib/store";

/** What Foodiva is shown before the first payload lands. Until then the UI is still on
 * the seed, and a signal read off it is an alarm nobody can act on. */
export const noFoodivaAlerts = {
  notifications: [] as Notification[],
  openTasks: 0,
  badges: {} as Partial<Record<Tab, number>>,
};

/** Every "Foodiva has to do something" signal, derived from lot state — the other side of
 *  the Owner's "รอ Foodiva …" lines, so the two bells can never disagree.
 *  Foodiva only has `foodiva` and `history`, so every task lands on the work tab. */
export function useFoodivaAlerts(db: Database) {
  const shipmentLots = shipments(db);
  // A purchase PO with no Invoice yet: weigh it and attach the meat Invoice.
  const toInvoice = purchaseLots(db).filter(
    (lot) => !entries(db, "foodivaConfirm", lot.id).length,
  );
  // Stage 1 = the Owner's Request is in, no outbound transport document yet.
  const toDispatch = shipmentLots.filter((lot) => lot.stage === STAGE.dispatch);
  // Trucked but no Packing List: the Owner cannot issue the smoke PO without it.
  const toPack = shipmentLots.filter(
    (lot) => lot.stage >= STAGE.cmReceive && !latestPackingList(db, lot.id),
  );
  // Stage 7 = on the return truck; Foodiva weighs it into its own freezer.
  const toReceive = shipmentLots.filter(
    (lot) =>
      lot.stage === STAGE.central &&
      !entries(db, "foodivaReturnReceive", lot.id).length,
  );

  const editAlerts = editRequestAlerts(db, "foodiva", "");
  const notifications: Notification[] = [
    ...editAlerts,
    ...toInvoice.map((lot) => ({
      title: `ออก Invoice เนื้อ · ${lot.poId}`,
      detail: `ยืนยันน้ำหนักและแนบ Invoice ของ PO ${fmt(n(lot.values, "orderedKg"))} กก.`,
      tab: "foodiva" as const,
    })),
    ...toDispatch.map((lot) => ({
      title: `ทำใบขนส่งขาไป · ${lot.poId}`,
      detail: `Request ส่งเนื้อ ${fmt(n(lot.values, "requestedKg"))} กก. ไป Chef House`,
      tab: "foodiva" as const,
    })),
    ...toPack.map((lot) => ({
      title: `ทำ Packing List · ${lot.poId}`,
      detail: "ต้องมี Packing List ก่อน Owner ออก PO รมควัน",
      tab: "foodiva" as const,
    })),
    ...toReceive.map((lot) => ({
      title: `ชั่งรับเนื้อรมควันเข้าตู้ · ${lot.poId}`,
      detail: `เนื้อจาก Chef House ${producedBags(db, lot.id)} กล่องรมควัน อยู่บนรถขากลับ`,
      tab: "foodiva" as const,
    })),
  ];

  const openTasks =
    toInvoice.length + toDispatch.length + toPack.length + toReceive.length;
  return {
    notifications,
    openTasks,
    badges: {
      foodiva: openTasks,
      history: editAlerts.length,
    } satisfies Partial<Record<Tab, number>>,
  };
}
