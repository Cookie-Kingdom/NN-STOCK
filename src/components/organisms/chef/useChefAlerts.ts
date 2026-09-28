"use client";

import { editRequestAlerts } from "@/components/organisms/workspace/editRequestAlerts";
import { fmt } from "@/lib/format";
import type { Tab } from "@/lib/nav";
import {
  entries,
  latestPackingList,
  lotProgress,
  n,
  packingListBoxes,
  processed,
  smokingInvoiceRejection,
  smokingInvoiceStatus,
  type Database,
  type EntryKind,
} from "@/lib/store";

export type ChefNotification = { title: string; detail: string; tab: Tab };

/** What Chef House is shown before the first payload lands. Until then the UI is
 * still on the seed, and a signal read off it is an alarm nobody can act on. */
export const noChefAlerts = {
  notifications: [] as ChefNotification[],
  badges: {} as Partial<Record<Tab, number>>,
};

/** 30 days before the latest entry on file (in use, today's work), as YYYY-MM-DD.
 *  Anchored on the log, not the clock, so a fixed demo or story log reads the same later. */
function monthBefore(db: Database) {
  const latest = db.entries.reduce(
    (max, e) => (e.date > max ? e.date : max),
    "",
  );
  if (!latest) return "";
  const at = new Date(`${latest}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - 30);
  return at.toISOString().slice(0, 10);
}

/** Every "this is waiting for Chef House" signal, derived from lot state. Only jobs that
 *  need a hand here: "Owner paid" or "Owner is checking" are news, not work.
 *  `db` is the Chef House view (see visibleDatabase), so `db.lots` is already its shipments. */
export function useChefAlerts(db: Database) {
  /* DASH-02: what a batch still lacks, from `lotProgress`, only for batches that moved in
   * the last 30 days. Advice only: no button waits on any of these. */
  const since = monthBefore(db);
  const lots = db.lots.filter((lot) =>
    db.entries.some((e) => e.lotId === lot.id && e.date >= since),
  );
  // The meat is on the truck (Foodiva's transport document or Packing List) but not weighed in.
  const onTruck = (p: Set<EntryKind>) =>
    (p.has("dispatch") || p.has("packingList")) && !p.has("cmReceive");
  const waitingReceipt = lots.filter((lot) =>
    onTruck(lotProgress(db, lot.id)),
  ).length;
  const inProduction = lots.filter((lot) => {
    const p = lotProgress(db, lot.id);
    const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
    return (
      (p.has("cmReceive") && !p.has("closeLot")) ||
      (p.has("smokeOrder") && !p.has("smokeOrderAccept")) ||
      // The smoking invoice is usually billed once the run is closed.
      (p.has("closeLot") &&
        (!invoice || smokingInvoiceStatus(db, invoice) === "ส่งกลับแก้ไข"))
    );
  }).length;

  const editAlerts = editRequestAlerts(db, "cm", "");
  const notifications: ChefNotification[] = [
    ...editAlerts,
    ...lots.flatMap((lot): ChefNotification[] => {
      const order = entries(db, "smokeOrder", lot.id).at(-1);
      const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
      const p = lotProgress(db, lot.id);
      const items: ChefNotification[] = [];
      // Receiving the meat never waits for the PO, so a lot can want both at once.
      if (onTruck(p)) {
        const list = latestPackingList(db, lot.id);
        items.push({
          title: `มีเนื้อมาส่ง รอยืนยันรับ · ${lot.poId}`,
          detail: list
            ? `${packingListBoxes(list.values.boxes).length} กล่องรับเข้า · ${fmt(n(list.values, "slicedNetKg"))} กก. ตาม Packing List · ชั่งน้ำหนักจริงรายกล่อง`
            : "ชั่งน้ำหนักจริงรายกล่องแล้วยืนยันรับเนื้อ",
          tab: "cm-receive",
        });
      }
      if (order && !p.has("smokeOrderAccept"))
        items.push({
          title: `PO รมควันใหม่รอยืนยัน · ${order.values.orderNumber || lot.poId}`,
          detail:
            "ตรวจ PO รมควันจาก Owner แล้วกดยืนยันรับ · งานรับเนื้อและรมควันทำต่อได้โดยไม่ต้องรอ",
          tab: "work",
        });
      if (p.has("cmReceive") && !p.has("prepare"))
        items.push({
          title: `รอบันทึกน้ำหนักก่อนสโมค · ${lot.poId}`,
          detail: `รับเข้าแล้ว ${fmt(n(lot.values, "receivedKg"))} กก. · กรอกน้ำหนักก่อนสโมคเพื่อเริ่มผลิต`,
          tab: "work",
        });
      const pending = Math.max(
        0,
        n(lot.values, "preSmokeKg") - processed(db, lot.id),
      );
      if (p.has("prepare") && pending > 0.005 && !p.has("closeLot"))
        items.push({
          title: `รอบันทึก Lot สโมครายวัน · ${lot.poId}`,
          detail: `เหลือรอผลิต ${fmt(pending)} กก.`,
          tab: "work",
        });
      if (p.has("smoke") && pending <= 0.005 && !p.has("closeLot"))
        items.push({
          title: `รอยืนยันปิด Lot · ${lot.poId}`,
          detail: "ตรวจข้อมูลก่อนปิด Lot แล้วกดยืนยันปิด Lot",
          tab: "work",
        });
      // Closed with no bill yet (it may go out earlier too, SVC-01).
      if (p.has("closeLot") && !invoice)
        items.push({
          title: `ยังไม่ Submit Invoice ค่ารมควัน · ${lot.poId}`,
          detail:
            "ปิด Lot แล้ว สร้างและ Submit ใบวางบิลค่ารมควันให้ Owner ตรวจยอด",
          tab: "work",
        });
      if (invoice && smokingInvoiceStatus(db, invoice) === "ส่งกลับแก้ไข") {
        const note = smokingInvoiceRejection(
          db,
          invoice,
        )?.values.comment?.trim();
        items.push({
          title: `Owner ส่ง Invoice กลับมาแก้ไข · ${invoice.values.invoiceNumber || lot.poId}`,
          detail: note
            ? `${note} · แก้ไขแล้ว Submit ใบวางบิลใหม่`
            : "แก้ไขแล้ว Submit ใบวางบิลใหม่",
          tab: "work",
        });
      }
      return items;
    }),
  ];

  return {
    notifications,
    badges: {
      "cm-receive": waitingReceipt,
      work: inProduction,
      history: editAlerts.length,
    } satisfies Partial<Record<Tab, number>>,
  };
}
