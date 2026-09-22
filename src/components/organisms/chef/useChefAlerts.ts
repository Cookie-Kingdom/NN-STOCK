"use client";

import { editRequestAlerts } from "@/components/organisms/workspace/editRequestAlerts";
import { fmt } from "@/lib/format";
import type { Tab } from "@/lib/nav";
import {
  entries,
  latestPackingList,
  n,
  packingListBoxes,
  processed,
  smokingInvoiceRejection,
  smokingInvoiceStatus,
  type Database,
} from "@/lib/store";

export type ChefNotification = { title: string; detail: string; tab: Tab };

/** What Chef House is shown before the first payload lands. Until then the UI is
 * still on the seed, and a signal read off it is an alarm nobody can act on. */
export const noChefAlerts = {
  notifications: [] as ChefNotification[],
  badges: {} as Partial<Record<Tab, number>>,
};

/** Every "this is waiting for Chef House" signal, derived from lot state. Only jobs that
 *  need a hand here: "Owner paid" or "Owner is checking" are news, not work.
 *  `db` is the Chef House view (see visibleDatabase), so `db.lots` is already its shipments. */
export function useChefAlerts(db: Database) {
  const lots = db.lots;
  const waitingReceipt = lots.filter((lot) => lot.stage === 2).length;
  const inProduction = lots.filter((lot) => {
    const ordered = entries(db, "smokeOrder", lot.id).length > 0;
    const accepted = entries(db, "smokeOrderAccept", lot.id).length > 0;
    const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
    return (
      [3, 4, 5].includes(lot.stage) ||
      (ordered && !accepted) ||
      // The smoking invoice is due once the run is closed.
      (lot.stage >= 6 &&
        (!invoice || smokingInvoiceStatus(db, invoice) === "ส่งกลับแก้ไข"))
    );
  }).length;

  const editAlerts = editRequestAlerts(db, "cm", "");
  const notifications: ChefNotification[] = [
    ...editAlerts,
    ...lots.flatMap((lot): ChefNotification[] => {
      const order = entries(db, "smokeOrder", lot.id).at(-1);
      const accepted = entries(db, "smokeOrderAccept", lot.id).length > 0;
      const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
      const items: ChefNotification[] = [];
      // Receiving the meat no longer waits for the PO, so a lot can want both at once.
      if (lot.stage === 2) {
        const list = latestPackingList(db, lot.id);
        items.push({
          title: `มีเนื้อมาส่ง รอยืนยันรับ · ${lot.poId}`,
          detail: list
            ? `${packingListBoxes(list.values.boxes).length} กล่องรับเข้า · ${fmt(n(list.values, "slicedNetKg"))} กก. ตาม Packing List · ชั่งน้ำหนักจริงรายกล่อง`
            : "ชั่งน้ำหนักจริงรายกล่องแล้วยืนยันรับเนื้อ",
          tab: "cm-receive",
        });
      }
      if (order && !accepted)
        items.push({
          title: `PO รมควันใหม่รอยืนยัน · ${order.values.orderNumber || lot.poId}`,
          detail:
            "ต้องยืนยันรับ PO รมควันก่อนเริ่มงานรมควัน (รับเนื้อเข้าก่อนได้)",
          tab: "work",
        });
      if (lot.stage === 3)
        items.push({
          title: `รอบันทึกน้ำหนักก่อนสโมค · ${lot.poId}`,
          detail: `รับเข้าแล้ว ${fmt(n(lot.values, "receivedKg"))} กก. · กรอกน้ำหนักก่อนสโมคเพื่อเริ่มผลิต`,
          tab: "work",
        });
      if (lot.stage === 4)
        items.push({
          title: `รอบันทึก Lot สโมครายวัน · ${lot.poId}`,
          detail: `เหลือรอผลิต ${fmt(Math.max(0, n(lot.values, "preSmokeKg") - processed(db, lot.id)))} กก.`,
          tab: "work",
        });
      if (lot.stage === 5)
        items.push({
          title: `รอยืนยันปิด Lot · ${lot.poId}`,
          detail: "ตรวจข้อมูลก่อนปิด Lot แล้วกดยืนยันปิด Lot",
          tab: "work",
        });
      // Closed: the smoking invoice goes out only now.
      if (lot.stage >= 6 && !invoice)
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
