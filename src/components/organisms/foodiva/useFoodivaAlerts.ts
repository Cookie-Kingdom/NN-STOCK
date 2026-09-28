"use client";

import type { Notification } from "@/components/organisms/workspace/NotificationPopover";
import { editRequestAlerts } from "@/components/organisms/workspace/editRequestAlerts";
import { fmt } from "@/lib/format";
import type { Tab } from "@/lib/nav";
import {
  type Database,
  entries,
  lotProgress,
  n,
  producedBags,
  purchaseLots,
  shipments,
} from "@/lib/store";

/** What Foodiva is shown before the first payload lands. Until then the UI is still on
 * the seed, and a signal read off it is an alarm nobody can act on. */
export const noFoodivaAlerts = {
  notifications: [] as Notification[],
  openTasks: 0,
  badges: {} as Partial<Record<Tab, number>>,
};

/** DASH-02: a batch is only nagged about while something happened on it in the last 30
 *  days. Counted back from the newest entry in the database, not the wall clock, so the
 *  same data always rings the same bell. */
const ACTIVE_DAYS = 30;
function activeSince(db: Database) {
  const latest = db.entries.reduce(
    (max, e) => (e.date > max ? e.date : max),
    "",
  );
  if (!latest) return "";
  const since = new Date(`${latest}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - ACTIVE_DAYS);
  return since.toISOString().slice(0, 10);
}

/** Every "Foodiva has to do something" signal, read from `lotProgress` — hints, never gates:
 *  every button on the Foodiva screen stays open whatever is listed here.
 *  Foodiva only has `foodiva` and `history`, so every task lands on the work tab. */
export function useFoodivaAlerts(db: Database) {
  const since = activeSince(db);
  const shipmentLots = shipments(db).filter((lot) =>
    db.entries.some((e) => e.lotId === lot.id && e.date >= since),
  );
  // A purchase PO with no Invoice yet: weigh it and attach the meat Invoice.
  const toInvoice = purchaseLots(db).filter(
    (lot) => !lotProgress(db, lot.id).has("foodivaConfirm"),
  );
  // SMK-09: the Owner's smoke PO is in, no outbound transport document yet.
  const toDispatch = shipmentLots.filter((lot) => {
    const p = lotProgress(db, lot.id);
    return p.has("smokeOrder") && !p.has("dispatch");
  });
  // Trucked but no Packing List: Chef House checks its boxes against it.
  const toPack = shipmentLots.filter((lot) => {
    const p = lotProgress(db, lot.id);
    return p.has("dispatch") && !p.has("packingList");
  });
  // On the return truck and not yet counted centrally; Foodiva weighs it into its freezer.
  const toReceive = shipmentLots.filter((lot) => {
    const p = lotProgress(db, lot.id);
    return (
      p.has("return") && !p.has("central") && !p.has("foodivaReturnReceive")
    );
  });

  const editAlerts = editRequestAlerts(db, "foodiva", "");
  const notifications: Notification[] = [
    ...editAlerts,
    ...toInvoice.map((lot) => ({
      title: `ออก Invoice เนื้อ · ${lot.poId}`,
      detail: `ยืนยันน้ำหนักและแนบ Invoice ของ PO ${fmt(n(lot.values, "orderedKg"))} กก.`,
      tab: "foodiva" as const,
    })),
    ...toDispatch.map((lot) => {
      const order = entries(db, "smokeOrder", lot.id).at(-1);
      return {
        title: `ทำใบขนส่งขาไป · ${lot.poId}`,
        detail: `PO รมควัน ${order?.values.orderNumber ?? ""} ส่งเนื้อ ${fmt(n(lot.values, "requestedKg"))} กก. ไป Chef House`,
        tab: "foodiva" as const,
      };
    }),
    ...toPack.map((lot) => ({
      title: `ทำ Packing List · ${lot.poId}`,
      detail: "Chef House ใช้ Packing List ตรวจกล่องรับเข้า",
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
