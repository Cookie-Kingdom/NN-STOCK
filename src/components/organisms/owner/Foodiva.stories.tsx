import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  confirmedDb,
  demoDb,
  dispatchDb,
  foodivaBatchesDb,
  multiPoDb,
  open,
  ownerReservedDb,
  packedDb,
  packedThenOrderedDb,
  paidDb,
  returnGapDb,
  returnTruckDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import type { Database } from "@/lib/store";
import { FoodivaView } from "./FoodivaView";

const meta: Meta = { title: "Organisms/Owner/Foodiva" };

export default meta;
type Story = StoryObj<{ db: Database }>;

const foodivaState = pick("สถานะ", {
  รอส่งของ: dispatchDb,
  "เปิดชุดเอง ยังไม่มี PO รมควัน": packedDb,
  "Owner ออก PO รมควันภายหลัง": packedThenOrderedDb,
  ชุดหลายแบบ: foodivaBatchesDb,
  "PO คงเหลือ": multiPoDb,
  "เก็บไว้ให้ Owner": ownerReservedDb,
  "Invoice รอชำระ": confirmedDb,
  "Invoice จ่ายแล้ว": paidDb,
  รถขากลับกำลังมา: returnTruckDb,
  รับขากลับแล้ว: returnGapDb,
  เสร็จสิ้น: demoDb,
});

/** The Owner's Foodiva tab (Foodiva is a partner, not a user). "ชุดรมควัน" lists every shipment batch with its progress chips
 *  (from `lotProgress`, hints only) and "เปิดชุดใหม่" opens a transport document on a new
 *  batch. "PO รมควันที่ยังไม่มีใบขนส่ง" is the incoming work. เลือกสถานะใน Controls:
 *  - รอส่งของ: the Owner's smoke PO opened a batch waiting for Foodiva's transport document;
 *    it shows in both tables.
 *  - เปิดชุดเอง ยังไม่มี PO รมควัน: Foodiva opened and trucked a batch with its Packing List
 *    before any smoke PO; "PO รมควัน" says ยังไม่มี and "แก้ไข Packing List" is open.
 *  - Owner ออก PO รมควันภายหลัง: the same batch after the Owner issued the smoke PO on it;
 *    the Packing List stays editable (its form warns).
 *  - ชุดหลายแบบ: a Foodiva-opened batch without a PO, a 40 kg smoke PO waiting for its
 *    truck, and smoked meat weighed into the freezer before any return truck was on file.
 *  - PO คงเหลือ: no PO waits for a truck; every purchase PO shows its kg left to send.
 *  - เก็บไว้ให้ Owner: 10 kg kept for the Owner, 4 kg already picked up; "เก็บไว้ให้ Owner
 *    คงเหลือ" shows 6 kg.
 *  - Invoice รอชำระ: invoice in, the Owner has not paid it yet; "การชำระเงิน" says รอ
 *    Owner ชำระ.
 *  - Invoice จ่ายแล้ว: the Owner paid the meat invoice; "จ่ายแล้ว" with date and amount,
 *    and the slip opens from the row (storage folder `meatPayment/`, readable by Foodiva
 *    since migration 0027).
 *  - รถขากลับกำลังมา: return truck on its way; "ยืนยันรับเข้าตู้" next to what Chef House
 *    sent (กล่องรมควัน / kg). The button is on every batch not yet weighed in.
 *  - รับขากลับแล้ว: weighed in 0.5 kg short of what Chef House sent; the gap is flagged
 *    until the Owner's central count.
 *  - เสร็จสิ้น: the seven-day demo run, completed. */
export const WaitingForDispatch: Story = {
  argTypes: { db: foodivaState.argType },
  args: { db: foodivaState.initial },
  render: ({ db }) => <FoodivaView db={db} open={open} />,
};
