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
  "รอรับ PO รมควัน": smokeOrderDb,
  "เปิดชุดเอง ยังไม่มี PO": chefOpenedDb,
  "ออก Invoice ก่อนมี PO": chefBilledDb,
  "Owner ออก PO ทีหลัง": chefPoLaterDb,
  รมควันแล้ว: smokedDb,
  "รอออก Invoice": returnTruckDb,
  ปิดแล้ว: demoDb,
  "Invoice ถูกส่งกลับ": rejectedInvoiceDb,
});

/** เลือกสถานะใน Controls. No button waits on an earlier step (CHF-07): the usual next
 *  step is the filled button, the others sit beside it as secondary ones.
 *  - รอรับ PO รมควัน: the Owner's smoke PO is not accepted yet and the meat is not weighed
 *    in; both buttons are there, along with pre-smoke, smoke, close and the invoice.
 *  - เปิดชุดเอง ยังไม่มี PO: Chef House opened the batch itself and weighed it in; the row
 *    carries "ยังไม่มี PO รมควัน" and still offers every job.
 *  - ออก Invoice ก่อนมี PO: that batch smoked, closed and billed before any smoke PO.
 *  - Owner ออก PO ทีหลัง: the Owner then issued the PO on it; the badge goes and
 *    "ยืนยันรับ PO รมควัน" appears. No purchase PO number or price shows anywhere.
 *  - รมควันแล้ว: smoked, "Edit ข้อมูลก่อนปิด Lot" or close the run.
 *  - รอออก Invoice: closed run with no smoking invoice yet.
 *  - ปิดแล้ว: the seven-day demo run, closed and billed.
 *  - Invoice ถูกส่งกลับ: the Owner sent the smoking invoice back; the row shows the reason
 *    next to the fix button. */
export const LotTable: Story = {
  argTypes: { db: lotState.argType },
  args: { db: lotState.initial },
  render: ({ db }) => <ChefLotTable db={db} lots={shipments(db)} open={open} />,
};

const receiveState = pick("สถานะ", {
  "รถมาพร้อม Packing List": dispatchedDb,
  "มีแต่ PO รมควัน": dispatchDb,
  ไม่มีชุดรอรับ: chefBilledDb,
});

/** Every batch not weighed in yet, with or without a Packing List or smoke PO, and
 *  "เปิดชุดใหม่" for meat that arrives with no batch at all.
 *  - รถมาพร้อม Packing List: shipment number, boxes and kg, vehicle.
 *  - มีแต่ PO รมควัน: the Owner's PO is in, Foodiva's Packing List is not.
 *  - ไม่มีชุดรอรับ: the empty table; "เปิดชุดใหม่" is still there. */
export const ReceiveTable: Story = {
  argTypes: { db: receiveState.argType },
  args: { db: receiveState.initial },
  render: ({ db }) => <ChefReceiveTable db={db} open={open} />,
};
