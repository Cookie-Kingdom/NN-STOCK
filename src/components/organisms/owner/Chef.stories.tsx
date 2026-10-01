import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  chefBilledDb,
  chefOpenedDb,
  chefPoLaterDb,
  demoDb,
  dispatchDb,
  dispatchedDb,
  open,
  rejectedInvoiceDb,
  returnTruckDb,
  smokedDb,
  smokeOrderDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { shipments, type Database } from "@/lib/store";
import { ChefLotTable } from "./ChefLotTable";
import { ChefReceiveTable } from "./ChefReceiveTable";

const meta: Meta = { title: "Organisms/Owner/Chef" };

export default meta;
type Story = StoryObj<{ db: Database }>;

const lotState = pick("สถานะ", {
  "มี PO รมควัน ยังไม่ได้จดรับ": smokeOrderDb,
  "เปิดชุดเอง ยังไม่มี PO": chefOpenedDb,
  "มี Invoice แต่ยังไม่มี PO": chefBilledDb,
  "Owner ออก PO ทีหลัง": chefPoLaterDb,
  รมควันแล้ว: smokedDb,
  "ยังไม่ได้จด Invoice": returnTruckDb,
  ปิดแล้ว: demoDb,
  "Invoice ถูกส่งกลับ": rejectedInvoiceDb,
});

/** เลือกสถานะใน Controls. Every record button looks the same (CHF-07): none is picked
 *  out as "the next one", and a button is missing only where the save would be refused
 *  ("ยืนยันรับ PO รมควัน" with no smoke PO; "Edit ข้อมูลก่อนปิด Lot" with no weigh-in or
 *  pre-smoke weight to correct). "จดล่าสุด" names the latest record on the batch.
 *  - มี PO รมควัน ยังไม่ได้จดรับ: the Owner's smoke PO is not accepted yet and the meat is
 *    not weighed in; both buttons are there, along with pre-smoke, smoke, close and the
 *    invoice.
 *  - เปิดชุดเอง ยังไม่มี PO: Chef House opened the batch itself and weighed it in; the row
 *    carries a neutral "ยังไม่มี PO รมควัน" and still offers every job.
 *  - มี Invoice แต่ยังไม่มี PO: that batch smoked, closed and billed with no smoke PO.
 *  - Owner ออก PO ทีหลัง: the Owner then issued the PO on it; the badge goes and
 *    "ยืนยันรับ PO รมควัน" appears. No purchase PO number or price shows anywhere.
 *  - รมควันแล้ว: smoked; "Edit ข้อมูลก่อนปิด Lot" sits beside the other buttons.
 *  - ยังไม่ได้จด Invoice: closed run with no smoking invoice yet.
 *  - ปิดแล้ว: the seven-day demo run, closed and billed.
 *  - Invoice ถูกส่งกลับ: the Owner sent the smoking invoice back; the row shows the reason
 *    next to the fix button (a real anomaly, so it stays red). */
export const LotTable: Story = {
  argTypes: { db: lotState.argType },
  args: { db: lotState.initial },
  render: ({ db }) => <ChefLotTable db={db} lots={shipments(db)} open={open} />,
};

const receiveState = pick("สถานะ", {
  "รถมาพร้อม Packing List": dispatchedDb,
  "มีแต่ PO รมควัน": dispatchDb,
  จดรับครบแล้ว: chefBilledDb,
});

/** "การส่งที่ยังไม่ได้จดรับ": every batch not weighed in yet, with or without a Packing
 *  List or smoke PO, and "เปิดชุดใหม่" for meat that arrives with no batch at all.
 *  - รถมาพร้อม Packing List: shipment number, box count and total kg, vehicle.
 *  - มีแต่ PO รมควัน: the Owner's PO is in, Foodiva's Packing List is not.
 *  - จดรับครบแล้ว: the empty table; "เปิดชุดใหม่" is still there. */
export const ReceiveTable: Story = {
  argTypes: { db: receiveState.argType },
  args: { db: receiveState.initial },
  render: ({ db }) => <ChefReceiveTable db={db} open={open} />,
};
